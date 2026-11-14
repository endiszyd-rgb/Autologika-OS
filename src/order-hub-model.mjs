// AutoLogika UI 2.0 — model widoku zlecenia (karty pojazdu, postęp, finanse, dokumentacja).
// Wyłącznie odczyt i prezentacja danych, które Centrum zlecenia już pobiera.
// Kwoty autorytatywne pochodzą z bazy (order.total, payments); podział na robociznę
// i części jest poglądowy i liczony z pozycji rozliczenia (order_items).

const number=value=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0}
const round2=value=>Math.round((number(value)+Number.EPSILON)*100)/100

// Kolejność etapów zgodna z obiegiem zlecenia (statuses w main.jsx).
export const ORDER_FLOW=Object.freeze(['PRZYJETE','DIAGNOZA','WYCENA','AKCEPTACJA','NAPRAWA','QC_NAPRAWY','QC_WYDANIA','PLATNOSC','GOTOWE','WYDANE'])
// Skrócone etapy do paska postępu (czytelne także na telefonie).
export const ORDER_MILESTONES=Object.freeze([
 {key:'intake',label:'Przyjęcie',statuses:['PRZYJETE']},
 {key:'diagnosis',label:'Diagnoza',statuses:['DIAGNOZA']},
 {key:'quote',label:'Wycena',statuses:['WYCENA','AKCEPTACJA']},
 {key:'repair',label:'Naprawa',statuses:['NAPRAWA']},
 {key:'qc',label:'Kontrola',statuses:['QC_NAPRAWY','QC_WYDANIA']},
 {key:'payment',label:'Płatność',statuses:['PLATNOSC','GOTOWE']},
 {key:'release',label:'Wydanie',statuses:['WYDANE']}
])
export const WAIT_LABELS=Object.freeze({BRAK:'',KLIENT:'Czeka na klienta',CZESCI:'Czeka na części',DECYZJA:'Czeka na decyzję'})

export function orderProgress(status,waitState='BRAK'){
 const key=String(status||'PRZYJETE').toUpperCase()
 const currentIndex=Math.max(0,ORDER_MILESTONES.findIndex(step=>step.statuses.includes(key)))
 const released=key==='WYDANE'
 const steps=ORDER_MILESTONES.map((step,index)=>({...step,state:released||index<currentIndex?'done':index===currentIndex?'current':'todo'}))
 const flowIndex=Math.max(0,ORDER_FLOW.indexOf(key))
 const percent=released?100:Math.round(flowIndex/(ORDER_FLOW.length-1)*100)
 const wait=String(waitState||'BRAK').toUpperCase()
 return{steps,currentIndex,percent,waiting:Boolean(WAIT_LABELS[wait]),waitLabel:WAIT_LABELS[wait]||''}
}

// Jedna klasyfikacja pozycji rozliczenia (te same rodzaje co w electron/main.cjs i pwa-data.mjs).
export function itemCategory(item){
 const kind=String(item?.kind||'').toUpperCase()
 if(kind==='ROBOCIZNA')return 'labor'
 if(kind==='CZESC'||kind==='MATERIAL')return 'parts'
 return 'other'
}
const kindOf=itemCategory
const itemValue=item=>round2(number(item?.qty??1)*number(item?.unit_price))

const hasOrderBreakdown=order=>['labor_hours','parts_sale','other_sale','diagnosis_fee','discount'].some(key=>order?.[key]!==undefined&&order?.[key]!==null)

// Podział kwoty zlecenia według tych samych reguł co raporty PC (electron/main.cjs) i model PWA (pwa-data.mjs):
// • suma = order.total (ORDER_TOTAL_SQL / orderMoney) — zawsze autorytatywna,
// • części = parts_sale, robocizna = pozycje ROBOCIZNA + robocizna z kolumn zlecenia (legacy),
// • inne = other_sale − robocizna z pozycji (other_sale obejmuje wszystkie pozycje poza częściami),
// • diagnoza = diagnosis_fee, rabat = discount, a cena końcowa ustawiona ręcznie jest jawną korektą.
// Rekordy bez kolumn składowych dostają podział poglądowy z pozycji.
export function orderFinance({order={},items=[],payments=[]}={}){
 const total=round2(order.total)
 const paid=round2(payments.reduce((sum,payment)=>sum+number(payment.amount),0))
 const balance=round2(Math.max(0,total-paid))
 const finalPriceSet=order.final_price!==null&&order.final_price!==undefined&&String(order.final_price).trim()!==''
 const exact=hasOrderBreakdown(order)
 const itemSplit={labor:0,parts:0,other:0}
 for(const item of items)itemSplit[kindOf(item)]+=itemValue(item)
 for(const key of Object.keys(itemSplit))itemSplit[key]=round2(itemSplit[key])
 const split={labor:0,parts:0,other:0}
 let diagnosis=0,discount=0
 if(exact){
  // PWA podaje legacy_labor już po regule „brak pozycji robocizny”; PC liczy kolumny zawsze.
  const legacyLabor=order.legacy_labor!==undefined&&order.legacy_labor!==null?round2(order.legacy_labor):round2(number(order.labor_hours)*number(order.labor_rate))
  split.labor=round2(itemSplit.labor+legacyLabor)
  split.parts=round2(order.parts_sale)
  split.other=round2(Math.max(0,number(order.other_sale)-itemSplit.labor))
  diagnosis=round2(order.diagnosis_fee)
  discount=round2(order.discount)
 }else Object.assign(split,itemSplit)
 const itemized=round2(split.labor+split.parts+split.other+diagnosis)
 const calculated=round2(itemized-discount)
 const shares=percentShares([split.labor,split.parts,split.other+diagnosis])
 return{
  total,paid,balance,finalPriceSet,exact,
  overpaid:round2(Math.max(0,paid-total)),
  // Zlecenie bez kwoty do zapłaty (także darmowe, cena końcowa 0 zł) jest rozliczone — jak w nagłówku zlecenia.
  settled:balance<=0.01,
  paidPercent:total>0?Math.min(100,Math.round(paid/total*100)):100,
  split,diagnosis,discount,itemized,calculated,shares,
  adjustments:round2(total-calculated)
 }
}

