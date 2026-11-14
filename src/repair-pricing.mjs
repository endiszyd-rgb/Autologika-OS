export const PRICING_KEY='__repair_pricing_v1'
export const DEFAULT_PRICING=Object.freeze({hourlyRate:null,corrosionMultiplier:1,accessMultiplier:1})
const number=(value,label,min,max)=>{
 if(value===null||value===undefined||String(value).trim()==='')throw new Error(`Uzupełnij: ${label}.`)
 const n=Number(value)
 if(!Number.isFinite(n)||n<min||n>max)throw new Error(`Nieprawidłowa wartość: ${label}.`)
 return n
}
export function validatePricing(value){return {
 hourlyRate:number(value.hourlyRate,'stawka roboczogodziny',0,100000),
 corrosionMultiplier:number(value.corrosionMultiplier,'mnożnik korozji',1,10),
 accessMultiplier:number(value.accessMultiplier,'mnożnik dostępu',1,10)
}}
export function calculateLabor({hours,hourlyRate,corrosionMultiplier=1,accessMultiplier=1,manualPrice=null,reason=''}){
 const h=number(hours,'czas szacowany',.01,10000)
 const manual=manualPrice!==null&&manualPrice!==undefined&&manualPrice!==''
 const config=validatePricing({hourlyRate:manual&&hourlyRate==null?0:hourlyRate,corrosionMultiplier,accessMultiplier})
 if(manual&&!String(reason).trim())throw new Error('Podaj uzasadnienie ceny ręcznej.')
 const total=manual?number(manualPrice,'cena ręczna',0,100000000):h*config.hourlyRate*config.corrosionMultiplier*config.accessMultiplier
 if(total>100000000)throw new Error('Wartość pracy przekracza limit.')
 const amount=Math.round((total+Number.EPSILON)*100)/100
 return {hours:h,...config,total:amount,effectiveRate:amount/h,manual,reason:String(reason).trim(),timeSource:'WORKSHOP_ESTIMATE'}
}
/** Bundled prices are examples, never a production fallback. */
export function resolveCatalogVariant(group,job,variant,overrides={},legacyPrices={}){
 const own=overrides[variant.id]||{},key=`${group}::${job.name}::${variant.name}`
 const price=Object.hasOwn(own,'price')?own.price:Object.hasOwn(legacyPrices,key)?legacyPrices[key]:null
 return {...variant,...own,price:price==null?null:number(price,'cena warsztatu',0,100000000),timeSource:'WORKSHOP_ESTIMATE',priceSource:price==null?'UNCONFIGURED':'WORKSHOP'}
}
export function pricingDescription(result){
 return `Kalkulacja warsztatu (czas szacowany, nie norma): ${result.hours} h × ${result.hourlyRate} zł/h × korozja ${result.corrosionMultiplier} × dostęp ${result.accessMultiplier}; ${result.manual?`cena ręczna: ${result.reason}; `:''}razem ${result.total.toFixed(2)} zł.`
}

export function describePriceHistory(details){
 let event;try{event=JSON.parse(details)}catch{return details||''}
 if(event?.version!==1||!Object.hasOwn(event,'before'))return details
 const before=Array.isArray(event.before)?event.before:event.before?[event.before]:[]
 const after=Array.isArray(event.after)?event.after:event.after?[event.after]:[]
 const label=row=>{
  if(!row)return 'brak pozycji'
  const hours=row.planned_hours??row.labor_hours??row.qty??0,rate=row.labor_rate??row.unit_price??0
  const labor=row.kind==='ROBOCIZNA'||Object.hasOwn(row,'planned_hours')
  const qty=labor?hours:row.qty??0,price=labor?rate:row.unit_price??0
  return `${row.name||row.title||'Pozycja'}: ${qty} ${labor?'h':'szt.'} × ${Number(price).toFixed(2)} zł = ${(qty*price).toFixed(2)} zł`
 }
 const keys=new Set([...before,...after].map(row=>row.id??row.cloud_id??'single'))
 return [...keys].flatMap(key=>{
  const a=before.find(row=>(row.id??row.cloud_id??'single')===key),b=after.find(row=>(row.id??row.cloud_id??'single')===key)
  return JSON.stringify(a)===JSON.stringify(b)?[]:[`${label(a)} → ${label(b)}${b?.technical_description?`\n${b.technical_description}`:''}`]
 }).join('\n')
}
