const textKey=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]/gi,'').toUpperCase()
const roundMoney=value=>Math.round((Number(value)||0)*100)/100
const polishNumber=value=>{
  const normalized=String(value||'').trim().replace(/\s/g,'').replace(/(?<=\d)[:](?=\d{2}\b)/g,'.').replace(',','.')
  const number=Number(normalized.replace(/[^\d.-]/g,''))
  return Number.isFinite(number)?number:0
}

function normalizeOcrText(value){
  return String(value||'').replace(/\r/g,'').replace(/[„”]/g,'"').replace(/(?<=\d):(?=\d{2}\b)/g,'.').replace(/[ \t]+/g,' ').split('\n').map(line=>line.trim()).filter(Boolean).join('\n')
}

function findSupplier(lines,documentIndex){
  const before=lines.slice(0,Math.max(0,documentIndex)).filter(line=>!/(sprzedaw|adres|nip|regon|konto|bank|telefon|tel\.|email|polica|data|wydruk)/i.test(line))
  const strong=before.find(line=>/[A-ZĄĆĘŁŃÓŚŹŻ]{3}/.test(line)&&/[a-ząćęłńóśźż]{2}/i.test(line)&&line.length>=6&&line.length<=90)
  return strong?.replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]+/,'').trim()||''
}

function parseItemLine(line){
  const normalized=line.replace(/[|;]/g,' ').replace(/(?<=\d):(?=\d{2}\b)/g,'.').replace(/\s+/g,' ').trim().replace(/(\s)(\d{1,5})\s+(SZT\.?|SZTUK|PCS)\b/i,'$1$2.00 $3')
  const decimals=[...normalized.matchAll(/\b\d{1,6}[.,]\d{2}\b/g)]
  if(decimals.length<4)return null
  const qtyIndex=decimals.findIndex((match,index)=>index<2&&polishNumber(match[0])>0&&polishNumber(match[0])<=999)
  if(qtyIndex<0||decimals.length-qtyIndex<4)return null
  const qtyMatch=decimals[qtyIndex]
  const prefix=normalized.slice(0,qtyMatch.index).trim()
  const tokens=[...prefix.matchAll(/[A-ZĄĆĘŁŃÓŚŹŻ0-9][A-ZĄĆĘŁŃÓŚŹŻ0-9./-]*/gi)]
  let codeToken=null
  for(const token of tokens){
    const value=token[0]
    if(value.length>=4&&(/[A-ZĄĆĘŁŃÓŚŹŻ]/i.test(value)&&/\d/.test(value)||/^\d{5,}$/.test(value))&&!/^SZT$/i.test(value)){codeToken=token;break}
  }
  if(!codeToken)return null
  const partNo=codeToken[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Ł]/gi,'L').replace(/^[^A-Z0-9]+|[^A-Z0-9./-]+$/gi,'').toUpperCase()
  let name=prefix.slice(codeToken.index+codeToken[0].length).replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]+/i,'').replace(/[|;]/g,' ').replace(/\s+/g,' ').trim()
  if(!name||name.length<3)return null
  const values=decimals.slice(qtyIndex).map(match=>polishNumber(match[0]))
  const qty=values[0],scannedUnitCost=values[1],netTotal=values[2]
  const netMatch=decimals[qtyIndex+2]
  const vatMatch=normalized.slice(netMatch.index+netMatch[0].length).match(/^\s*(0|5|8|23)\s*%?(?:\s|$)/)
  const vatRate=vatMatch?Number(vatMatch[1]):23
  const vatAmount=values.length>=5?values[values.length-2]:values[3]
  const grossTotal=values.length>=5?values[values.length-1]:roundMoney(netTotal+vatAmount)
  const lineMismatch=Math.abs(roundMoney(qty*scannedUnitCost)-roundMoney(netTotal))>.08
  const taxMismatch=Math.abs(roundMoney(netTotal+vatAmount)-roundMoney(grossTotal))>.08
  const taxDerived=vatRate>0&&vatAmount>0?vatAmount/(vatRate/100):0
  const correctedNet=taxMismatch&&taxDerived>0?taxDerived:netTotal
  const unitCost=roundMoney((lineMismatch||taxMismatch)&&qty>0?correctedNet/qty:scannedUnitCost)
  const mismatch=lineMismatch||taxMismatch
  const suspicious=/[^A-Z0-9./-]/i.test(partNo)||partNo.length<5||mismatch
  return{part_no:partNo,name,qty,unit_cost:unitCost,net_total:netTotal,vat_rate:vatRate,vat_amount:vatAmount,gross_total:grossTotal,confidence:suspicious?'CHECK':'GOOD',source_line:line}
}

