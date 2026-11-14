// Ustawienia ekranu „Hala na żywo”: powitanie, nazwa warsztatu, akcent oraz przypisanie zleceń do stanowisk.
// Zapisywane w app_settings (klucz hala_v1), więc synchronizują się między PC a PWA jak inne ustawienia.
// Zlecenie wskazujemy po cloud_id (wspólne dla wszystkich urządzeń) z lokalnym id jako zapasem.

const HALA_SETTINGS_KEY='hala_v1'
const HALA_SETTINGS_CLOUD_ID='hala-v1'
const HALA_ACCENTS=['#F43F5E','#3EE0C8','#4DA3FF','#F5B544']
const DEFAULT_HALA_SETTINGS=Object.freeze({greetingName:'',workshopName:'',accent:HALA_ACCENTS[0],assignments:Object.freeze({})})

const cleanText=(value,max)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max)
// klucz stanowiska: ta sama normalizacja przy zapisie i odczycie
const bayKey=name=>cleanText(name,60)

function normalizeAssignment(value){
 if(!value||typeof value!=='object')return null
 const orderCloudId=cleanText(value.orderCloudId,80)
 const orderId=value.orderId==null||value.orderId===''?'':cleanText(value.orderId,80)
 if(!orderCloudId&&!orderId)return null
 return{orderCloudId,orderId,assignedAt:cleanText(value.assignedAt,40)}
}

function normalizeHalaSettings(input={}){
 const source=input&&typeof input==='object'?input:{}
 const accent=HALA_ACCENTS.includes(String(source.accent||'').toUpperCase())?String(source.accent).toUpperCase():DEFAULT_HALA_SETTINGS.accent
 const assignments={}
 if(source.assignments&&typeof source.assignments==='object'){
  for(const [bay,value] of Object.entries(source.assignments).slice(0,20)){
   const name=cleanText(bay,60),assignment=normalizeAssignment(value)
   if(name&&assignment)assignments[name]=assignment
  }
 }
 return{greetingName:cleanText(source.greetingName,40),workshopName:cleanText(source.workshopName,60),accent,assignments}
}

function parseHalaSettings(value){
 try{return normalizeHalaSettings(typeof value==='string'?JSON.parse(value):value)}
 catch{return normalizeHalaSettings()}
}

// Przypisanie/zwolnienie stanowiska bez naruszania pozostałych ustawień
function assignBay(settings,bay,order){
 const current=normalizeHalaSettings(settings),name=bayKey(bay)
 if(!name)return current
 const assignments={...current.assignments}
 if(order){
  // auto stoi na jednym stanowisku: przypisanie przenosi je z poprzedniego
  const target={orderCloudId:cleanText(order.cloud_id||'',80),orderId:order.id==null?'':String(order.id)}
  for(const [key,value] of Object.entries(assignments))if(key!==name&&(sameOrder(value,order)||(target.orderCloudId&&value.orderCloudId===target.orderCloudId)))delete assignments[key]
  assignments[name]={orderCloudId:cleanText(order.cloud_id||'',80),orderId:order.id==null?'':String(order.id),assignedAt:new Date().toISOString()}
 }
 else delete assignments[name]
 return normalizeHalaSettings({...current,assignments})
}

// cloud_id ma pierwszeństwo: lokalne id na innym komputerze może wskazywać inne zlecenie
function sameOrder(assignment,order){
 if(!assignment||!order)return false
 if(assignment.orderCloudId)return String(order.cloud_id||'')===assignment.orderCloudId||String(order.id)===assignment.orderCloudId
 return Boolean(assignment.orderId)&&String(order.id)===assignment.orderId
}

module.exports={bayKey,HALA_SETTINGS_KEY,HALA_SETTINGS_CLOUD_ID,HALA_ACCENTS,DEFAULT_HALA_SETTINGS,normalizeHalaSettings,parseHalaSettings,assignBay,sameOrder}
