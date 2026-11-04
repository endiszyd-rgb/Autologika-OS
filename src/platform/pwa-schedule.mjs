import {sameId} from './pwa-data.mjs'
const json=value=>{try{return typeof value==='string'?JSON.parse(value):value||{}}catch{return {}}}
const overlaps=(a,b)=>new Date(a.start_at)<new Date(b.end_at)&&new Date(b.start_at)<new Date(a.end_at)
export function createPwaSchedule(cloud){
 const list=async(from,to)=>{
  const [appointments,links,resources,vehicles,orders]=await Promise.all(['appointments','appointment_resources','work_resources','vehicles','orders'].map(entity=>cloud.list(entity)))
  return appointments.filter(a=>(!from||new Date(a.end_at)>new Date(from))&&(!to||new Date(a.start_at)<new Date(to))).map(a=>{const vehicle=vehicles.find(v=>sameId(v.id,a.vehicle_id)),order=orders.find(o=>sameId(o.id,a.order_id)),resource_ids=links.filter(r=>sameId(r.appointment_id,a.id)).map(r=>r.resource_id);return {...a,plate:vehicle?.plate||'',make:vehicle?.make||'',model:vehicle?.model||'',order_title:order?.title||'',resource_ids,resource_names:resources.filter(r=>resource_ids.some(id=>sameId(id,r.id))).map(r=>r.name).join(', ')}})
 }
 const save=async(id,input)=>{
  const existing=id?await cloud.get('appointments',id):null,data={...existing,...input},start=new Date(data.start_at),end=new Date(data.end_at),status=({DONE:'ZAKONCZONY',GOTOWE:'ZAKONCZONY',CANCELLED:'ANULOWANY',PROGRESS:'W_TRAKCIE',W_PRACY:'W_TRAKCIE'})[data.status]||data.status||'PLAN'
  if(!String(data.title||'').trim()||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start||!['PLAN','POTWIERDZONY','W_TRAKCIE','ZAKONCZONY','ANULOWANY'].includes(status))throw new Error('Podaj opis i poprawny termin wizyty.')
  let vehicleId=data.vehicle_id||null
  if(data.order_id){const order=await cloud.get('orders',data.order_id);if(!order)throw new Error('Wybrane zlecenie nie istnieje.');if(vehicleId&&!sameId(vehicleId,order.vehicle_id))throw new Error('Zlecenie dotyczy innego pojazdu.');vehicleId=order.vehicle_id}
  if(vehicleId&&!await cloud.get('vehicles',vehicleId))throw new Error('Wybrany pojazd nie istnieje.')
  const resources=await cloud.list('work_resources'),bay=String(data.bay||'Stanowisko 1'),bayResource=resources.find(r=>r.resource_type==='BAY'&&r.name===bay&&r.active!==0),bayCloud=bayResource?.cloud_id||`pwa-bay:${encodeURIComponent(bay)}`
  const selected=Array.isArray(data.resource_ids)?data.resource_ids:String(data.resource_ids||'').split(',').filter(Boolean),selectedResources=selected.map(r=>resources.find(resource=>sameId(resource.id,r)||resource.cloud_id===r))
  if(selectedResources.some(r=>!r||r.active===0))throw new Error('Wybrany zasób jest niedostępny.')
  const ids=[...new Set([bayCloud,...selectedResources.map(r=>r.cloud_id)])],all=await list(),blocks=await cloud.list('resource_unavailability'),override=Boolean(data.override_conflict&&String(data.override_reason||'').trim())
  if(status!=='ANULOWANY')for(const resource of [bayResource,...selectedResources].filter(Boolean)){
   const conflicts=all.filter(a=>!sameId(a.id,id)&&a.status!=='ANULOWANY'&&overlaps(data,a)&&(a.resource_ids.some(r=>sameId(r,resource.id))||resource.resource_type==='BAY'&&a.bay===resource.name))
   const blocked=blocks.some(b=>sameId(b.resource_id,resource.id)&&overlaps(data,b)),calendar=json(resource.work_calendar_json),parts=date=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value])),s=parts(start),e=parts(end),weekday={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7}[s.weekday],outside=Array.isArray(calendar.weekdays)&&(!calendar.weekdays.includes(weekday)||`${s.hour}:${s.minute}`<calendar.start||`${e.hour}:${e.minute}`>calendar.end||s.weekday!==e.weekday)
   if((conflicts.length>=Math.max(1,Number(resource.capacity)||1)||blocked||outside)&&!override)throw new Error(`Zasób „${resource.name}” ma kolizję lub niedostępność. Wymagany jest jawny wyjątek.`)
  }
  input.idempotency_key||=crypto.randomUUID();const cloudId=existing?.cloud_id||`pwa-appointment:${input.idempotency_key}`,created_at=existing?.created_at||new Date().toISOString(),payload={title:data.title.trim(),start_at:start.toISOString(),end_at:end.toISOString(),bay,status,notes:data.notes||'',planned_minutes:Math.round((end-start)/60000),vehicle_cloud_id:vehicleId,order_cloud_id:data.order_id||null,created_at}
  const entries=[{entity:'appointments',cloudId,payload}]
  if(!bayResource)entries.push({entity:'work_resources',cloudId:bayCloud,payload:{resource_type:'BAY',name:bay,active:1,capacity:1,work_calendar_json:'{}',created_at}})
  const old=existing?(await cloud.list('appointment_resources')).filter(r=>sameId(r.appointment_id,existing.id)):[]
  for(const resourceId of ids)if(!old.some(link=>link.resource_cloud_id===resourceId))entries.push({entity:'appointment_resources',cloudId:`${cloudId}:resource:${resourceId}:${input.idempotency_key}`,payload:{appointment_cloud_id:cloudId,resource_cloud_id:resourceId,role:'SCHEDULE',created_at}})
  for(const link of old)if(!ids.includes(link.resource_cloud_id))entries.push({entity:'appointment_resources',cloudId:link.cloud_id,remove:true})
  if(override)for(const resourceId of ids)entries.push({entity:'schedule_conflict_overrides',cloudId:`${cloudId}:override:${resourceId}:${Date.now()}`,payload:{appointment_cloud_id:cloudId,resource_cloud_id:resourceId,reason:data.override_reason,actor:data.override_actor||'Użytkownik',created_at}})
  const saved=await cloud.upsertMany(entries);return saved[0]
 }
 const remove=async id=>{const current=await cloud.get('appointments',id);if(!current)return false;const linked=(await cloud.list('appointment_resources')).filter(r=>sameId(r.appointment_id,id));await cloud.upsertMany([{entity:'appointments',cloudId:current.cloud_id,remove:true},...linked.map(r=>({entity:'appointment_resources',cloudId:r.cloud_id,remove:true}))]);return true}
 return {list,create:data=>save(null,data),update:save,remove}
}
