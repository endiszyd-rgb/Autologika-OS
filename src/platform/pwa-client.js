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
  return key.length>20&&!/^sb_secret_/i.test(key)&&!/^service_role$/i.test(key)
}

function readSession(){
  try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}
}

function writeSession(value){
  if(value)localStorage.setItem(SESSION_KEY,JSON.stringify(value))
  else localStorage.removeItem(SESSION_KEY)
}

function deviceId(){
  let id=localStorage.getItem(DEVICE_KEY)
  if(!id){id=crypto.randomUUID();localStorage.setItem(DEVICE_KEY,id)}
  return id
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
    this.key=String(import.meta.env.VITE_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim()
    this.session=readSession()
    this.records=new Map()
    this.localToCloud=new Map()
    this.listeners=new Set()
    this.loaded=false
    this.loading=null
    this.deviceId=deviceId()
  }

  get configured(){return validUrl(this.url)&&validPublishableKey(this.key)}
  get user(){return this.session?.user||null}
  get authenticated(){return Boolean(this.user?.id&&this.session?.access_token)}
  get online(){return navigator.onLine!==false}

  configStatus(){
    return {configured:this.configured,url:this.url,keyKind:this.key?(/^sb_publishable_/i.test(this.key)?'publishable':'anon'):'missing'}
  }

  async auth(path,body){
    if(!this.configured)throw new Error('Brak bezpiecznej konfiguracji PWA. Ustaw VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY podczas budowania.')
    const response=await fetch(`${this.url}${path}`,{method:'POST',headers:{apikey:this.key,'Content-Type':'application/json'},body:JSON.stringify(body)})
    const text=await response.text()
    if(!response.ok)throw new Error(messageFromResponse(response.status,text))
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
    if(!this.session?.refresh_token)throw new Error('Sesja wygasła. Zaloguj się ponownie.')
    try{
      const result=await this.auth('/auth/v1/token?grant_type=refresh_token',{refresh_token:this.session.refresh_token})
      this.session={access_token:result.access_token,refresh_token:result.refresh_token||this.session.refresh_token,expires_at:Date.now()+Number(result.expires_in||3600)*1000,user:result.user||this.session.user}
      writeSession(this.session);return this.session.access_token
    }catch(error){this.logout();throw error}
  }

  logout(){this.session=null;writeSession(null);this.clear();this.emit({type:'logout'})}

  clear(){this.records.clear();this.localToCloud.clear();this.loaded=false;this.loading=null}
  subscribe(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener)}
  emit(event={type:'sync'}){for(const listener of this.listeners)try{listener(event)}catch{}}

  async token(){
    if(!this.authenticated)throw new Error('Zaloguj się do AutoLogika Cloud.')
    if(this.session.expires_at&&Date.now()>Number(this.session.expires_at)-60000)return this.refresh()
    return this.session.access_token
  }

  async request(path,options={},retry=true){
    if(!this.online)throw new Error('Brak połączenia z internetem. Dane formularza pozostają na ekranie.')
    const token=await this.token()
    let response
    try{response=await fetch(`${this.url}${path}`,{...options,headers:{apikey:this.key,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}})}
    catch(error){throw new Error(`Nie udało się połączyć z AutoLogika Cloud: ${error?.message||error}`)}
    if(response.status===401&&retry){await this.refresh();return this.request(path,options,false)}
    const text=await response.text()
    if(!response.ok)throw new Error(messageFromResponse(response.status,text))
    return text?JSON.parse(text):null
  }

  async sync(force=false){
    if(!this.authenticated)return []
    if(this.loading&&!force)return this.loading
    this.loading=(async()=>{
      const next=new Map()
      for(let offset=0;;offset+=MAX_PAGE){
        const path=`/rest/v1/sync_records?select=entity_type,cloud_id,payload,updated_at,deleted_at,version,device_id&workshop_id=eq.${encodeURIComponent(this.user.id)}&deleted_at=is.null&order=updated_at.asc&limit=${MAX_PAGE}&offset=${offset}`
        const page=await this.request(path,{method:'GET'})||[]
        for(const row of page){next.set(`${row.entity_type}\0${row.cloud_id}`,row);this.indexLocalId(row.entity_type,row.cloud_id)}
        if(page.length<MAX_PAGE)break
      }
      this.records=next;this.loaded=true;this.emit({type:'sync',count:next.size});return [...next.values()]
    })()
    try{return await this.loading}finally{this.loading=null}
  }

  async ensureLoaded(){if(!this.loaded)await this.sync()}
  key(entity,cloudId){return `${entity}\0${cloudId}`}
  indexLocalId(entity,cloudId){const local=stablePwaLocalId(entity,cloudId);this.localToCloud.set(`${entity}\0${local}`,String(cloudId));return local}
  resolveCloudId(entity,id){return this.localToCloud.get(`${entity}\0${id}`)||String(id)}
  relationId(field,value){const entity=RELATIONS[field];return entity&&value?this.indexLocalId(entity,value):value}

  hydrate(entity,row){
    if(!row)return null
    const data={id:this.indexLocalId(entity,row.cloud_id),cloud_id:row.cloud_id,...(row.payload||{}),updated_at:row.updated_at,deleted_at:row.deleted_at||null,version:Number(row.version||1)}
    const aliases={vehicles:['customer_id','customer_cloud_id'],orders:['vehicle_id','vehicle_cloud_id'],diagnostics:['order_id','order_cloud_id'],order_notes:['order_id','order_cloud_id'],job_part_orders:['order_id','order_cloud_id'],payments:['order_id','order_cloud_id'],order_items:['order_id','order_cloud_id'],work_logs:['order_id','order_cloud_id'],communications:['order_id','order_cloud_id'],approvals:['order_id','order_cloud_id'],order_events:['order_id','order_cloud_id'],sales_refs:['order_id','order_cloud_id'],attachments:['order_id','order_cloud_id'],signatures:['order_id','order_cloud_id'],work_procedure_runs:['order_id','order_cloud_id'],service_reminders_v2:['vehicle_id','vehicle_cloud_id'],appointments:['order_id','order_cloud_id'],technical_data_entries:['vehicle_id','vehicle_cloud_id'],vehicle_findings:['vehicle_id','vehicle_cloud_id'],order_qc:['order_id','order_cloud_id'],order_repair_operations:['order_id','order_cloud_id'],repair_parts:['order_id','order_cloud_id'],dvi_inspections:['order_id','order_cloud_id'],dvi_items:['inspection_id','inspection_cloud_id'],dvi_media:['dvi_item_id','dvi_item_cloud_id'],dvi_decisions:['dvi_item_id','dvi_item_cloud_id'],resource_unavailability:['resource_id','resource_cloud_id']}
    const alias=aliases[entity];if(alias&&data[alias[0]]==null)data[alias[0]]=this.relationId(alias[1],data[alias[1]])||null
    for(const [field,target] of Object.entries(RELATIONS)){if(data[field]&&data[field.replace('_cloud','')]==null)data[field.replace('_cloud','')]=this.indexLocalId(target,data[field])}
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
    if(!this.authenticated)throw new Error('Zaloguj się do AutoLogika Cloud.')
    const id=this.resolveCloudId(entity,cloudId||payload.cloud_id||crypto.randomUUID()),now=new Date().toISOString()
    const current=this.records.get(this.key(entity,id))
    const head=(await this.request(`/rest/v1/sync_records?select=updated_at,version,device_id,deleted_at&workshop_id=eq.${encodeURIComponent(this.user.id)}&entity_type=eq.${encodeURIComponent(entity)}&cloud_id=eq.${encodeURIComponent(id)}&limit=1`,{method:'GET'}))?.[0]||null
    if(current&&head&&String(head.updated_at||'')!==String(current.updated_at||'')&&head.device_id!==this.deviceId){await this.sync(true);throw new Error('Dane zostały zmienione na innym urządzeniu. Widok odświeżono — sprawdź zmianę i zapisz ponownie.')}
    if(head?.deleted_at)throw new Error('Ten rekord został usunięty na innym urządzeniu. Odśwież widok.')
    const clean={...(current?.payload||{}),...payload};delete clean.id;delete clean.cloud_id;delete clean.updated_at;delete clean.deleted_at;delete clean.version
    for(const [field,target] of Object.entries(RELATIONS))if(clean[field]!=null)clean[field]=this.resolveCloudId(target,clean[field])
    const record={workshop_id:this.user.id,entity_type:entity,cloud_id:id,payload:clean,updated_at:now,deleted_at:null,version:Number(head?.version||current?.version||0)+1,device_id:this.deviceId}
    await this.request('/rest/v1/sync_records?on_conflict=workshop_id,entity_type,cloud_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(record)})
    const stored={...record};delete stored.workshop_id
    this.records.set(this.key(entity,id),stored);this.indexLocalId(entity,id);this.emit({type:'change',entity,id});return this.hydrate(entity,stored)
  }

  async remove(entity,id){
    const cloudId=this.resolveCloudId(entity,id),now=new Date().toISOString(),key=this.key(entity,cloudId),current=this.records.get(key)
    if(!current)return false
    const head=(await this.request(`/rest/v1/sync_records?select=updated_at,version,device_id,deleted_at&workshop_id=eq.${encodeURIComponent(this.user.id)}&entity_type=eq.${encodeURIComponent(entity)}&cloud_id=eq.${encodeURIComponent(cloudId)}&limit=1`,{method:'GET'}))?.[0]||null
    if(head&&String(head.updated_at||'')!==String(current.updated_at||'')&&head.device_id!==this.deviceId){await this.sync(true);throw new Error('Dane zostały zmienione na innym urządzeniu. Widok odświeżono — sprawdź zmianę przed usunięciem.')}
    await this.request(`/rest/v1/sync_records?workshop_id=eq.${encodeURIComponent(this.user.id)}&entity_type=eq.${encodeURIComponent(entity)}&cloud_id=eq.${encodeURIComponent(cloudId)}`,{method:'PATCH',body:JSON.stringify({deleted_at:now,updated_at:now,version:Number(head?.version||current.version||0)+1,device_id:this.deviceId})})
    this.records.delete(key);this.emit({type:'change',entity,id,deleted:true});return true
  }

  async upload(bucket,path,file){
    const token=await this.token(),encoded=String(path).split('/').map(encodeURIComponent).join('/')
    const response=await fetch(`${this.url}/storage/v1/object/${encodeURIComponent(bucket)}/${encoded}`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream','x-upsert':'true'},body:file})
    const text=await response.text();if(!response.ok)throw new Error(messageFromResponse(response.status,text));return path
  }

  async download(bucket,path){
    const token=await this.token(),encoded=String(path).split('/').map(encodeURIComponent).join('/')
    const response=await fetch(`${this.url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encoded}`,{headers:{apikey:this.key,Authorization:`Bearer ${token}`}})
    const text=response.ok?null:await response.text();if(!response.ok)throw new Error(messageFromResponse(response.status,text));return response.blob()
  }
}

export const pwaCloud=new PwaCloudClient()
export const isPwaConfigured=()=>pwaCloud.configured