function parseDeliveryDocument(rawText){
  const text=normalizeOcrText(rawText),lines=text.split('\n')
  const documentIndex=lines.findIndex(line=>/(wydanie\s+zewn|faktura|paragon|dokument\s+dostaw)/i.test(line))
  const documentLine=lines[documentIndex]||''
  const documentMatch=documentLine.match(/(?:nr\s*[:.]?\s*)?([A-Z0-9]+(?:[\/-][A-Z0-9]+){2,})/i)
  const datedLine=lines.find(line=>/(data\s+(dostaw|wystaw|wykon)|wydrukowano)/i.test(line))||''
  const dateMatch=datedLine.match(/(\d{1,2}[./-]\d{1,2}[./-]\d{4})/)
  const totalLine=lines.find(line=>/wartość\s+dokumentu/i.test(line))||''
  const totalMatches=[...totalLine.matchAll(/\d+[.,]\d{2}/g)]
  const rows=[]
  let current=null
  for(const line of lines){
    if(/^(razem|w tym|wartość dokumentu|sposób zapłaty)/i.test(line))break
    const row=parseItemLine(line)
    if(row){rows.push(row);current=row;continue}
    if(current&&line.length<=45&&!/^(lp\.|kod|nazwa|ilość|j\.?m|cena|wartość|podatek|netto|brutto)/i.test(line)&&/[A-ZĄĆĘŁŃÓŚŹŻ]{2}/.test(line)){
      const continuation=line.replace(/[|;]/g,' ').replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]+/,'').replace(/\s+/g,' ').trim()
      if(continuation.length>2)current.name=`${current.name} ${continuation}`.replace(/\s+/g,' ').trim()
    }
  }
  const warnings=[]
  if(!rows.length)warnings.push('Nie rozpoznano pozycji tabeli. Sprawdź jakość zdjęcia lub dodaj wiersze ręcznie.')
  if(rows.some(row=>row.confidence==='CHECK'))warnings.push('Co najmniej jeden numer lub cena wymaga sprawdzenia z dokumentem.')
  const rowsGross=roundMoney(rows.reduce((sum,row)=>sum+row.gross_total,0)),documentGross=totalMatches.length?polishNumber(totalMatches[totalMatches.length-1][0]):rowsGross
  if(documentGross>0&&Math.abs(documentGross-rowsGross)>.1)warnings.push(`Suma odczytanych pozycji (${rowsGross.toFixed(2)} zł) różni się od wartości dokumentu (${documentGross.toFixed(2)} zł). Sprawdź, czy OCR nie pominął wiersza.`)
  return{
    supplier_name:findSupplier(lines,documentIndex),
    document_no:documentMatch?.[1]||'',
    document_date:dateMatch?.[1]?.split(/[./-]/).reverse().join('-')||'',
    currency:/\bPLN\b/i.test(text)?'PLN':'PLN',
    gross_total:documentGross,
    items:rows,
    warnings,
    raw_text:text
  }
}

const normalizedName=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Ł]/gi,'L').replace(/[^A-Z0-9]/gi,'').toUpperCase()
const nameTokens=value=>new Set(String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Ł]/gi,'L').toUpperCase().match(/[A-Z0-9]{3,}/g)||[])
function diceSimilarity(left,right){
  const a=normalizedName(left),b=normalizedName(right)
  if(a===b)return 1
  if(a.length<2||b.length<2)return 0
  const pairs=new Map()
  for(let index=0;index<a.length-1;index++){const pair=a.slice(index,index+2);pairs.set(pair,(pairs.get(pair)||0)+1)}
  let overlap=0
  for(let index=0;index<b.length-1;index++){const pair=b.slice(index,index+2),count=pairs.get(pair)||0;if(count){pairs.set(pair,count-1);overlap++}}
  return 2*overlap/(a.length+b.length-2)
}
function itemSimilarity(left,right){
  if(textKey(left.part_no)&&textKey(left.part_no)===textKey(right.part_no))return 1
  if(Math.abs(Number(left.qty)-Number(right.qty))>.01||Math.abs(Number(left.gross_total)-Number(right.gross_total))>.1)return 0
  const a=nameTokens(left.name),b=nameTokens(right.name),shared=[...a].filter(token=>b.has(token)).length
  const tokenScore=shared>=2?shared/Math.max(1,Math.min(a.size,b.size)):0
  return Math.max(tokenScore,diceSimilarity(left.name,right.name))
}
function mergeDocumentRows(primary,detail){
  const merged=primary.items.map(item=>({...item})),matched=new Set()
  for(const candidate of detail.items){
    let bestIndex=-1,bestScore=0
    merged.forEach((item,index)=>{if(matched.has(index))return;const score=itemSimilarity(item,candidate);if(score>bestScore){bestIndex=index;bestScore=score}})
    if(bestIndex<0||bestScore<.55){matched.add(merged.length);merged.push(candidate);continue}
    matched.add(bestIndex)
    const existing=merged[bestIndex]
    if(existing.confidence==='GOOD'&&candidate.confidence!=='GOOD')continue
    if(candidate.confidence==='GOOD'&&existing.confidence!=='GOOD'){merged[bestIndex]=candidate;continue}
    merged[bestIndex]=candidate.name.length>=existing.name.length?candidate:existing
  }
  return merged.sort((left,right)=>String(left.source_line||'').localeCompare(String(right.source_line||''),undefined,{numeric:true}))
}


module.exports={textKey,roundMoney,polishNumber,normalizeOcrText,parseDeliveryDocument,mergeDocumentRows}
