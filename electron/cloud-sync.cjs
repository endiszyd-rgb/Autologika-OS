const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const { app, net } = require('electron')
const { EventEmitter } = require('events')
const { getDb } = require('./db.cjs')
const { buildApprovalSnapshot, sha256 } = require('./remote-approval.cjs')
const { materializeApprovedQuote } = require('./quote-approval.cjs')
const { archiveBasePath, vehicleArchiveFolder, approvalFileName, fileHash, approvalArchiveState, approvalEvidencePaths, writeApprovalManifest, approvalEvidenceState, chooseDestination } = require('./approval-archive.cjs')
const { latestRemoteApprovals, effectiveRemoteApproval, remoteApprovalOutcome } = require('./remote-approval-status.cjs')

const SYNC_TABLES = ['app_settings','customers','suppliers','inventory_parts','vehicles','orders','diagnostics','order_notes','job_part_orders','payments','appointments','order_items','work_logs','communications','approvals','order_events','sales_refs','service_reminders_v2','attachments','signatures','work_procedure_runs','technical_data_entries','vehicle_findings','order_qc','work_templates','technical_manual_pages','technical_manual_hotspots','technical_manual_steps']
const events = new EventEmitter()
let running = false, timer = null
function configPath(){ return path.join(app.getPath('userData'),'cloud-sync.json') }
function defaultConfig(){ return { enabled:false,url:'',key:'',intervalSeconds:30,deviceName:os.hostname(),deviceId:crypto.randomUUID(),lastSync:'',syncCursorVersion:0,lastFullSyncAt:'',syncOwnerId:'',lastResult:null,workshopId:'',accessToken:'',refreshToken:'',expiresAt:0,user:null } }
function normalizeUrl(value=''){return String(value||'').trim().replace(/\/+(rest|auth|storage)\/v1\/?$/i,'').replace(/\/+$/,'')}
function keyKind(key=''){const k=String(key||'').trim();if(k.startsWith('sb_publishable_'))return 'publishable';if(k.startsWith('eyJ'))return 'legacy-anon';if(k.startsWith('sb_secret_'))return 'secret';return k?'unknown':'empty'}
function loadConfig(){ try{return {...defaultConfig(),...JSON.parse(fs.readFileSync(configPath(),'utf8'))}}catch{const c=defaultConfig();saveConfig(c);return c} }
function saveConfig(patch={}){const current=(()=>{try{return JSON.parse(fs.readFileSync(configPath(),'utf8'))}catch{return {}}})();const next={...defaultConfig(),...current,...patch};next.enabled=!!next.enabled;next.intervalSeconds=Math.max(10,Math.min(3600,Number(next.intervalSeconds)||30));next.url=normalizeUrl(next.url);next.key=String(next.key||'').trim();if(keyKind(next.key)==='secret')throw new Error('Nie używaj klucza sb_secret_ w aplikacji. Wklej Publishable key (sb_publishable_...).');if(!next.syncOwnerId&&current.lastSync&&current.workshopId)next.syncOwnerId=current.workshopId;if(next.user?.id)next.workshopId=next.user.id;if(!next.deviceId)next.deviceId=crypto.randomUUID();fs.writeFileSync(configPath(),JSON.stringify(next,null,2),'utf8');return next}
function publicConfig(){const c=loadConfig();return {enabled:c.enabled,url:c.url,key:'',keyConfigured:!!c.key,keyLength:c.key.length,keyKind:keyKind(c.key),keyHint:c.key?`${c.key.slice(0,14)}…${c.key.slice(-4)}`:'',intervalSeconds:c.intervalSeconds,deviceName:c.deviceName,deviceId:c.deviceId,lastSync:c.lastSync,workshopId:c.workshopId||''}}
function isConfigured(c=loadConfig()){return /^https:\/\/[^/]+\.supabase\.co$/i.test(normalizeUrl(c.url))&&c.key.length>20&&['publishable','legacy-anon','unknown'].includes(keyKind(c.key))}
async function cloudFetch(url,options={}){try{return await (net?.fetch?net.fetch(url,options):fetch(url,options))}catch(e){const cause=e?.cause;const detail=[cause?.code,cause?.errno,cause?.message,e?.message].filter(Boolean).join(' · ');throw new Error(`Nie można połączyć się z Supabase (${url}). ${detail||'Błąd sieci.'}`)}}
async function authRequest(c,route,options={}){const r=await cloudFetch(c.url+route,{...options,headers:{'apikey':c.key,'Content-Type':'application/json',...(options.headers||{})}});const text=await r.text();if(!r.ok)throw new Error(`Auth ${r.status}: ${text.slice(0,500)}`);return text?JSON.parse(text):null}
async function testConnection(){const c=loadConfig();if(!isConfigured(c))throw new Error('Zapisz poprawny Project URL oraz Publishable key Supabase.');const started=Date.now();const r=await cloudFetch(c.url+'/auth/v1/settings',{method:'GET',headers:{'apikey':c.key}});const text=await r.text();if(!r.ok)throw new Error(`Supabase odpowiedział HTTP ${r.status}: ${text.slice(0,500)}`);let data=null;try{data=text?JSON.parse(text):null}catch{}return {ok:true,status:r.status,ms:Date.now()-started,url:c.url,keyKind:keyKind(c.key),keyLength:c.key.length,authConfigured:!!data}}
function bindAccount(c,userId){if(!userId)throw new Error('Cloud nie zwrócił identyfikatora konta. Zaloguj się ponownie.');const owner=c.syncOwnerId||(c.lastSync?c.workshopId:'');if(owner&&owner!==userId)throw new Error('Ta lokalna baza była już synchronizowana z innym kontem Cloud. Zaloguj się na poprzednie konto. Nowe konto wymaga osobnej lokalnej bazy.');return {workshopId:userId,lastSync:owner===userId?c.lastSync||'':'',syncCursorVersion:owner===userId?Number(c.syncCursorVersion||0):0,lastFullSyncAt:owner===userId?c.lastFullSyncAt||'':''}}
async function login(email,password){const c=loadConfig();if(!isConfigured(c))throw new Error('Najpierw zapisz URL i anon/publishable key Supabase.');const s=await authRequest(c,'/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});const binding=bindAccount(c,s.user?.id);saveConfig({...binding,accessToken:s.access_token,refreshToken:s.refresh_token,expiresAt:Date.now()+Number(s.expires_in||3600)*1000,user:s.user});startAuto();return account()}
async function signup(email,password){const c=loadConfig();if(!isConfigured(c))throw new Error('Najpierw zapisz URL i anon/publishable key Supabase.');const s=await authRequest(c,'/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password})});if(s?.access_token){const binding=bindAccount(c,s.user?.id);saveConfig({...binding,accessToken:s.access_token,refreshToken:s.refresh_token,expiresAt:Date.now()+Number(s.expires_in||3600)*1000,user:s.user})}return {ok:true,user:s?.user||null,needsConfirmation:!s?.access_token}}
function logout(){stopAuto();saveConfig({accessToken:'',refreshToken:'',expiresAt:0,user:null});return account()}
function account(){const c=loadConfig();return {configured:isConfigured(c),loggedIn:!!c.accessToken,email:c.user?.email||'',userId:c.user?.id||'',workshopId:c.user?.id||c.workshopId||''}}
async function token(c){if(!c.accessToken)throw new Error('Zaloguj się do Autologika Cloud.');if(c.expiresAt&&Date.now()>Number(c.expiresAt)-60000&&c.refreshToken){const s=await authRequest(c,'/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:c.refreshToken})});c=saveConfig({accessToken:s.access_token,refreshToken:s.refresh_token||c.refreshToken,expiresAt:Date.now()+Number(s.expires_in||3600)*1000,user:s.user||c.user});}return {c,bearer:c.accessToken}}
async function request(c,route,options={}){const t=await token(c);c=t.c;const r=await cloudFetch(c.url+route,{...options,headers:{'apikey':c.key,'Authorization':`Bearer ${t.bearer}`,'Content-Type':'application/json','Prefer':'return=minimal',...(options.headers||{})}});if(!r.ok){const text=await r.text();throw new Error(`Cloud ${r.status}: ${text.slice(0,500)}`)}if(r.status===204)return null;const text=await r.text();return text?JSON.parse(text):null}
function safeName(name){return String(name||'file').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(-120)||'file'}
function attachmentRemotePath(workshopId,orderCloudId,cloudId,name){return `${workshopId}/${orderCloudId||'bez-zlecenia'}/${cloudId}-${safeName(name)}`}
async function storageUpload(c,storagePath,filePath,mime){const t=await token(c);const body=fs.readFileSync(filePath);const r=await cloudFetch(`${t.c.url}/storage/v1/object/order-files/${storagePath.split('/').map(encodeURIComponent).join('/')}`,{method:'POST',headers:{'apikey':t.c.key,'Authorization':`Bearer ${t.bearer}`,'Content-Type':mime||'application/octet-stream','x-upsert':'true'},body});if(!r.ok)throw new Error(`Storage upload ${r.status}: ${(await r.text()).slice(0,350)}`);return true}
async function storageDownload(c,storagePath,dest){const t=await token(c);const r=await cloudFetch(`${t.c.url}/storage/v1/object/authenticated/order-files/${storagePath.split('/').map(encodeURIComponent).join('/')}`,{headers:{'apikey':t.c.key,'Authorization':`Bearer ${t.bearer}`}});if(!r.ok)throw new Error(`Storage download ${r.status}: ${(await r.text()).slice(0,350)}`);const buf=Buffer.from(await r.arrayBuffer());fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,buf);return buf.length}
async function storageDownloadFrom(c,bucket,storagePath,dest){const t=await token(c);const r=await cloudFetch(`${t.c.url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${storagePath.split('/').map(encodeURIComponent).join('/')}`,{headers:{'apikey':t.c.key,'Authorization':`Bearer ${t.bearer}`}});if(!r.ok)throw new Error(`Storage download ${r.status}: ${(await r.text()).slice(0,350)}`);const buf=Buffer.from(await r.arrayBuffer());fs.mkdirSync(path.dirname(dest),{recursive:true});const temp=`${dest}.part-${process.pid}-${Date.now()}`;fs.writeFileSync(temp,buf);fs.renameSync(temp,dest);return buf.length}
async function storageDelete(c,storagePath){if(!storagePath)return false;const t=await token(c);const r=await cloudFetch(`${t.c.url}/storage/v1/object/order-files`,{method:'DELETE',headers:{'apikey':t.c.key,'Authorization':`Bearer ${t.bearer}`,'Content-Type':'application/json'},body:JSON.stringify({prefixes:[storagePath]})});if(!r.ok&&r.status!==404)throw new Error(`Storage delete ${r.status}: ${(await r.text()).slice(0,350)}`);return true}
async function prepareAttachmentForPush(c,db,row){if(!row?.file_path||!fs.existsSync(row.file_path))return row;const orderCloudId=db.prepare('SELECT cloud_id FROM orders WHERE id=?').get(row.order_id)?.cloud_id||'';const workshopId=c.workshopId||c.user?.id;const storagePath=row.storage_path||attachmentRemotePath(workshopId,orderCloudId,row.cloud_id,row.name);if(!row.storage_path){await storageUpload(c,storagePath,row.file_path,row.mime);db.prepare("INSERT INTO sync_meta(key,value) VALUES ('applying_remote','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();try{db.prepare('UPDATE attachments SET storage_path=?,size_bytes=?,sha256=? WHERE id=?').run(storagePath,fs.statSync(row.file_path).size,crypto.createHash('sha256').update(fs.readFileSync(row.file_path)).digest('hex'),row.id)}finally{db.prepare("INSERT INTO sync_meta(key,value) VALUES ('applying_remote','0') ON CONFLICT(key) DO UPDATE SET value='0'").run()}}return db.prepare('SELECT * FROM attachments WHERE id=?').get(row.id)}
async function materializeAttachment(c,db,cloudId,payload){if(!payload?.storage_path)return payload;const orderId=localByCloud(db,'orders',payload.order_cloud_id);if(!orderId)return payload;const ext=path.extname(payload.name||'')||'.bin';const dir=path.join(app.getPath('userData'),'attachments',String(orderId));const dest=path.join(dir,`${cloudId}${ext}`);if(!fs.existsSync(dest)){try{await storageDownload(c,payload.storage_path,dest)}catch(e){return {...payload,file_path:''}}}return {...payload,file_path:dest}}
function tableCols(db,table){return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name))}
function localByCloud(db,table,cloudId){if(!cloudId)return null;return db.prepare(`SELECT id FROM ${table} WHERE cloud_id=?`).get(cloudId)?.id||null}
function timestampMs(value){const raw=String(value||'').trim();const normalized=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(raw)?`${raw.replace(' ','T')}Z`:raw;return Date.parse(normalized)||0}
function timestampIso(value){const ms=timestampMs(value);return ms?new Date(ms).toISOString():new Date().toISOString()}
function remoteWins(remote,localUpdated){return !!remote&&timestampMs(remote.updated_at)>timestampMs(localUpdated)}
function remoteHeadsRoute(workshopId,entityType,cloudIds){return `/rest/v1/sync_records?select=entity_type,cloud_id,updated_at,deleted_at,device_id&workshop_id=eq.${encodeURIComponent(workshopId)}&entity_type=eq.${encodeURIComponent(entityType)}&cloud_id=in.(${cloudIds.map(x=>encodeURIComponent(String(x))).join(',')})&limit=${cloudIds.length}`}
async function fetchRemoteHeads(c,workshopId,queue){const heads=new Map(),groups=new Map();for(const q of queue){if(!q.cloud_id)continue;if(!groups.has(q.entity_type))groups.set(q.entity_type,[]);const ids=groups.get(q.entity_type);if(!ids.includes(q.cloud_id))ids.push(q.cloud_id)}for(const [entityType,ids] of groups)for(let offset=0;offset<ids.length;offset+=200){const batch=ids.slice(offset,offset+200),rows=await request(c,remoteHeadsRoute(workshopId,entityType,batch),{method:'GET'})||[];if(!Array.isArray(rows))throw new Error('Cloud zwrócił nieprawidłowe dane kontroli konfliktów.');for(const row of rows)heads.set(`${row.entity_type}\0${row.cloud_id}`,row)}return heads}
function reconcileOrderTotals(db){
  if(!tableCols(db,'orders').has('parts_cost')||!tableCols(db,'order_items').has('unit_cost'))return
  db.exec(`UPDATE orders SET
    parts_cost=COALESCE((SELECT SUM(qty*unit_cost) FROM order_items WHERE order_id=orders.id AND kind='CZESC'),0),
    parts_sale=COALESCE((SELECT SUM(qty*unit_price) FROM order_items WHERE order_id=orders.id AND kind='CZESC'),0),
    other_cost=COALESCE((SELECT SUM(qty*unit_cost) FROM order_items WHERE order_id=orders.id AND kind!='CZESC'),0),
    other_sale=COALESCE((SELECT SUM(qty*unit_price) FROM order_items WHERE order_id=orders.id AND kind!='CZESC'),0)`)
}
function buildPayload(db,table,row){if(!row)return null;const p={...row};delete p.id;if(table==='vehicles'){p.customer_cloud_id=db.prepare('SELECT cloud_id FROM customers WHERE id=?').get(row.customer_id)?.cloud_id||null;delete p.customer_id}if(table==='orders'){p.vehicle_cloud_id=db.prepare('SELECT cloud_id FROM vehicles WHERE id=?').get(row.vehicle_id)?.cloud_id||null;delete p.vehicle_id}if(['diagnostics','order_notes','job_part_orders','payments','order_items','work_logs','communications','approvals','order_events','sales_refs','attachments','signatures','work_procedure_runs'].includes(table)){p.order_cloud_id=db.prepare('SELECT cloud_id FROM orders WHERE id=?').get(row.order_id)?.cloud_id||null;delete p.order_id}if(table==='order_items'||table==='job_part_orders'){p.inventory_part_cloud_id=row.inventory_part_id?db.prepare('SELECT cloud_id FROM inventory_parts WHERE id=?').get(row.inventory_part_id)?.cloud_id:null;delete p.inventory_part_id}if(table==='work_procedure_runs'){p.order_item_cloud_id=row.order_item_id?db.prepare('SELECT cloud_id FROM order_items WHERE id=?').get(row.order_item_id)?.cloud_id:null;delete p.order_item_id}if(table==='attachments'){delete p.file_path}if(table==='signatures'&&p.points_json){try{p.points=JSON.parse(p.points_json)}catch{}delete p.points_json}if(table==='job_part_orders'||table==='inventory_parts'){p.supplier_cloud_id=row.supplier_id?db.prepare('SELECT cloud_id FROM suppliers WHERE id=?').get(row.supplier_id)?.cloud_id:null;delete p.supplier_id}if(table==='service_reminders_v2'){p.vehicle_cloud_id=db.prepare('SELECT cloud_id FROM vehicles WHERE id=?').get(row.vehicle_id)?.cloud_id||null;p.order_cloud_id=row.order_id?db.prepare('SELECT cloud_id FROM orders WHERE id=?').get(row.order_id)?.cloud_id:null;delete p.vehicle_id;delete p.order_id}if(table==='appointments'){p.order_cloud_id=row.order_id?db.prepare('SELECT cloud_id FROM orders WHERE id=?').get(row.order_id)?.cloud_id:null;p.vehicle_cloud_id=row.vehicle_id?db.prepare('SELECT cloud_id FROM vehicles WHERE id=?').get(row.vehicle_id)?.cloud_id:null;delete p.order_id;delete p.vehicle_id}if(table==='technical_data_entries'){p.vehicle_cloud_id=row.vehicle_id?db.prepare('SELECT cloud_id FROM vehicles WHERE id=?').get(row.vehicle_id)?.cloud_id:null;delete p.vehicle_id}if(table==='technical_manual_hotspots'||table==='technical_manual_steps'){p.manual_page_cloud_id=db.prepare('SELECT cloud_id FROM technical_manual_pages WHERE id=?').get(row.manual_page_id)?.cloud_id||null;delete p.manual_page_id;if(row.technical_data_id){p.technical_data_cloud_id=db.prepare('SELECT cloud_id FROM technical_data_entries WHERE id=?').get(row.technical_data_id)?.cloud_id||null;delete p.technical_data_id}}if(table==='vehicle_findings'){p.vehicle_cloud_id=db.prepare('SELECT cloud_id FROM vehicles WHERE id=?').get(row.vehicle_id)?.cloud_id||null;p.order_cloud_id=row.source_order_id?db.prepare('SELECT cloud_id FROM orders WHERE id=?').get(row.source_order_id)?.cloud_id:null;delete p.vehicle_id;delete p.source_order_id}if(table==='order_qc'){p.order_cloud_id=db.prepare('SELECT cloud_id FROM orders WHERE id=?').get(row.order_id)?.cloud_id||null;delete p.order_id}return p}
function applyPayload(db,table,cloudId,payload,remoteUpdated){if(!SYNC_TABLES.includes(table))return;const cols=tableCols(db,table),data={...payload,cloud_id:cloudId};delete data.id;delete data.customer_cloud_id;delete data.vehicle_cloud_id;delete data.order_cloud_id;delete data.supplier_cloud_id;delete data.order_item_cloud_id;delete data.inventory_part_cloud_id;if(table==='signatures'&&Array.isArray(payload.points)){data.points_json=JSON.stringify(payload.points);delete data.points}if(table==='vehicles'){const x=payload.customer_cloud_id?localByCloud(db,'customers',payload.customer_cloud_id):null;if(payload.customer_cloud_id&&!x)return;data.customer_id=x}if(table==='orders'){const x=localByCloud(db,'vehicles',payload.vehicle_cloud_id);if(!x)return;data.vehicle_id=x}if(['diagnostics','order_notes','job_part_orders','payments','order_items','work_logs','communications','approvals','order_events','sales_refs','attachments','signatures','work_procedure_runs'].includes(table)){const x=localByCloud(db,'orders',payload.order_cloud_id);if(!x)return;data.order_id=x}if(table==='order_items'||table==='job_part_orders')data.inventory_part_id=payload.inventory_part_cloud_id?localByCloud(db,'inventory_parts',payload.inventory_part_cloud_id):null;if(table==='work_procedure_runs')data.order_item_id=payload.order_item_cloud_id?localByCloud(db,'order_items',payload.order_item_cloud_id):null;if(table==='job_part_orders'||table==='inventory_parts')data.supplier_id=payload.supplier_cloud_id?localByCloud(db,'suppliers',payload.supplier_cloud_id):null;if(table==='service_reminders_v2'){const v=localByCloud(db,'vehicles',payload.vehicle_cloud_id);if(!v)return;data.vehicle_id=v;data.order_id=payload.order_cloud_id?localByCloud(db,'orders',payload.order_cloud_id):null}if(table==='appointments'){data.order_id=payload.order_cloud_id?localByCloud(db,'orders',payload.order_cloud_id):null;data.vehicle_id=payload.vehicle_cloud_id?localByCloud(db,'vehicles',payload.vehicle_cloud_id):null}if(table==='technical_data_entries')data.vehicle_id=payload.vehicle_cloud_id?localByCloud(db,'vehicles',payload.vehicle_cloud_id):null;if(table==='technical_manual_hotspots'||table==='technical_manual_steps'){const page=localByCloud(db,'technical_manual_pages',payload.manual_page_cloud_id);if(!page)return;data.manual_page_id=page;data.technical_data_id=payload.technical_data_cloud_id?localByCloud(db,'technical_data_entries',payload.technical_data_cloud_id):null}if(table==='vehicle_findings'){const v=localByCloud(db,'vehicles',payload.vehicle_cloud_id);if(!v)return;data.vehicle_id=v;data.source_order_id=payload.order_cloud_id?localByCloud(db,'orders',payload.order_cloud_id):null}if(table==='order_qc'){const o=localByCloud(db,'orders',payload.order_cloud_id);if(!o)return;data.order_id=o}const clean=Object.fromEntries(Object.entries(data).filter(([k])=>cols.has(k)));clean.updated_at=remoteUpdated||clean.updated_at||new Date().toISOString();const existing=db.prepare(`SELECT * FROM ${table} WHERE cloud_id=?`).get(cloudId);if(existing){if(timestampMs(existing.updated_at)>timestampMs(clean.updated_at))return;const keys=Object.keys(clean).filter(k=>k!=='cloud_id');if(keys.length)db.prepare(`UPDATE ${table} SET ${keys.map(k=>`${k}=?`).join(',')} WHERE cloud_id=?`).run(...keys.map(k=>clean[k]),cloudId)}else{const keys=Object.keys(clean),vals=keys.map(k=>clean[k]);db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...vals)}}
function applyRemoteDeletion(db,table,row){
 const local=db.prepare(`SELECT * FROM ${table} WHERE cloud_id=?`).get(row.cloud_id)
 if(!local||timestampMs(local.updated_at)>timestampMs(row.updated_at))return false
 if(table==='attachments'&&local.file_path){try{fs.unlinkSync(local.file_path)}catch{}}
 db.prepare(`DELETE FROM ${table} WHERE id=?`).run(local.id)
 return true
}
async function pushQueue(c,db){
 const workshopId=c.workshopId||c.user?.id
 if(!workshopId)throw new Error('Brak ID warsztatu. Zaloguj się ponownie.')
 const queue=db.prepare('SELECT * FROM sync_queue ORDER BY id LIMIT 250').all()
 const heads=await fetchRemoteHeads(c,workshopId,queue)
 let pushed=0,conflicts=0
 for(const q of queue){
  try{
   let row=null
   const localUpdated=q.operation==='DELETE'?q.queued_at:(row=db.prepare(`SELECT * FROM ${q.entity_type} WHERE id=?`).get(q.row_id))?.updated_at
   if(q.operation!=='DELETE'&&!row){db.prepare('DELETE FROM sync_queue WHERE id=?').run(q.id);continue}
   const remote=heads.get(`${q.entity_type}\0${q.cloud_id}`)
   if(remoteWins(remote,localUpdated)){db.prepare('DELETE FROM sync_queue WHERE id=?').run(q.id);conflicts++;continue}
   if(q.operation==='DELETE'){
    const deletedAt=timestampIso(q.queued_at)
    await request(c,`/rest/v1/sync_records?workshop_id=eq.${encodeURIComponent(workshopId)}&entity_type=eq.${encodeURIComponent(q.entity_type)}&cloud_id=eq.${encodeURIComponent(q.cloud_id)}`,{method:'PATCH',body:JSON.stringify({deleted_at:deletedAt,updated_at:deletedAt,device_id:c.deviceId})})
   }else{
    if(q.entity_type==='attachments'&&row.deleted_at&&row.storage_path)await storageDelete(c,row.storage_path)
    if(q.entity_type==='attachments'&&!row.deleted_at)row=await prepareAttachmentForPush(c,db,row)
    const payload=buildPayload(db,q.entity_type,row)
    const rec={workshop_id:workshopId,entity_type:q.entity_type,cloud_id:row.cloud_id,payload,updated_at:timestampIso(row.updated_at),deleted_at:row.deleted_at?timestampIso(row.deleted_at):null,version:row.version||1,device_id:c.deviceId}
    await request(c,'/rest/v1/sync_records?on_conflict=workshop_id,entity_type,cloud_id',{method:'POST',headers:{'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rec)})
   }
   db.prepare('DELETE FROM sync_queue WHERE id=?').run(q.id);pushed++
  }catch(e){db.prepare('UPDATE sync_queue SET attempts=attempts+1,last_error=? WHERE id=?').run(String(e.message||e),q.id);throw e}
 }
 return {pushed,conflicts}
}
async function fetchSyncPages(workshopId,since,fetchPage,pageSize=1000){
 const rows=[]
 for(let offset=0;;offset+=pageSize){
  const route=`/rest/v1/sync_records?select=entity_type,cloud_id,payload,updated_at,deleted_at,version,device_id&workshop_id=eq.${encodeURIComponent(workshopId)}&updated_at=gte.${encodeURIComponent(since)}&order=updated_at.asc,entity_type.asc,cloud_id.asc&limit=${pageSize}&offset=${offset}`
  const page=await fetchPage(route)
  if(!Array.isArray(page))throw new Error('Cloud zwrócił nieprawidłową stronę danych synchronizacji.')
  rows.push(...page)
  if(page.length<pageSize)break
 }
 return rows
}
function pullCursor(c,pending,now=Date.now()){const fullAt=Date.parse(c.lastFullSyncAt||'');const recover=!pending&&(Number(c.syncCursorVersion||0)<2||!Number.isFinite(fullAt)||now-fullAt>=24*60*60*1000);return {recover,since:recover?'1970-01-01T00:00:00.000Z':c.lastSync||'1970-01-01T00:00:00.000Z'}}
async function pullChanges(c,db,forceFull=false){const workshopId=c.workshopId||c.user?.id;if(!workshopId)throw new Error('Brak ID warsztatu.');const {recover,since}=forceFull?{recover:true,since:'1970-01-01T00:00:00.000Z'}:pullCursor(c,db.prepare('SELECT COUNT(*) c FROM sync_queue').get()?.c||0);const rows=await fetchSyncPages(workshopId,since,route=>request(c,route,{method:'GET'}));db.prepare("INSERT INTO sync_meta(key,value) VALUES ('applying_remote','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();let pulled=0;try{const order=['app_settings','customers','suppliers','inventory_parts','vehicles','orders','diagnostics','order_notes','job_part_orders','order_items','work_logs','communications','approvals','order_events','payments','sales_refs','service_reminders_v2','appointments','attachments','signatures','work_procedure_runs','technical_data_entries','vehicle_findings','order_qc','work_templates','technical_manual_pages','technical_manual_hotspots','technical_manual_steps'];for(const table of order)for(const r of rows.filter(x=>x.entity_type===table)){if(r.deleted_at)applyRemoteDeletion(db,table,r);else{let payload=r.payload||{};if(table==='attachments')payload=await materializeAttachment(c,db,r.cloud_id,payload);applyPayload(db,table,r.cloud_id,payload,r.updated_at)}pulled++}reconcileOrderTotals(db)}finally{db.prepare("INSERT INTO sync_meta(key,value) VALUES ('applying_remote','0') ON CONFLICT(key) DO UPDATE SET value='0'").run()}saveConfig({lastSync:rows.length?rows[rows.length-1].updated_at:c.lastSync||'',syncCursorVersion:recover?2:Number(c.syncCursorVersion||0),lastFullSyncAt:recover?new Date().toISOString():c.lastFullSyncAt||''});return pulled}
function remoteApprovalFields(){return 'id,approval_local_id,status,customer_note,decided_at,created_at,expires_at,snapshot,snapshot_hash,hash_algorithm,terms_version,terms_text,signature_storage_path,signature_hash,pdf_storage_path,pdf_hash,client_user_agent,document_no,approval_sequence,previously_approved_total,security_event'}
function updateLocalEvidence(db,approvalId,row){
  db.prepare(`UPDATE approvals SET remote_id=?,snapshot_json=?,snapshot_hash=?,hash_algorithm=?,terms_version=?,terms_text=?,signature_storage_path=?,signature_hash=?,pdf_storage_path=?,pdf_hash=?,remote_expires_at=?,remote_synced_at=CURRENT_TIMESTAMP,client_user_agent=?,document_no=?,approval_sequence=?,previously_approved_total=? WHERE id=?`).run(
    row.id||null,JSON.stringify(row.snapshot||{}),row.snapshot_hash||'',row.hash_algorithm||'SHA-256',row.terms_version||'',row.terms_text||'',row.signature_storage_path||'',row.signature_hash||'',row.pdf_storage_path||'',row.pdf_hash||'',row.expires_at||null,row.client_user_agent||'',row.document_no||'',Number(row.approval_sequence||1),Number(row.previously_approved_total||0),Number(approvalId))
}
async function archiveApprovalSidecars(approval,pdfPath,snapshot,c,{force=false}={}){
  const files=approvalEvidencePaths(pdfPath);let signatureFile=''
  if(approval.signature_storage_path){
    signatureFile=files.signature
    const valid=fs.existsSync(signatureFile)&&(!approval.signature_hash||fileHash(signatureFile)===String(approval.signature_hash).toLowerCase())
    if(force||!valid)await storageDownloadFrom(c,'approval-evidence',approval.signature_storage_path,signatureFile)
    if(approval.signature_hash&&fileHash(signatureFile)!==String(approval.signature_hash).toLowerCase()){try{fs.unlinkSync(signatureFile)}catch{};throw new Error('Suma kontrolna pobranego podpisu jest niezgodna.')}
  }
  return writeApprovalManifest(pdfPath,approval,snapshot,signatureFile)
}
async function archiveApprovalPdf(approvalId,{force=false,c=loadConfig(),db=getDb()}={}){
  const approval=db.prepare('SELECT * FROM approvals WHERE id=?').get(Number(approvalId));if(!approval)throw new Error('Akceptacja nie istnieje.')
  if(!approval.pdf_storage_path)throw new Error('Dokument PDF nie jest jeszcze dostępny w chmurze.')
  let snapshot={};try{snapshot=JSON.parse(approval.snapshot_json||'{}')}catch{}
  if(!force&&approval.local_pdf_path&&approvalArchiveState(approval)==='VALID'){const evidence=await archiveApprovalSidecars(approval,approval.local_pdf_path,snapshot,c);return {ok:true,path:approval.local_pdf_path,folder:path.dirname(approval.local_pdf_path),downloaded:false,evidence}}
  const vehicle=db.prepare(`SELECT v.* FROM orders o JOIN vehicles v ON v.id=o.vehicle_id WHERE o.id=?`).get(approval.order_id);if(!vehicle)throw new Error('Nie znaleziono pojazdu dla dokumentu.')
  const base=archiveBasePath(app,db),archive=vehicleArchiveFolder(db,base,vehicle),name=approvalFileName(snapshot,approval.decided_at),dest=chooseDestination(archive.folder,name,approval.pdf_hash||'')
  await storageDownloadFrom(c,'approval-evidence',approval.pdf_storage_path,dest)
  if(approval.pdf_hash&&fileHash(dest)!==approval.pdf_hash){try{fs.unlinkSync(dest)}catch{};throw new Error('Suma kontrolna pobranego PDF jest niezgodna.')}
  const evidence=await archiveApprovalSidecars(approval,dest,snapshot,c,{force})
  db.prepare("INSERT INTO sync_meta(key,value) VALUES ('applying_remote','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();try{db.prepare('UPDATE approvals SET local_pdf_path=?,archive_vehicle_key=?,remote_synced_at=CURRENT_TIMESTAMP WHERE id=?').run(dest,archive.folderName,approval.id)}finally{db.prepare("INSERT INTO sync_meta(key,value) VALUES ('applying_remote','0') ON CONFLICT(key) DO UPDATE SET value='0'").run()}
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(approval.order_id,'APPROVAL_SYNCED','Dokument akceptacji zapisany lokalnie',dest)
  if(approval.remote_id)try{const workshopId=c.workshopId||c.user?.id;await request(c,'/rest/v1/customer_approval_events',{method:'POST',body:JSON.stringify({workshop_id:workshopId,approval_id:approval.remote_id,event_type:'APPROVAL_SYNCED',details:{device_id:c.deviceId||'',local_hash:approval.pdf_hash||''}})})}catch{}
  return {ok:true,path:dest,folder:archive.folder,downloaded:true,evidence}
}
async function syncApprovalArchive(){const db=getDb(),rows=db.prepare("SELECT * FROM approvals WHERE status='APPROVED' AND pdf_storage_path!='' ORDER BY id").all().filter(row=>approvalEvidenceState(row)!=='COMPLETE');let completed=0,downloaded=0;const errors=[];for(const row of rows){try{const result=await archiveApprovalPdf(row.id);completed++;if(result.downloaded)downloaded++}catch(error){errors.push({id:row.id,error:String(error.message||error)})}}return {ok:errors.length===0,completed,downloaded,errors,pending:rows.length-completed}}
async function downloadApprovalSignature(approvalId){const db=getDb(),row=db.prepare('SELECT * FROM approvals WHERE id=?').get(Number(approvalId));if(!row?.signature_storage_path)throw new Error('Podpis nie jest jeszcze dostępny.');const archived=row.local_pdf_path?approvalEvidencePaths(row.local_pdf_path).signature:'',dest=archived||path.join(app.getPath('userData'),'approval-evidence-cache',`signature-${Number(approvalId)}.png`);if(!fs.existsSync(dest)||row.signature_hash&&fileHash(dest)!==row.signature_hash)await storageDownloadFrom(loadConfig(),'approval-evidence',row.signature_storage_path,dest);if(row.signature_hash&&fileHash(dest)!==row.signature_hash)throw new Error('Suma kontrolna podpisu jest niezgodna.');return {ok:true,path:dest}}

async function scanRemoteApprovals(c=loadConfig(),db=getDb()){
  const workshopId=c.workshopId||c.user?.id;if(!workshopId)return [];
  const rows=await request(c,`/rest/v1/customer_approval_links?select=${remoteApprovalFields()}&workshop_id=eq.${encodeURIComponent(workshopId)}&order=created_at.desc&limit=500`,{method:'GET'})||[];
  const changed=[];
  for(const source of latestRemoteApprovals(rows)){
    const r=effectiveRemoteApproval(source)
    const approval=db.prepare('SELECT * FROM approvals WHERE id=?').get(Number(r.approval_local_id));
    if(!approval)continue;
    updateLocalEvidence(db,approval.id,r)
    const outcome=remoteApprovalOutcome(r.status)
    if(!outcome.terminal)continue
    if(approval.status!=='PENDING'){if(r.status==='APPROVED'&&r.pdf_storage_path&&(!approval.local_pdf_path||!fs.existsSync(approval.local_pdf_path)))try{await archiveApprovalPdf(approval.id,{c,db})}catch{};continue}
    const order=db.prepare(`SELECT o.id,o.title,v.plate,v.make,v.model,c.name customer FROM orders o JOIN vehicles v ON v.id=o.vehicle_id LEFT JOIN customers c ON c.id=v.customer_id WHERE o.id=?`).get(approval.order_id)||{};
    const decidedAt=r.decided_at||new Date().toISOString();
    let prepared={prepared:false,parts:0};
    db.transaction(()=>{
      db.prepare(`UPDATE approvals SET status=?,note=CASE WHEN ?!='' THEN ? ELSE note END,decided_at=? WHERE id=?`).run(r.status,r.customer_note||'',r.customer_note||'',decidedAt,approval.id);
      if(r.status==='APPROVED')prepared=materializeApprovedQuote(db,approval);else db.prepare(`UPDATE orders SET wait_state='DECYZJA' WHERE id=?`).run(approval.order_id);
      db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(approval.order_id,'REMOTE_APPROVAL',outcome.eventTitle,`${Number(approval.amount||0).toFixed(2)} zł${r.customer_note?` · ${r.customer_note}`:''}`);
    })();
    const item={approvalId:approval.id,orderId:approval.order_id,status:r.status,amount:Number(approval.amount||0),note:r.customer_note||'',decidedAt,customer:order.customer||'',plate:order.plate||'',vehicle:`${order.make||''} ${order.model||''}`.trim(),title:order.title||'',prepared:prepared.prepared,partsPrepared:prepared.parts||0,toastTitle:outcome.toastTitle,tone:outcome.tone,icon:outcome.icon};
    changed.push(item);events.emit('remote-approval',item);
    if(r.status==='APPROVED'&&r.pdf_storage_path)try{await archiveApprovalPdf(approval.id,{c,db})}catch(error){item.archiveError=String(error.message||error)}
  }
  return changed;
}
function queueState(db){
 const queue=db.prepare(`SELECT id,entity_type,row_id,operation,queued_at,attempts,last_error FROM sync_queue ORDER BY CASE WHEN last_error IS NOT NULL AND last_error!='' THEN 0 ELSE 1 END,id LIMIT 20`).all()
 const groups=db.prepare(`SELECT entity_type,COUNT(*) total,SUM(CASE WHEN last_error IS NOT NULL AND last_error!='' THEN 1 ELSE 0 END) failed FROM sync_queue GROUP BY entity_type ORDER BY total DESC,entity_type`).all()
 const totals=db.prepare(`SELECT COUNT(*) pending,SUM(CASE WHEN last_error IS NOT NULL AND last_error!='' THEN 1 ELSE 0 END) failed,MIN(queued_at) oldest FROM sync_queue`).get()
 return {pending:Number(totals?.pending||0),failed:Number(totals?.failed||0),oldestPending:totals?.oldest||'',queue,groups:groups.map(row=>({...row,total:Number(row.total||0),failed:Number(row.failed||0)}))}
}
function rememberResult(result){try{saveConfig({lastResult:{ok:!!result.ok,error:result.error||'',pushed:Number(result.pushed||0),pulled:Number(result.pulled||0),conflicts:Number(result.conflicts||0),pending:Number(result.pending||0),at:result.at||new Date().toISOString()}})}catch{}return result}
async function syncNow(){
 if(running)return {ok:false,busy:true}
 let c=loadConfig()
 if(!isConfigured(c))return rememberResult({ok:false,error:'Skonfiguruj URL i anon/publishable key Supabase.',at:new Date().toISOString()})
 if(!c.accessToken)return rememberResult({ok:false,error:'Zaloguj się do Autologika Cloud.',at:new Date().toISOString()})
 running=true
 try{
  const binding=bindAccount(c,c.user?.id);c=saveConfig({...binding,syncOwnerId:c.user.id})
  const db=getDb()
  let batch=await pushQueue(c,db),pushed=batch.pushed,conflicts=batch.conflicts
  c=loadConfig()
  let pulled=await pullChanges(c,db,conflicts>0)
  c=loadConfig()
  const remoteApprovals=await scanRemoteApprovals(c,db)
  if(remoteApprovals.length){
   batch=await pushQueue(c,db);pushed+=batch.pushed;conflicts+=batch.conflicts
   if(batch.conflicts){c=loadConfig();pulled+=await pullChanges(c,db,true)}
  }
  const result={ok:true,pushed,pulled,conflicts,remoteApprovals,at:new Date().toISOString(),pending:db.prepare('SELECT COUNT(*) c FROM sync_queue').get().c}
  rememberResult(result);events.emit('sync-complete',result);return result
 }catch(e){const db=getDb(),result={ok:false,error:String(e.message||e),at:new Date().toISOString(),pending:db.prepare('SELECT COUNT(*) c FROM sync_queue').get().c};return rememberResult(result)}
 finally{running=false}
}
function status(){const c=loadConfig(),db=getDb();return {configured:isConfigured(c),loggedIn:!!c.accessToken,email:c.user?.email||'',workshopId:c.workshopId||c.user?.id||'',enabled:c.enabled,running,lastSync:c.lastSync||'',lastResult:c.lastResult||null,deviceName:c.deviceName,deviceId:c.deviceId,intervalSeconds:c.intervalSeconds,url:c.url,...queueState(db)}}
async function retryPending(id){const db=getDb(),row=db.prepare('SELECT id FROM sync_queue WHERE id=?').get(Number(id));if(!row)return {ok:false,error:'Ta zmiana nie oczekuje już na wysłanie.'};db.prepare('UPDATE sync_queue SET attempts=0,last_error=NULL WHERE id=?').run(row.id);return syncNow()}
function startAuto(){stopAuto();const c=loadConfig();if(c.enabled&&isConfigured(c)&&c.accessToken){timer=setInterval(()=>syncNow().catch(()=>{}),c.intervalSeconds*1000);setTimeout(()=>syncNow().catch(()=>{}),2500)}}
function stopAuto(){if(timer){clearInterval(timer);timer=null}}

async function createRemoteApproval(input){
  let c=loadConfig(); const t=await token(c); c=t.c; const workshopId=c.workshopId||c.user?.id; if(!workshopId)throw new Error('Brak ID warsztatu.');
  const built=buildApprovalSnapshot(getDb(),Number(input?.approvalId)),tokenValue=crypto.randomBytes(32).toString('hex'),tokenHash=sha256(tokenValue)
  const row={workshop_id:workshopId,token:tokenHash,token_hash:tokenHash,approval_local_id:built.approval.id,approval_cloud_id:built.approval.cloud_id||null,order_local_id:built.approval.order_id,order_cloud_id:built.order.cloud_id||null,snapshot:built.snapshot,snapshot_hash:built.snapshotHash,hash_algorithm:built.hashAlgorithm,terms_version:built.snapshot.terms.version,terms_text:built.snapshot.terms.text,document_no:built.snapshot.approvalDocumentNo,approval_sequence:built.sequence,previously_approved_total:built.previouslyApprovedTotal,expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString()}
  const inserted=await request(c,'/rest/v1/customer_approval_links',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(row)}),remote=Array.isArray(inserted)?inserted[0]:inserted
  if(['EXPIRED','SUPERSEDED'].includes(built.approval.status))getDb().prepare("UPDATE approvals SET status='PENDING',decided_at=NULL WHERE id=?").run(built.approval.id)
  updateLocalEvidence(getDb(),built.approval.id,{...row,id:remote?.id||null})
  return {ok:true,url:`${c.url}/functions/v1/approval?t=${tokenValue}`,expiresAt:row.expires_at,snapshotHash:built.snapshotHash};
}
async function pullRemoteApproval(approvalId){
  let c=loadConfig(); const workshopId=c.workshopId||c.user?.id; if(!workshopId)throw new Error('Brak ID warsztatu.');
  const rows=await request(c,`/rest/v1/customer_approval_links?select=${remoteApprovalFields()}&approval_local_id=eq.${Number(approvalId)}&workshop_id=eq.${encodeURIComponent(workshopId)}&order=created_at.desc&limit=1`,{method:'GET'})||[];
  if(!rows[0])return {ok:false,reason:'NOT_FOUND'}; const r=effectiveRemoteApproval(rows[0]);
  if(r.status!=='PENDING')await scanRemoteApprovals(c,getDb());
  const local=getDb().prepare('SELECT status,note,decided_at FROM approvals WHERE id=?').get(Number(approvalId));
  return {ok:true,...r,status:local?.status||r.status,customer_note:local?.note||r.customer_note||'',decided_at:local?.decided_at||r.decided_at};
}

module.exports={loadConfig,saveConfig,publicConfig,status,syncNow,retryPending,startAuto,stopAuto,login,signup,logout,account,testConnection,createRemoteApproval,pullRemoteApproval,scanRemoteApprovals,archiveApprovalPdf,syncApprovalArchive,downloadApprovalSignature,on:(name,fn)=>events.on(name,fn),_testing:{buildPayload,applyPayload,applyRemoteDeletion,reconcileOrderTotals,queueState,fetchSyncPages,pullCursor,bindAccount,timestampMs,timestampIso,remoteWins,remoteHeadsRoute}}
