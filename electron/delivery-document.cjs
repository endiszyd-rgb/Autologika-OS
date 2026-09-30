const fs=require('fs')
const path=require('path')
const {wholePartQuantity}=require('./part-quantity.cjs')
const crypto=require('crypto')

const textKey=value=>String(value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9]/gi,'').toUpperCase()
const roundMoney=value=>Math.round((Number(value)||0)*100)/100
const polishNumber=value=>{
  const normalized=String(value||'').trim().replace(/\s/g,'').replace(/(?<=\d)[:](?=\d{2}\b)/g,'.').replace(',','.')
  const number=Number(normalized.replace(/[^\d.-]/g,''))
  return Number.isFinite(number)?number:0
}

function documentHash(filePath){return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}

function normalizeOcrText(value){
  return String(value||'').replace(/\r/g,'').replace(/[„”]/g,'"').replace(/(?<=\d):(?=\d{2}\b)/g,'.').replace(/[ \t]+/g,' ').split('\n').map(line=>line.trim()).filter(Boolean).join('\n')
}

function findSupplier(lines,documentIndex){
  const before=lines.slice(0,Math.max(0,documentIndex)).filter(line=>!/(sprzedaw|adres|nip|regon|konto|bank|telefon|tel\.|email|polica|data|wydruk)/i.test(line))
  const strong=before.find(line=>/[A-ZĄĆĘŁŃÓŚŹŻ]{3}/.test(line)&&/[a-ząćęłńóśźż]{2}/i.test(line)&&line.length>=6&&line.length<=90)
  return strong?.replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]+/,'').trim()||''
}

function parseItemLine(line){
  const normalized=line.replace(/[|;]/g,' ').replace(/(?<=\d):(?=\d{2}\b)/g,'.').replace(/\s+/g,' ').trim()
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
    if(value.length>=4&&/[A-ZĄĆĘŁŃÓŚŹŻ]/i.test(value)&&/\d/.test(value)&&!/^SZT$/i.test(value)){codeToken=token;break}
  }
  if(!codeToken)return null
  const partNo=codeToken[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[Ł]/gi,'L').replace(/^[^A-Z0-9]+|[^A-Z0-9./-]+$/gi,'').toUpperCase()
  let name=prefix.slice(codeToken.index+codeToken[0].length).replace(/^[^A-ZĄĆĘŁŃÓŚŹŻ]+/i,'').replace(/[|;]/g,' ').replace(/\s+/g,' ').trim()
  if(!name||name.length<3)return null
  const values=decimals.slice(qtyIndex).map(match=>polishNumber(match[0]))
  const qty=values[0],scannedUnitCost=values[1],netTotal=values[2]
  const vatMatch=normalized.slice(qtyMatch.index).match(/(?:^|\s)(8|23)(?:\s|$)/)
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
  const merged=primary.items.map(item=>({...item}))
  for(const candidate of detail.items){
    let bestIndex=-1,bestScore=0
    merged.forEach((item,index)=>{const score=itemSimilarity(item,candidate);if(score>bestScore){bestIndex=index;bestScore=score}})
    if(bestIndex<0||bestScore<.55){merged.push(candidate);continue}
    const existing=merged[bestIndex]
    if(existing.confidence==='GOOD'&&candidate.confidence!=='GOOD')continue
    if(candidate.confidence==='GOOD'&&existing.confidence!=='GOOD'){merged[bestIndex]=candidate;continue}
    merged[bestIndex]=candidate.name.length>=existing.name.length?candidate:existing
  }
  return merged.sort((left,right)=>String(left.source_line||'').localeCompare(String(right.source_line||''),undefined,{numeric:true}))
}

async function recognizeDeliveryDocument(filePath,{cachePath,onProgress=()=>{},tableRectangle=null}={}){
  const {createWorker,PSM}=require('tesseract.js')
  const language=require('@tesseract.js-data/pol')
  fs.mkdirSync(cachePath,{recursive:true})
  let worker
  try{
    worker=await createWorker(language.code,1,{langPath:language.langPath,gzip:language.gzip,cachePath,logger:message=>onProgress({status:message.status,progress:Number(message.progress||0)})})
    await worker.setParameters({preserve_interword_spaces:'1'})
    const result=await worker.recognize(filePath,{rotateAuto:true},{text:true})
    const primary=parseDeliveryDocument(result.data.text)
    if(tableRectangle?.width>0&&tableRectangle?.height>0){
      onProgress({status:'Ponowna kontrola tabeli',progress:.72})
      await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:PSM.SINGLE_BLOCK})
      const detailResult=await worker.recognize(filePath,{rectangle:tableRectangle},{text:true})
      primary.items=mergeDocumentRows(primary,parseDeliveryDocument(detailResult.data.text))
      const rowsGross=roundMoney(primary.items.reduce((sum,item)=>sum+Number(item.gross_total||0),0))
      primary.warnings=[]
      if(primary.items.some(item=>item.confidence==='CHECK'))primary.warnings.push('Co najmniej jeden numer lub cena wymaga sprawdzenia z dokumentem.')
      if(primary.gross_total>0&&Math.abs(primary.gross_total-rowsGross)>.1)primary.warnings.push(`Suma odczytanych pozycji (${rowsGross.toFixed(2)} zł) różni się od wartości dokumentu (${primary.gross_total.toFixed(2)} zł). Sprawdź, czy OCR nie pominął wiersza.`)
    }
    return{...primary,ocr_confidence:roundMoney(result.data.confidence||0)}
  }finally{if(worker)await worker.terminate()}
}

function defaultMarkup(cost){return cost<50?.45:cost<200?.35:cost<500?.28:.22}