// Procenty sumujące się dokładnie do 100 (metoda największej reszty).
export function percentShares(values){
 const safe=values.map(value=>Math.max(0,number(value))),sum=safe.reduce((a,b)=>a+b,0)
 if(!sum)return{labor:0,parts:0,other:0}
 const raw=safe.map(value=>value/sum*100),floor=raw.map(Math.floor)
 let rest=100-floor.reduce((a,b)=>a+b,0)
 raw.map((value,index)=>[value-floor[index],index]).sort((a,b)=>b[0]-a[0]).forEach(([,index])=>{if(rest>0){floor[index]++;rest--}})
 return{labor:floor[0],parts:floor[1],other:floor[2]}
}

export function partStats(parts=[]){
 const closed=new Set(['ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE'])
 const waiting=new Set(['DO_ZAMOWIENIA','ZAMOWIONE','W_DRODZE'])
 let open=0,pending=0,mounted=0
 for(const part of parts){const status=String(part?.status||'').toUpperCase();if(status==='ZAMONTOWANE')mounted++;if(!closed.has(status)){open++;if(waiting.has(status))pending++}}
 return{total:parts.length,open,pending,mounted}
}

export const DOC_CATEGORIES=Object.freeze([['PRZYJECIE','Przyjęcie'],['DIAGNOZA','Diagnoza'],['NAPRAWA','Naprawa'],['WYDANIE','Wydanie']])
const IMAGE_EXT=/\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i
export const isImageFile=file=>String(file?.mime||'').toLowerCase().startsWith('image/')||IMAGE_EXT.test(String(file?.name||''))

export const docCategory=file=>{const key=String(file?.category||'PRZYJECIE').toUpperCase();return DOC_CATEGORIES.some(([value])=>value===key)?key:'PRZYJECIE'}
export const newestFirst=files=>[...files].sort((a,b)=>String(b?.created_at||'').localeCompare(String(a?.created_at||'')))

export function documentationStats(files=[]){
 const byCategory=Object.fromEntries(DOC_CATEGORIES.map(([key])=>[key,{photos:0,files:0}]))
 let photos=0,cloud=0
 for(const file of files){
  const category=byCategory[docCategory(file)]
  if(isImageFile(file)){photos++;category.photos++}else category.files++
  if(file?.storage_path)cloud++
 }
 const missing=DOC_CATEGORIES.filter(([key])=>!byCategory[key].photos&&!byCategory[key].files).map(([key])=>key)
 return{total:files.length,photos,documents:files.length-photos,cloud,byCategory,missing}
}

export function vehicleSpecs(vehicle={}){
 const specs=[]
 if(vehicle.generation)specs.push(['Generacja',String(vehicle.generation)])
 if(vehicle.year)specs.push(['Rocznik',String(vehicle.year)])
 const engine=[vehicle.engine,vehicle.power_hp?`${number(vehicle.power_hp)} KM`:''].filter(Boolean).join(' · ')
 if(engine)specs.push(['Silnik',engine])
 if(vehicle.engine_code)specs.push(['Kod silnika',String(vehicle.engine_code)])
 if(number(vehicle.mileage)>0)specs.push(['Przebieg',`${number(vehicle.mileage).toLocaleString('pl-PL')} km`])
 return specs
}

export function vehicleTitle(vehicle={}){
 return [vehicle.make,vehicle.model].filter(Boolean).join(' ')||'Pojazd bez opisu'
}

// Kafelki sekcji zlecenia: naprawy, części, koszty, dokumentacja.
export function orderSections({repairs=[],items=[],parts=[],files=[],finance,procedures}={}){
 const labor=items.filter(item=>kindOf(item)==='labor').length
 const stats=partStats(parts),docs=documentationStats(files)
 return [
  {key:'works',tab:'works',label:'Naprawy',value:repairs.length||labor,detail:repairs.length?`${repairs.length} napraw · ${labor} pozycji robocizny`:labor?`${labor} pozycji robocizny`:'Dodaj pierwszą naprawę',tone:procedures?.remaining>0?'warning':repairs.length||labor?'accent':'neutral'},
  {key:'parts',tab:'parts',label:'Części',value:stats.open,detail:stats.total?`${stats.pending} w zamówieniu · ${stats.mounted} zamontowanych`:'Brak przypisanych części',tone:stats.pending?'warning':stats.total?'accent':'neutral'},
  {key:'costs',tab:'settlement',label:'Koszty',value:finance?finance.total:0,money:true,detail:finance?(finance.settled?'Rozliczone':finance.paid>0?`Wpłacono ${finance.paidPercent}%`:'Brak wpłat'):'—',tone:finance?.settled&&finance.total>0?'success':finance?.paid>0?'info':'neutral'},
  {key:'docs',tab:'docs',label:'Dokumentacja',value:docs.photos,detail:docs.total?`${docs.photos} zdjęć · ${docs.documents} dokumentów`:'Brak zdjęć z przyjęcia',tone:docs.byCategory.PRZYJECIE.photos?'accent':'warning'}
 ]
}
