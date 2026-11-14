// Czysta logika prezentacji modułu „Części i magazyn”.
// Nie zmienia danych ani reguł biznesowych — tylko klasyfikuje, sumuje i filtruje
// to, co zwracają api.inventory.list(), api.deliveryDocuments.list() i api.jobParts.list().

const num=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0}
const text=value=>String(value??'').trim()
const locale='pl-PL'

export const STOCK_FILTERS=[
 ['ALL','Wszystkie'],
 ['LOW','Do uzupełnienia'],
 ['OUT','Brak na stanie'],
 ['NO_LOCATION','Bez lokalizacji']
]

export const STOCK_SORTS=[
 ['name','Nazwa A–Z'],
 ['stock','Najniższy stan'],
 ['value','Najwyższa wartość'],
 ['location','Lokalizacja']
]

// Ta sama reguła co dotychczasowy licznik „Niski stan” i klasa .low: stan <= minimum.
// Celowo surowe Number(): brakująca wartość (NaN) nie jest „niskim stanem”, tak jak w dotychczasowym kodzie.
export const isLowStock=row=>Number(row?.stock)<=Number(row?.min_stock)
export const isOutOfStock=row=>Number(row?.stock)<=0
export const stockValue=row=>num(row?.stock)*num(row?.unit_cost)

export function stockLevel(row){
 const stock=num(row?.stock),min=num(row?.min_stock)
 const target=Math.max(min*2,stock,1)
 const percent=stock<=0?0:Math.max(4,Math.min(100,Math.round(stock/target*100)))
 const minMark=min>0?Math.min(100,Math.round(min/target*100)):null
 if(isOutOfStock(row))return{state:'out',tone:'danger',label:'Brak na stanie',hint:min>0?`Zamów min. ${fmt(min)} szt.`:'Brak sztuk w magazynie',percent,minMark}
 if(isLowStock(row))return{state:'low',tone:'warning',label:'Do uzupełnienia',hint:`Minimum ${fmt(min)} szt.`,percent,minMark}
 return{state:'ok',tone:'success',label:'Na stanie',hint:min>0?`Minimum ${fmt(min)} szt.`:'Bez ustalonego minimum',percent,minMark}
}

const fmt=value=>num(value).toLocaleString(locale)

export function stockSummary(rows=[]){
 return rows.reduce((sum,row)=>({
  positions:sum.positions+1,
  units:sum.units+Math.max(0,num(row.stock)),
  value:sum.value+stockValue(row),
  low:sum.low+(isLowStock(row)?1:0),
  out:sum.out+(isOutOfStock(row)?1:0),
  noLocation:sum.noLocation+(text(row.location)?0:1)
 }),{positions:0,units:0,value:0,low:0,out:0,noLocation:0})
}

const matchesFilter={
 ALL:()=>true,
 LOW:isLowStock,
 OUT:isOutOfStock,
 NO_LOCATION:row=>!text(row.location)
}

const compareText=(a,b)=>text(a).localeCompare(text(b),locale,{sensitivity:'base',numeric:true})
const sorters={
 name:(a,b)=>compareText(a.name,b.name),
 stock:(a,b)=>num(a.stock)-num(b.stock)||compareText(a.name,b.name),
 value:(a,b)=>stockValue(b)-stockValue(a)||compareText(a.name,b.name),
 // puste lokalizacje na końcu, żeby zestawienie do inwentaryzacji szło półka po półce
 location:(a,b)=>(text(a.location)?0:1)-(text(b.location)?0:1)||compareText(a.location,b.location)||compareText(a.name,b.name)
}

export function filterStock(rows=[],{filter='ALL',sort='name'}={}){
 const keep=matchesFilter[filter]||matchesFilter.ALL,order=sorters[sort]||sorters.name
 return rows.filter(keep).sort(order)
}

export function filterCounts(rows=[]){
 return Object.fromEntries(STOCK_FILTERS.map(([key])=>[key,rows.filter(matchesFilter[key]).length]))
}

// --- Dokumenty dostaw -------------------------------------------------------

const lower=value=>text(value).toLocaleLowerCase(locale)

export function filterDeliveries(rows=[],{query='',supplier=''}={}){
 const needle=lower(query)
 return rows.filter(row=>{
  if(supplier&&text(row.supplier_name)!==supplier)return false
  if(!needle)return true
  // te same pola co dotychczasowa wyszukiwarka historii dostaw
  return [row.supplier_name,row.document_no,row.document_date,...(row.items||[]).flatMap(item=>[item.part_no,item.name])].some(value=>lower(value).includes(needle))
 })
}

export function deliveryStats(rows=[]){
 const suppliers=[...new Set(rows.map(row=>text(row.supplier_name)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,locale))
 return{
  documents:rows.length,
  gross:rows.reduce((sum,row)=>sum+num(row.gross_total),0),
  quantity:rows.reduce((sum,row)=>sum+num(row.quantity),0),
  suppliers
 }
}

export const deliveryLineTotal=item=>num(item?.gross_total)||num(item?.qty)*num(item?.unit_cost)

export function deliveryPreview(row={}){
 const items=Array.isArray(row.items)?row.items:[]
 const itemsTotal=num(row.items_gross_total)||items.reduce((sum,item)=>sum+deliveryLineTotal(item),0)
 const documentTotal=num(row.gross_total)
 const difference=documentTotal&&itemsTotal?Math.round((documentTotal-itemsTotal)*100)/100:0
 return{
  items,
  itemCount:num(row.item_count)||items.length,
  quantity:num(row.quantity)||items.reduce((sum,item)=>sum+num(item.qty),0),
  itemsTotal,
  documentTotal,
  difference,
  balanced:Math.abs(difference)<0.01,
  hasScan:Boolean(row.file_path||row.storage_path)
 }
}

// --- Mobilne skanowanie faktur ----------------------------------------------

export const CAPTURE_STEPS=['Zdjęcie','Odczyt','Sprawdzenie','Przyjęcie']

export function captureStep({file,ocrBusy,ocr,saved,busy}={}){
 if(saved)return 4
 if(busy&&ocr)return 3
 if(ocr&&!ocrBusy)return 2
 if(file)return 1
 return 0
}

export function deliveryReviewSummary(document){
 const items=Array.isArray(document?.items)?document.items:[]
 const selected=items.filter(item=>item.enabled!==false)
 return{
  total:items.length,
  selected:selected.length,
  quantity:selected.reduce((sum,item)=>sum+num(item.qty),0),
  net:selected.reduce((sum,item)=>sum+num(item.qty)*num(item.unit_cost),0),
  toCheck:items.filter(item=>item.confidence==='CHECK').length,
  // ta sama reguła ilości co w imporcie na PC: pełne sztuki > 0
  invalid:selected.filter(item=>!Number.isInteger(Number(item.qty))||Number(item.qty)<=0).length
 }
}

export function stepQuantity(value,delta){
 const current=Math.trunc(num(value))
 return Math.max(1,current+delta)
}

// --- Części do zleceń -------------------------------------------------------

export const PART_STATUS_TONES={
 DO_ZAMOWIENIA:'warning',
 ZAMOWIONE:'info',
 W_DRODZE:'violet',
 ODEBRANE:'success',
 ZAMONTOWANE:'neutral',
 DO_ZWROTU:'danger',
 ZWROT_ZAKONCZONY:'neutral',
 ANULOWANE:'neutral'
}

export const partStatusTone=status=>PART_STATUS_TONES[status]||'neutral'
