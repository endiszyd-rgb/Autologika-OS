const {textKey,roundMoney}=require('./delivery-document-parser.cjs')
const number=value=>typeof value==='number'?value:typeof value==='string'&&value.trim()!==''?Number(value.trim().replace(',','.')):NaN

function editDeliveryItem(item,field,value){
 const next={...item,[field]:value}
 if(!['qty','unit_cost','vat_rate','gross_total'].includes(field))return next
 const qty=number(next.qty),vat=number(next.vat_rate??23)
 if(!(qty>0)||!Number.isFinite(vat)||vat<0||vat>100)return next
 if(field==='gross_total'){
  const gross=number(value)
  if(!Number.isFinite(gross)||gross<0)return next
  next.unit_cost=roundMoney(gross/(1+vat/100)/qty)
 }
 const cost=number(next.unit_cost)
 if(!Number.isFinite(cost)||cost<0)return next
 next.net_total=roundMoney(qty*cost)
 next.vat_amount=roundMoney(next.net_total*vat/100)
 if(field!=='gross_total')next.gross_total=roundMoney(next.net_total+next.vat_amount)
 return next
}

function validateDelivery(document){
 const items=(document?.items||[]).filter(item=>item.enabled!==false)
 if(!items.length)throw new Error('Nie rozpoznano części. Popraw zdjęcie albo dodaj pozycje ręcznie.')
 if(items.length>200)throw new Error('Jedna dostawa może zawierać maksymalnie 200 pozycji.')
 return {...document,items:items.map((item,index)=>{
  const qty=number(item.qty),cost=number(item.unit_cost),vat=number(item.vat_rate??23)
  if(!textKey(item.part_no)||!String(item.name||'').trim()||!Number.isInteger(qty)||qty<=0||qty>100000||!Number.isFinite(cost)||cost<0||cost>100000000)throw new Error(`Pozycja ${index+1}: sprawdź numer, nazwę, ilość (musi być liczbą całkowitą) i cenę netto.`)
  if(!Number.isFinite(vat)||vat<0||vat>100)throw new Error(`Pozycja ${index+1}: sprawdź stawkę VAT.`)
  const net=roundMoney(qty*cost),tax=roundMoney(net*vat/100),gross=roundMoney(net+tax)
  if(item.gross_total!=null&&(!Number.isFinite(number(item.gross_total))||number(item.gross_total)<0||Math.abs(number(item.gross_total)-gross)>qty*.005*(1+vat/100)+.02))throw new Error(`Pozycja ${index+1}: netto i brutto są niespójne. Popraw cenę lub VAT zgodnie z dokumentem.`)
  return {...item,part_no:String(item.part_no).trim(),name:String(item.name).trim(),qty,unit_cost:cost,vat_rate:vat,net_total:net,vat_amount:tax,gross_total:item.gross_total==null?gross:number(item.gross_total)}
 })}
}

function confirmDelivery(document,confirm){
 const clean=validateDelivery(document),seen=new Set(),duplicates=new Set()
 for(const item of clean.items){const key=textKey(item.part_no);if(seen.has(key))duplicates.add(item.part_no);seen.add(key)}
 const qty=clean.items.reduce((sum,item)=>sum+item.qty,0),net=roundMoney(clean.items.reduce((sum,item)=>sum+item.net_total,0)),gross=roundMoney(clean.items.reduce((sum,item)=>sum+item.gross_total,0))
 const warning=duplicates.size?`\nPowtórzone numery części: ${[...duplicates].join(', ')}. Ilości tych wierszy zostaną dodane. Sprawdź, czy OCR nie powielił pozycji.`:''
 const mismatch=number(document.gross_total)>0&&Math.abs(number(document.gross_total)-gross)>.1?'\nSuma wybranych pozycji różni się od sumy dokumentu. Sprawdź pominięte lub wyłączone wiersze.':''
 return confirm(`Potwierdź przyjęcie do magazynu: ${clean.items.length} pozycji, ${qty} szt.\nNetto: ${net.toFixed(2)} zł · brutto: ${gross.toFixed(2)} zł.${warning}${mismatch}\nSprawdziłem numery części, ilości i ceny z dokumentem. Zapisać dostawę i zwiększyć stany?`)?clean:null
}
module.exports={editDeliveryItem,validateDelivery,confirmDelivery}