function importDeliveryDocument(db,payload,{markup=defaultMarkup}={}){
  const document=payload?.document||{},hash=String(payload?.source_hash||'').trim(),items=(document.items||[]).filter(item=>item?.enabled!==false)
  if(!hash)throw new Error('Brakuje identyfikatora skanowanego dokumentu.')
  if(!items.length)throw new Error('Dokument nie zawiera pozycji wybranych do importu.')
  const duplicate=db.prepare('SELECT id,external_document_no FROM purchase_orders WHERE source_hash=?').get(hash)
  if(duplicate){const error=new Error(`Ten dokument został już przyjęty do magazynu${duplicate.external_document_no?` jako ${duplicate.external_document_no}`:''}.`);error.code='DUPLICATE_DOCUMENT';throw error}
  const cleanItems=items.map((item,index)=>{
    const partNo=String(item.part_no||'').trim(),name=String(item.name||'').trim(),qty=Number(item.qty),unitCost=Number(item.unit_cost),grossTotal=Number(item.gross_total||0)
    if(!partNo)throw new Error(`Pozycja ${index+1}: uzupełnij numer katalogowy.`)
    if(!name)throw new Error(`Pozycja ${index+1}: uzupełnij nazwę części.`)
    wholePartQuantity(qty,{label:`Pozycja ${index+1}: ilość części`})
    if(!Number.isFinite(unitCost)||unitCost<0)throw new Error(`Pozycja ${index+1}: cena zakupu jest niepoprawna.`)
    return{...item,part_no:partNo,name,qty,unit_cost:roundMoney(unitCost),gross_total:roundMoney(grossTotal)}
  })
  return db.transaction(()=>{
    const supplierName=String(document.supplier_name||'').trim()||'Dostawca z dokumentu'
    let supplier=db.prepare('SELECT * FROM suppliers WHERE trim(name)=? COLLATE NOCASE').get(supplierName)
    if(!supplier){const result=db.prepare('INSERT INTO suppliers(name,notes) VALUES (?,?)').run(supplierName,'Utworzono automatycznie podczas importu dokumentu dostawy.');supplier={id:result.lastInsertRowid,name:supplierName}}
    if(String(document.document_no||'').trim()){
      const numberDuplicate=db.prepare('SELECT id FROM purchase_orders WHERE supplier_id=? AND trim(external_document_no)=? COLLATE NOCASE').get(supplier.id,String(document.document_no).trim())
      if(numberDuplicate){const error=new Error(`Dokument ${document.document_no} tego dostawcy został już przyjęty do magazynu.`);error.code='DUPLICATE_DOCUMENT';throw error}
    }
    const order=db.prepare(`INSERT INTO purchase_orders(supplier_id,status,ordered_at,notes,external_document_no,document_date,source_file,source_hash,gross_total)
      VALUES (?,'ODEBRANE',?,?,?,?,?,?,?)`).run(supplier.id,document.document_date||new Date().toISOString(),`Automatyczny import OCR · ${path.basename(payload.source_file||'dokument')}`,document.document_no||'',document.document_date||null,payload.source_file||'',hash,roundMoney(document.gross_total||0))
    const allParts=db.prepare('SELECT * FROM inventory_parts').all(),byNumber=new Map(allParts.filter(part=>textKey(part.part_no)).map(part=>[textKey(part.part_no),part]))
    const insertPart=db.prepare(`INSERT INTO inventory_parts(part_no,name,category,lookup_source,stock,min_stock,unit_cost,sell_price,supplier_id,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    const updatePart=db.prepare(`UPDATE inventory_parts SET stock=?,unit_cost=?,supplier_id=COALESCE(supplier_id,?),updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    const insertItem=db.prepare(`INSERT INTO purchase_order_items(purchase_order_id,inventory_part_id,part_no,name,qty,unit_cost,received_qty) VALUES (?,?,?,?,?,?,?)`)
    let created=0,updated=0
    for(const item of cleanItems){
      let part=byNumber.get(textKey(item.part_no)),partId
      if(part){
        const oldStock=Number(part.stock||0),newStock=oldStock+item.qty
        const weighted=newStock>0?roundMoney((oldStock*Number(part.unit_cost||0)+item.qty*item.unit_cost)/newStock):item.unit_cost
        updatePart.run(newStock,weighted,supplier.id,part.id);partId=part.id;part={...part,stock:newStock,unit_cost:weighted};byNumber.set(textKey(item.part_no),part);updated++
      }else{
        const sellPrice=roundMoney(item.unit_cost*(1+markup(item.unit_cost)))
        const inserted=insertPart.run(item.part_no,item.name,'Części samochodowe','Dokument dostawy OCR',item.qty,0,item.unit_cost,sellPrice,supplier.id,`Dostawa ${document.document_no||'bez numeru'} · ${document.document_date||new Date().toISOString().slice(0,10)}`)
        partId=inserted.lastInsertRowid;part={id:partId,part_no:item.part_no,stock:item.qty,unit_cost:item.unit_cost};byNumber.set(textKey(item.part_no),part);created++
      }
      insertItem.run(order.lastInsertRowid,partId,item.part_no,item.name,item.qty,item.unit_cost,item.qty)
    }
    return{purchase_id:order.lastInsertRowid,supplier_id:supplier.id,supplier_name:supplier.name,created,updated,item_count:cleanItems.length,quantity:cleanItems.reduce((sum,item)=>sum+item.qty,0)}
  })()
}

module.exports={normalizeOcrText,parseDeliveryDocument,recognizeDeliveryDocument,importDeliveryDocument,documentHash,textKey,polishNumber,mergeDocumentRows}
