import {PWA_RELATIONS as RELATIONS,stablePwaLocalId} from './pwa-identifiers.mjs'

const SESSION_KEY='autologika.pwa.session.v1'
const DEVICE_KEY='autologika.pwa.device.v1'
const MAX_PAGE=1000

function normalizeUrl(value=''){
  return String(value||'').trim().replace(/\/+$/,'').replace(/\/(?:rest|auth|storage)\/v1$/i,'')
}

function validUrl(value){
  try{const url=new URL(normalizeUrl(value));return url.protocol==='https:'&&/^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)}catch{return false}
}

function validPublishableKey(value=''){
  const key=String(value||'').trim()
  if(key.startsWith('sb_publishable_'))return key.length>20
  try{const claims=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return claims.role==='anon'}catch{return false}
}

function readSession(){
  try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}
}

function writeSession(value){
  try{if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value));else localStorage.removeItem(SESSION_KEY)}catch{}
}

function deviceId(){
  try{let id=localStorage.getItem(DEVICE_KEY);if(!id){id=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,id)}return id}catch{return crypto.randomUUID()}
}

function messageFromResponse(status,text=''){
  let detail=''
  try{const body=JSON.parse(text);detail=body?.msg||body?.message||body?.error_description||body?.error||''}catch{}
  if(status===401)return 'Sesja wygasła. Zaloguj się ponownie.'
  if(status===403)return 'Brak uprawnień do danych tego warsztatu.'
  if(status===409)return 'Dane zostały równocześnie zmienione na innym urządzeniu. Odśwież widok.'
  return detail?`Supabase HTTP ${status}: ${detail}`:`Supabase HTTP ${status}`
}

export class PwaCloudClient{
  constructor(){
    this.url=normalizeUrl(import.meta.env.VITE_SUPABASE_URL||'')
    this.apiKey=String(import.meta.env.VITE_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim()
    this.session=readSession()
    this.records=new Map()
    this.localToCloud=new Map()
    this.listeners=new Set()
    this.loaded=false
    this.loading=null
    this.epoch=0
    this.changeRevision=0
    this.localChanges=new Map()
    this.pendingWrites=0
    this.mutations=Promise.resolve()
    this.refreshing=null
    this.lastSync=null
    this.syncError=''
    this.deviceId=deviceId()
  }

  get configured(){return validUrl(this.url)&&validPublishableKey(this.apiKey)}
  get user(){return this.session?.user||null}
  get authenticated(){return Boolean(this.user?.id&&this.session?.access_token)}
  get online(){return navigator.onLine!==false}

  configStatus(){
    return {configured:this.configured,url:this.url,keyKind:this.apiKey?(/^sb_publishable_/i.test(this.apiKey)?'publishable':'anon'):'missing'}
  }

  async auth(path,body){
    if(!this.configured)throw new Error('Brak bezpiecznej konfiguracji PWA. Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY podczas budowania.')
    const response=await fetch(`${this.url}${path}`,{method:'POST',headers:{apikey:this.apiKey,'Content-Type':'application/json'},body:JSON.stringify(body)})
    const text=await response.text()
    if(!response.ok){const error=new Error(messageFromResponse(response.status,text));error.status=response.status;throw error}
    return text?JSON.parse(text):null
  }

  async login(email,password){
    const result=await this.auth('/auth/v1/token?grant_type=password',{email:String(email||'').trim(),password:String(password||'')})
    this.session={access_token:result.access_token,refresh_token:result.refresh_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000,user:result.user}
    writeSession(this.session);this.clear();await this.sync();return this.user
  }

  async signup(email,password){
    const result=await this.auth('/auth/v1/signup',{email:String(email||'').trim(),password:String(password||'')})
    if(result?.access_token){this.session={access_token:result.access_token,refresh_token:result.refresh_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000,user:result.user};writeSession(this.session);this.clear();await this.sync()}
    return result
  }

  async refresh(){
    if(this.refreshing)return this.refreshing
    if(!this.session?.refresh_token)throw new Error('Sesja wygasła. Zaloguj się ponownie.')
    const session=this.session,epoch=this.epoch
    const task=(async()=>{try{
      const result=await this.auth('/auth/v1/token?grant_type=refresh_token',{refresh_token:session.refresh_token})
      this.assertSession(epoch)
      this.session={access_token:result.access_token,refresh_token:result.refresh_token||session.refresh_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000,user:result.user||session.user}
      writeSession(this.session);return this.session.access_token
    }catch(error){if(this.epoch===epoch&&[400,401,403].includes(error.status))this.logout();throw error}})()
    this.refreshing=task
    try{return await task}finally{if(this.refreshing===task)this.refreshing=null}
  }

  logout(){this.session=null;writeSession(null);this.clear();this.emit({type:'logout'})}

  clear(){this.epoch++;this.records.clear();this.localToCloud.clear();this.localChanges.clear();this.loaded=false;this.loading=null;this.refreshing=null;this.lastSync=null;this.syncError=''}
  assertSession(epoch){if(epoch!==this.epoch||!this.authenticated)throw new Error('Sesja została zmieniona. Zaloguj się ponownie.')}
  mutate(operation){const epoch=this.epoch;this.pendingWrites++;this.emit({type:'write-activity'});const task=this.mutations.then(()=>{this.assertSession(epoch);return operation()}).finally(()=>{this.pendingWrites--;this.emit({type:'write-activity'})});this.mutations=task.catch(()=>{});return task}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
  emit(event={type:'sync'}){for(const listener of this.listeners)try{listener(event)}catch{}}

  async token(){
    if(!this.authenticated)throw new Error('Zaloguj się do AutoLogika Cloud.')
    if(this.session.expires_at&&Date.now()>Number(this.session.expires_at)-60000)return this.refresh()
    return this.session.access_token
  }

  async request(path,options={},retry=true){
    if(!this.online)throw new Error('Brak połączenia z internetem. Dane formularza pozostają na ekranie.')
    const epoch=this.epoch,token=await this.token()
    this.assertSession(epoch)
    let response
    try{response=await fetch(`${this.url}${path}`,{...options,headers:{apikey:this.apiKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}})}
    catch(error){throw new Error(`Nie udało się połączyć z AutoLogika Cloud: ${error?.message||error}`)}
    this.assertSession(epoch)
    if(response.status===401&&retry){await this.refresh();return this.request(path,options,false)}
    const text=await response.text()
    if(!response.ok)throw new Error(messageFromResponse(response.status,text))
    return text?JSON.parse(text):null
  }

  async sync(force=false){
    if(!this.authenticated)return []
    if(this.loading)return this.loading
    const epoch=this.epoch,workshopId=this.user.id,started=this.changeRevision
    const task=(async()=>{
      const next=new Map()
      for(let offset=0;;offset+=MAX_PAGE){
        const path=`/rest/v1/sync_records?select=entity_type,cloud_id,payload,updated_at,deleted_at,version,device_id&workshop_id=eq.${encodeURIComponent(workshopId)}&deleted_at=is.null&order=entity_type.asc,cloud_id.asc&limit=${MAX_PAGE}&offset=${offset}`
        const page=await this.request(path,{method:'GET'})||[]
        this.assertSession(epoch)
        for(const row of page){const key=this.key(row.entity_type,row.cloud_id),local=this.records.get(key);next.set(key,local&&Number(local.version)>Number(row.version)?local:row)}
        if(page.length<MAX_PAGE)break
      }
      this.assertSession(epoch)
      for(const [key,change] of this.localChanges)if(change.revision>started){if(change.record)next.set(key,change.record);else next.delete(key)}
      this.records=next
      for(const row of next.values())this.indexLocalId(row.entity_type,row.cloud_id)
      for(const [key,change] of this.localChanges)if(change.revision<=started)this.localChanges.delete(key)
      this.loaded=true;this.lastSync=new Date().toISOString();this.syncError=''
      this.emit({type:'sync',count:next.size});return [...next.values()]
    })()
    this.loading=task
    try{return await task}catch(error){if(this.epoch===epoch){this.syncError=error.message||String(error);this.emit({type:'sync-error',error:this.syncError})}throw error}finally{if(this.loading===task)this.loading=null}
  }

  async ensureLoaded(){if(!this.loaded)await this.sync()}
  key(entity,cloudId){return `${entity}\0${cloudId}`}
  indexLocalId(entity,cloudId){const local=stablePwaLocalId(entity,cloudId);this.localToCloud.set(`${entity}\0${local}`,String(cloudId));return local}
  resolveCloudId(entity,id){return this.localToCloud.get(`${entity}\0${id}`)||String(id)}
  relationId(field,value){const entity=RELATIONS[field];return entity&&value?this.indexLocalId(entity,value):value}

  hydrate(entity,row){
    if(!row)return null
    const data={...(row.payload||{}),id:this.indexLocalId(entity,row.cloud_id),cloud_id:row.cloud_id,updated_at:row.updated_at,deleted_at:row.deleted_at||null,version:Number(row.version||1)}
    const aliases={vehicles:['customer_id','customer_cloud_id'],orders:['vehicle_id','vehicle_cloud_id'],diagnostics:['order_id','order_cloud_id'],order_notes:['order_id','order_cloud_id'],job_part_orders:['order_id','order_cloud_id'],payments:['order_id','order_cloud_id'],order_items:['order_id','order_cloud_id'],work_logs:['order_id','order_cloud_id'],communications:['order_id','order_cloud_id'],approvals:['order_id','order_cloud_id'],order_events:['order_id','order_cloud_id'],sales_refs:['order_id','order_cloud_id'],attachments:['order_id','order_cloud_id'],signatures:['order_id','order_cloud_id'],work_procedure_runs:['order_id','order_cloud_id'],service_reminders_v2:['vehicle_id','vehicle_cloud_id'],appointments:['order_id','order_cloud_id'],technical_data_entries:['vehicle_id','vehicle_cloud_id'],vehicle_findings:['vehicle_id','vehicle_cloud_id'],order_qc:['order_id','order_cloud_id'],order_repair_operations:['order_id','order_cloud_id'],repair_parts:['order_id','order_cloud_id'],dvi_inspections:['order_id','order_cloud_id'],dvi_items:['inspection_id','inspection_cloud_id'],dvi_media:['dvi_item_id','dvi_item_cloud_id'],dvi_decisions:['dvi_item_id','dvi_item_cloud_id'],resource_unavailability:['resource_id','resource_cloud_id']}
    const alias=aliases[entity];if(alias&&data[alias[1]]!=null)data[alias[0]]=this.relationId(alias[1],data[alias[1]])||null
    for(const [field,target] of Object.entries(RELATIONS)){if(data[field]!=null)data[field.replace('_cloud','')]=this.indexLocalId(target,data[field])}
    if(entity==='vehicle_findings'&&data.order_cloud_id!=null)data.source_order_id=data.order_id
    for(const key of Object.keys(data))if(key.endsWith('_json')&&typeof data[key]==='string')try{data[key.slice(0,-5)]=JSON.parse(data[key])}catch{}
    if(entity==='order_items'){
      if(data.kind==='LABOR')data.kind='ROBOCIZNA'
      if(data.kind==='CZĘŚĆ')data.kind='CZESC'
      if(data.kind==='ROBOCIZNA'){data.labor_hours=data.qty??data.labor_hours??0;data.labor_rate=data.unit_price??data.labor_rate??0}
    }
    if(entity==='work_resources')data.calendar=data.work_calendar||data.calendar||{}
    if(entity==='attachments'){data.original_name=data.original_name||data.name;data.mime_type=data.mime_type||data.mime;data.size=data.size??data.size_bytes}
    if(entity==='order_qc')data.checked=data.checked===true||data.checked===1||data.checked==='1'
    return data
  }

  async list(entity){
    await this.ensureLoaded()
    return [...this.records.values()].filter(row=>row.entity_type===entity&&!row.deleted_at).map(row=>this.hydrate(entity,row))
  }

  async get(entity,id){
    await this.ensureLoaded();return this.hydrate(entity,this.records.get(this.key(entity,this.resolveCloudId(entity,id))))
  }

  async upsert(entity,payload={},cloudId=null){
    return (await this.upsertMany([{entity,payload,cloudId}]))[0]
  }

  // One PostgREST request commits related records together, or none of them.
  upsertMany(entries){return this.mutate(()=>this.writeMany(entries))}

  async writeMany(entries){
    const epoch=this.epoch,workshopId=this.user?.id
    if(!this.authenticated)throw new Error('Zaloguj się do AutoLogika Cloud.')
    await this.ensureLoaded()
    const records=[]
    for(const {entity,payload={},cloudId=null,remove=false} of entries){
      const id=this.resolveCloudId(entity,cloudId||payload.cloud_id||crypto.randomUUID()),now=new Date().toISOString()
      const current=this.records.get(this.key(entity,id))
      const head=(await this.request(`/rest/v1/sync_records?select=updated_at,version,device_id,deleted_at&workshop_id=eq.${encodeURIComponent(this.user.id)}&entity_type=eq.${encodeURIComponent(entity)}&cloud_id=eq.${encodeURIComponent(id)}&limit=1`,{method:'GET'}))?.[0]||null
      if(current&&head&&String(head.updated_at||'')!==String(current.updated_at||'')&&head.device_id!==this.deviceId){await this.sync(true);throw new Error('Dane zostały zmienione na innym urządzeniu. Widok odświeżono — sprawdź zmianę i zapisz ponownie.')}
      if(!current&&head&&!head.deleted_at){await this.sync(true);throw new Error('Rekord istnieje już w chmurze. Odświeżono dane — sprawdź je przed ponownym zapisem.')}
      if(head?.deleted_at)throw new Error('Ten rekord został usunięty na innym urządzeniu. Odśwież widok.')
      const clean={...(current?.payload||{}),...payload};delete clean.id;delete clean.cloud_id;delete clean.updated_at;delete clean.deleted_at;delete clean.version
      for(const [field,target] of Object.entries(RELATIONS)){
        const localField=field.replace('_cloud','')
        if(Object.prototype.hasOwnProperty.call(payload,localField)&&!Object.prototype.hasOwnProperty.call(payload,field))clean[field]=payload[localField]||null
        if(clean[field]!=null)clean[field]=this.resolveCloudId(target,clean[field])
        if(field in clean)delete clean[localField]
      }
      if(entity==='vehicle_findings'&&payload.source_order_id!==undefined){clean.order_cloud_id=payload.source_order_id?this.resolveCloudId('orders',payload.source_order_id):null;delete clean.source_order_id}
      this.assertSession(epoch)
      const record={workshop_id:workshopId,entity_type:entity,cloud_id:id,payload:clean,updated_at:now,deleted_at:remove?now:null,version:Number(head?.version||current?.version||0)+1,device_id:this.deviceId}
      records.push(record)
    }
    if(!records.length)return []
    await this.request('/rest/v1/sync_records?on_conflict=workshop_id,entity_type,cloud_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(records)})
    this.assertSession(epoch)
    const result=records.map(record=>{const stored={...record};delete stored.workshop_id;if(record.deleted_at)this.records.delete(this.key(record.entity_type,record.cloud_id));else this.records.set(this.key(record.entity_type,record.cloud_id),stored);this.localChanges.set(this.key(record.entity_type,record.cloud_id),{revision:++this.changeRevision,record:record.deleted_at?null:stored});this.indexLocalId(record.entity_type,record.cloud_id);return this.hydrate(record.entity_type,stored)})
    this.emit({type:'change',entities:[...new Set(records.map(record=>record.entity_type))]})
    return result
  }

  remove(entity,id){return this.mutate(()=>this.deleteRecord(entity,id))}

  async deleteRecord(entity,id){
    await this.ensureLoaded()
    const epoch=this.epoch
    const cloudId=this.resolveCloudId(entity,id),now=new Date().toISOString(),key=this.key(entity,cloudId),current=this.records.get(key)
    if(!current)return false
    const head=(await this.request(`/rest/v1/sync_records?select=updated_at,version,device_id,deleted_at&workshop_id=eq.${encodeURIComponent(this.user.id)}&entity_type=eq.${encodeURIComponent(entity)}&cloud_id=eq.${encodeURIComponent(cloudId)}&limit=1`,{method:'GET'}))?.[0]||null
    if(head&&String(head.updated_at||'')!==String(current.updated_at||'')&&head.device_id!==this.deviceId){await this.sync(true);throw new Error('Dane zostały zmienione na innym urządzeniu. Widok odświeżono — sprawdź zmianę przed usunięciem.')}
    await this.request(`/rest/v1/sync_records?workshop_id=eq.${encodeURIComponent(this.user.id)}&entity_type=eq.${encodeURIComponent(entity)}&cloud_id=eq.${encodeURIComponent(cloudId)}`,{method:'PATCH',body:JSON.stringify({deleted_at:now,updated_at:now,version:Number(head?.version||current.version||0)+1,device_id:this.deviceId})})
    this.assertSession(epoch);this.localChanges.set(key,{revision:++this.changeRevision,record:null});this.records.delete(key);this.emit({type:'change',entity,id,deleted:true});return true
  }

  async upload(bucket,path,file){
    const token=await this.token(),encoded=String(path).split('/').map(encodeURIComponent).join('/')
    const response=await fetch(`${this.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`,{method:'POST',headers:{apikey:this.apiKey,Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file})
    const text=await response.text();if(!response.ok)throw new Error(messageFromResponse(response.status,text));return path
  }

  async download(bucket,path){
    const token=await this.token(),encoded=String(path).split('/').map(encodeURIComponent).join('/')
    const response=await fetch(`${this.url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`,{headers:{apikey:this.apiKey,Authorization:`Bearer ${token}`}})
    const text=response.ok?null:await response.text();if(!response.ok)throw new Error(messageFromResponse(response.status,text));return response.blob()
  }
}

export const pwaCloud=new PwaCloudClient()
export const isPwaConfigured=()=>pwaCloud.configured

