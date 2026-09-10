const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Notification } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const os = require('os')
const crypto = require('crypto')
const { getDb, createVersionBackup, databasePath } = require('./db.cjs')
const cloudSync = require('./cloud-sync.cjs')
const updater = require('./updater.cjs')
const { findQuoteApproval, assertQuoteEditable } = require('./quote-approval.cjs')
const { listAppointments, createAppointment, updateAppointment, removeAppointment } = require('./appointments.cjs')
const { deletionPreview, removeEntity } = require('./entity-deletion.cjs')
const { createCustomer, updateCustomer, createVehicle, updateVehicle } = require('./record-editing.cjs')

// Stability: this workshop UI does not need GPU acceleration. Disabling it avoids intermittent black Chromium frames on some Windows/GPU driver combinations.
app.disableHardwareAcceleration()

function createWindow(){
  const win = new BrowserWindow({
    width:1500,height:940,minWidth:1100,minHeight:720,backgroundColor:'#090b0d',
    show:false,
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,
      backgroundThrottling:false
    }
  })
  let crashReloads=0
  win.once('ready-to-show',()=>{ if(!win.isDestroyed()) win.show() })
  win.webContents.on('render-process-gone',(_event,details)=>{
    console.error('[renderer gone]',details)
    if(!win.isDestroyed() && crashReloads<1){ crashReloads++; setTimeout(()=>{ if(!win.isDestroyed()) win.webContents.reloadIgnoringCache() },500) }
  })
  win.webContents.on('unresponsive',()=>console.error('[renderer unresponsive]'))
  win.webContents.on('responsive',()=>console.log('[renderer responsive]'))
  const dev=process.env.VITE_DEV_SERVER_URL
  if(dev) win.loadURL(dev); else win.loadFile(path.join(__dirname,'..','dist','index.html'))
  return win
}

ipcMain.handle('zebra:environment', async()=>{
  const roots=[process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean)
  const candidates=[]
  for(const root of roots){
    for(const rel of ['Zebra Technologies/Barcode Scanners/Common','Zebra Technologies/Barcode Scanners/Scanner SDK']){
      const full=path.join(root,...rel.split('/')); if(fs.existsSync(full)) candidates.push(full)
    }
  }
  let service='UNKNOWN'
  if(process.platform==='win32'){
    try{const {execFileSync}=require('child_process');const out=execFileSync('sc.exe',['query','CoreScanner'],{encoding:'utf8',windowsHide:true,timeout:2500});service=/RUNNING/i.test(out)?'RUNNING':/STOPPED/i.test(out)?'STOPPED':'INSTALLED'}catch{service='NOT_FOUND'}
  }
  return {platform:process.platform,sdkInstalled:candidates.length>0,paths:candidates,coreScannerService:service,ready:process.platform==='win32'&&candidates.length>0&&service==='RUNNING'}
})

function zebraCapturePath(){return path.join(app.getPath('userData'),'zebra-scanner-captures.jsonl')}
ipcMain.handle('zebra:recordCapture',(_event,payload={})=>{
  const capturedAt=String(payload.capturedAt||new Date().toISOString())
  const record={capturedAt,kind:String(payload.kind||'UNKNOWN'),vin:String(payload.vin||''),length:Number(payload.length||0),byteLength:Number(payload.byteLength||0),raw:String(payload.raw||'').slice(0,500000),original:String(payload.original||'').slice(0,500000),sdk:payload.sdk?{source:String(payload.sdk.source||''),scannerId:String(payload.sdk.scannerId||''),model:String(payload.sdk.model||''),serial:String(payload.sdk.serial||''),datatype:String(payload.sdk.datatype||''),hex:String(payload.sdk.hex||'').slice(0,1000000)}:null}
  fs.appendFileSync(zebraCapturePath(),JSON.stringify(record)+'\n','utf8')
  return {ok:true,path:zebraCapturePath(),capturedAt}
})
ipcMain.handle('zebra:capturePath',()=>zebraCapturePath())

app.whenReady().then(async()=>{
  try{getDb()}catch(error){
    const logPath=path.join(app.getPath('userData'),'migration-errors.log')
    try{fs.appendFileSync(logPath,`${new Date().toISOString()} ${error.stack||error}\nBackup: ${error.backupPath||'brak'}\n`,'utf8')}catch{}
    dialog.showErrorBox('Nie udało się zaktualizować bazy danych',`Autologika OS nie uruchomi się, aby chronić dane.\n\n${error.message}\n\nBackup: ${error.backupPath||'nie utworzono'}\nLog: ${logPath}`)
    app.quit();return
  }
  createWindow()
  try{ cloudSync.startAuto() }catch(e){ console.error('[cloud sync autostart]',e) }
  try{ await autoBackupDb() }catch(e){ console.error('[auto backup]',e) }
  try{ const cfg=loadRemoteConfig(); if(cfg.autoStart) await createMobileServer(cfg.port) }catch(e){ console.error('[mobile autostart]',e) }
  updater.init({prepareInstall:prepareUpdateInstall})
  app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})
})
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()})

function rendererLogPath(){ return path.join(app.getPath('userData'),'renderer-errors.log') }
ipcMain.handle('renderer:log',(_event,payload={})=>{
  try{
    const line=JSON.stringify({ts:new Date().toISOString(),...payload})+'\n'
    fs.appendFileSync(rendererLogPath(),line,'utf8')
    return true
  }catch(e){ console.error('renderer log failed',e); return false }
})
ipcMain.handle('renderer:logPath',()=>rendererLogPath())
ipcMain.handle('updater:getStatus',()=>updater.getStatus())
ipcMain.handle('updater:check',()=>updater.check())
ipcMain.handle('updater:download',()=>updater.download())
ipcMain.handle('updater:install',()=>updater.install())
ipcMain.handle('updater:setChannel',(_event,channel)=>updater.setChannel(channel))
ipcMain.handle('updater:logPath',()=>updater.logPath())

ipcMain.handle('cloudSync:config',()=>cloudSync.publicConfig())
ipcMain.handle('cloudSync:status',()=>cloudSync.status())
ipcMain.handle('cloudSync:saveConfig',(_e,cfg)=>{ const cur=cloudSync.loadConfig(); const incoming=String(cfg?.key||'').trim(); const next=cloudSync.saveConfig({...cfg,key:incoming||cur.key}); cloudSync.startAuto(); return cloudSync.publicConfig() })
ipcMain.handle('cloudSync:test',async()=>cloudSync.testConnection())
ipcMain.handle('cloudSync:now',async()=>cloudSync.syncNow())
ipcMain.handle('cloudSync:login',(_e,email,password)=>cloudSync.login(email,password))
ipcMain.handle('cloudSync:signup',(_e,email,password)=>cloudSync.signup(email,password))
ipcMain.handle('cloudSync:logout',()=>cloudSync.logout())
ipcMain.handle('cloudSync:account',()=>cloudSync.account())
ipcMain.handle('cloudSync:createRemoteApproval',(_e,snapshot)=>cloudSync.createRemoteApproval(snapshot))
ipcMain.handle('cloudSync:pullRemoteApproval',(_e,approvalId)=>cloudSync.pullRemoteApproval(approvalId))

ipcMain.handle('settings:getMonthlyTarget',()=>{
  const row=getDb().prepare("SELECT value FROM app_settings WHERE setting_key='monthly_target' LIMIT 1").get()
  const n=Number(row?.value||50000)
  return Number.isFinite(n)&&n>=1000?n:50000
})
ipcMain.handle('settings:setMonthlyTarget',(_e,value)=>{
  const target=Math.max(1000,Math.min(10000000,Math.round(Number(value)||50000)))
  getDb().prepare("INSERT INTO app_settings(setting_key,value,cloud_id,updated_at) VALUES ('monthly_target',?,'monthly-target',CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,'monthly-target'),updated_at=CURRENT_TIMESTAMP").run(String(target))
  return target
})

ipcMain.handle('settings:getCatalogPrices',()=>{
  const row=getDb().prepare("SELECT value FROM app_settings WHERE setting_key='work_catalog_prices_v1' LIMIT 1").get()
  try{ const x=JSON.parse(row?.value||'{}'); return x&&typeof x==='object'?x:{} }catch{return {}}
})
ipcMain.handle('settings:setCatalogPrice',(_e,{key,price})=>{
  const db=getDb(); const row=db.prepare("SELECT value FROM app_settings WHERE setting_key='work_catalog_prices_v1' LIMIT 1").get()
  let map={}; try{map=JSON.parse(row?.value||'{}')||{}}catch{}
  const n=Math.max(0,Math.round((Number(price)||0)*100)/100); if(key) map[String(key)]=n
  db.prepare("INSERT INTO app_settings(setting_key,value,cloud_id,updated_at) VALUES ('work_catalog_prices_v1',?,'work-catalog-prices-v1',CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,'work-catalog-prices-v1'),updated_at=CURRENT_TIMESTAMP").run(JSON.stringify(map))
  return n
})
ipcMain.handle('settings:resetCatalogPrice',(_e,key)=>{
  const db=getDb(); const row=db.prepare("SELECT value FROM app_settings WHERE setting_key='work_catalog_prices_v1' LIMIT 1").get()
  let map={}; try{map=JSON.parse(row?.value||'{}')||{}}catch{}
  delete map[String(key||'')]
  db.prepare("INSERT INTO app_settings(setting_key,value,cloud_id,updated_at) VALUES ('work_catalog_prices_v1',?,'work-catalog-prices-v1',CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,'work-catalog-prices-v1'),updated_at=CURRENT_TIMESTAMP").run(JSON.stringify(map))
  return true
})

ipcMain.handle('settings:setCatalogPricesBulk',(_e,updates)=>{
  const db=getDb(); const row=db.prepare("SELECT value FROM app_settings WHERE setting_key='work_catalog_prices_v1' LIMIT 1").get()
  let map={}; try{map=JSON.parse(row?.value||'{}')||{}}catch{}
  for(const [key,price] of Object.entries(updates||{})){ if(!key) continue; map[String(key)]=Math.max(0,Math.round((Number(price)||0)*100)/100) }
  db.prepare("INSERT INTO app_settings(setting_key,value,cloud_id,updated_at) VALUES ('work_catalog_prices_v1',?,'work-catalog-prices-v1',CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,'work-catalog-prices-v1'),updated_at=CURRENT_TIMESTAMP").run(JSON.stringify(map))
  return map
})
ipcMain.handle('settings:resetCatalogPricesBulk',(_e,keys)=>{
  const db=getDb(); const row=db.prepare("SELECT value FROM app_settings WHERE setting_key='work_catalog_prices_v1' LIMIT 1").get()
  let map={}; try{map=JSON.parse(row?.value||'{}')||{}}catch{}
  for(const key of (Array.isArray(keys)?keys:[])) delete map[String(key)]
  db.prepare("INSERT INTO app_settings(setting_key,value,cloud_id,updated_at) VALUES ('work_catalog_prices_v1',?,'work-catalog-prices-v1',CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,'work-catalog-prices-v1'),updated_at=CURRENT_TIMESTAMP").run(JSON.stringify(map))
  return map
})

const readCatalogOverrides=()=>{const row=getDb().prepare("SELECT value FROM app_settings WHERE setting_key='work_catalog_overrides_v2' LIMIT 1").get();try{const value=JSON.parse(row?.value||'{}');return value&&typeof value==='object'?value:{}}catch{return {}}}
const writeCatalogOverrides=map=>{getDb().prepare("INSERT INTO app_settings(setting_key,value,cloud_id,updated_at) VALUES ('work_catalog_overrides_v2',?,'work-catalog-overrides-v2',CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET value=excluded.value,cloud_id=COALESCE(app_settings.cloud_id,'work-catalog-overrides-v2'),updated_at=CURRENT_TIMESTAMP").run(JSON.stringify(map));return map}
ipcMain.handle('settings:getCatalogOverrides',()=>readCatalogOverrides())
ipcMain.handle('settings:setCatalogOverride',(_e,{variantId,data})=>{const map=readCatalogOverrides();if(variantId)map[String(variantId)]={...(map[String(variantId)]||{}),...(data||{})};return writeCatalogOverrides(map)})
ipcMain.handle('settings:resetCatalogOverride',(_e,variantId)=>{const map=readCatalogOverrides();delete map[String(variantId||'')];return writeCatalogOverrides(map)})


const orderSelect = `SELECT o.*,v.id vehicle_id,v.plate,v.make,v.model,v.generation,v.year,v.vin,v.mileage,v.engine,v.power_hp,v.engine_code,c.name customer,c.phone,c.email,
  ROUND(o.labor_hours*o.labor_rate+o.parts_sale+o.other_sale+o.diagnosis_fee-o.discount,2) total,
  ROUND((o.labor_hours*o.labor_rate+o.parts_sale+o.other_sale+o.diagnosis_fee-o.discount)-(o.parts_cost+o.other_cost),2) contribution
  FROM orders o JOIN vehicles v ON v.id=o.vehicle_id JOIN customers c ON c.id=v.customer_id`



const AUTLOGIKA_DOCUMENTS = [
  {id:'growth-strategy', file:'Autologika_Growth_Strategy_2026_2029.pdf', title:'Growth Strategy 2026–2029', category:'Strategia', description:'Strategia wzrostu Autologiki: pozycjonowanie, specjalizacje, przychody, procesy i rozwój marki.'},
  {id:'financial-roadmap', file:'Autologika_Financial_Model_Roadmap_2026_2028.pdf', title:'Financial Model & Roadmap 2026–2028', category:'Finanse', description:'Model finansowy, progi przychodów, rentowność, zatrudnienie i kolejne etapy rozwoju.'},
  {id:'launch-plan', file:'Autologika_Launch_Plan_90_Dni.pdf', title:'Launch Plan — 90 dni', category:'Uruchomienie', description:'Plan pierwszych 90 dni budowy i rozpędzania warsztatu.'},
  {id:'operating-system', file:'Autologika_Operating_System_Formularze.pdf', title:'Operating System — Formularze', category:'Procesy', description:'Formularze i standardy operacyjne do przyjęcia, diagnozy, naprawy i wydania pojazdu.'},
  {id:'marketing-system', file:'Autologika_Customer_Marketing_System_90_Dni.pdf', title:'Customer & Marketing System — 90 dni', category:'Marketing', description:'System pozyskiwania klientów, komunikacji i marketingu warsztatu.'}
]
function documentsDir(){ return path.join(app.getAppPath(),'documents') }
ipcMain.handle('documents:list',()=>AUTLOGIKA_DOCUMENTS.map(d=>({...d,exists:fs.existsSync(path.join(documentsDir(),d.file))})))
ipcMain.handle('documents:open',async(_,id)=>{
  const d=AUTLOGIKA_DOCUMENTS.find(x=>x.id===id); if(!d) throw new Error('Nieznany dokument')
  const filePath=path.join(documentsDir(),d.file); if(!fs.existsSync(filePath)) throw new Error('Brak pliku dokumentu')
  const err=await shell.openPath(filePath); if(err) throw new Error(err); return true
})
ipcMain.handle('documents:reveal',async(_,id)=>{
  const d=AUTLOGIKA_DOCUMENTS.find(x=>x.id===id); if(!d) throw new Error('Nieznany dokument')
  const filePath=path.join(documentsDir(),d.file); if(!fs.existsSync(filePath)) throw new Error('Brak pliku dokumentu')
  shell.showItemInFolder(filePath); return true
})

let mobileServer=null
let mobileServerPort=8787
let mobileServerPin=null
function remoteConfigPath(){ return path.join(app.getPath('userData'),'remote-access.json') }
function loadRemoteConfig(){
  const base={port:8787,pin:'',autoStart:false}
  try{ return {...base,...JSON.parse(fs.readFileSync(remoteConfigPath(),'utf8'))} }catch{return base}
}
function saveRemoteConfig(cfg={}){
  const cur=loadRemoteConfig(), next={...cur,...cfg}
  next.port=Math.max(1024,Math.min(65535,Number(next.port)||8787))
  next.pin=String(next.pin||'').replace(/\D/g,'').slice(0,12)
  next.autoStart=!!next.autoStart
  fs.writeFileSync(remoteConfigPath(),JSON.stringify(next,null,2),'utf8')
  return next
}
function localIPv4(){
  const out=[]
  for(const [name,list] of Object.entries(os.networkInterfaces())) for(const x of list||[]) if(x.family==='IPv4'&&!x.internal) out.push({name,address:x.address})
  const seen=new Set(); return out.filter(x=>!seen.has(x.address)&&seen.add(x.address))
}
function isTailscaleIp(ip){
  const m=String(ip).match(/^100\.(\d+)\./); if(!m)return false; const second=Number(m[1]); return second>=64&&second<=127
}
function mobileStatus(){
  const nets=localIPv4(),running=!!mobileServer
  const ips=nets.map(x=>x.address), urls=running?ips.map(ip=>`http://${ip}:${mobileServerPort}`):[]
  const remoteIps=nets.filter(x=>isTailscaleIp(x.address)||/tailscale/i.test(x.name)).map(x=>x.address)
  return{running,port:mobileServerPort,pin:running?mobileServerPin:null,ips,urls,remoteIps,remoteUrls:running?remoteIps.map(ip=>`http://${ip}:${mobileServerPort}`):[]}
}
function sendJson(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function readJson(req){return new Promise((resolve,reject)=>{let data='';req.on('data',c=>{data+=c;if(data.length>2000000){reject(new Error('Za duże żądanie'));req.destroy()}});req.on('end',()=>{try{resolve(data?JSON.parse(data):{})}catch(e){reject(e)}});req.on('error',reject)})}
function mobileAuthorized(req,p){if(p==='/'||p==='/app'||p==='/health'||p==='/api/login')return true;return String(req.headers['x-autologika-pin']||'')===String(mobileServerPin||'')}
function notifyDesktopSync(reason='mobile'){for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed())w.webContents.send('sync:changed',{reason,at:Date.now()})}
cloudSync.on('remote-approval',data=>{
  notifyDesktopSync('remote-approval')
  for(const w of BrowserWindow.getAllWindows())if(!w.isDestroyed())w.webContents.send('cloud:remoteApproval',data)
  try{
    if(Notification.isSupported()){
      const approved=data.status==='APPROVED'
      const n=new Notification({title:approved?'✓ Klient zaakceptował kosztorys':'× Klient odrzucił kosztorys',body:`${data.plate||'Zlecenie #'+data.orderId} · ${Number(data.amount||0).toLocaleString('pl-PL',{style:'currency',currency:'PLN'})}`})
      n.on('click',()=>{const w=BrowserWindow.getAllWindows()[0];if(w&&!w.isDestroyed()){w.show();w.focus();w.webContents.send('cloud:remoteApprovalOpen',data)}})
      n.show()
    }
  }catch(e){console.error('[remote approval notification]',e)}
})
function createMobileServer(port=8787){
  if(mobileServer)return Promise.resolve(mobileStatus())
  const cfg=loadRemoteConfig(); mobileServerPort=Number(port)||Number(cfg.port)||8787; mobileServerPin=String(cfg.pin||Math.floor(100000+Math.random()*900000)); if(!cfg.pin) saveRemoteConfig({...cfg,port:mobileServerPort,pin:mobileServerPin})
  return new Promise((resolve,reject)=>{
    const srv=http.createServer(async(req,res)=>{try{
      const u=new URL(req.url,`http://${req.headers.host||'localhost'}`),p=u.pathname
      if(req.method==='GET'&&(p==='/'||p==='/app')){const html=fs.readFileSync(path.join(__dirname,'mobile.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(html)}
      if(req.method==='GET'&&p==='/health')return sendJson(res,200,{ok:true,name:'Autologika OS Mobile'})
      if(req.method==='POST'&&p==='/api/login'){const d=await readJson(req),ok=String(d.pin||'')===String(mobileServerPin);return sendJson(res,ok?200:401,{ok})}
      if(!mobileAuthorized(req,p))return sendJson(res,401,{error:'Nieprawidłowy PIN'})
      if(req.method==='GET'&&p==='/api/orders'){const rows=getDb().prepare(`${orderSelect} WHERE o.status!='WYDANE' ORDER BY o.opened_at DESC LIMIT 100`).all();return sendJson(res,200,rows)}
      if(req.method==='GET'&&p==='/api/sync'){return sendJson(res,200,{ok:true,serverTime:new Date().toISOString()})}
      const orderMatch=p.match(/^\/api\/order\/(\d+)$/)
      const notesMatch=p.match(/^\/api\/order\/(\d+)\/notes$/)
      const diagMatch=p.match(/^\/api\/order\/(\d+)\/diagnostics$/)
      if(orderMatch&&req.method==='GET'){
        const id=Number(orderMatch[1]),db=getDb(),order=db.prepare(`${orderSelect} WHERE o.id=?`).get(id)
        if(!order)return sendJson(res,404,{error:'Nie znaleziono zlecenia'})
        const notes=db.prepare('SELECT * FROM order_notes WHERE order_id=?').get(id)||{}
        const diag=db.prepare('SELECT * FROM diagnostics WHERE order_id=?').get(id)||{}
        const parts=db.prepare(`SELECT jp.*,s.name supplier FROM job_part_orders jp LEFT JOIN suppliers s ON s.id=jp.supplier_id WHERE jp.order_id=? ORDER BY jp.created_at DESC`).all(id)
        const payments=db.prepare('SELECT * FROM payments WHERE order_id=? ORDER BY paid_at DESC').all(id)
        return sendJson(res,200,{order,notes,diag,parts,payments})
      }
      if(orderMatch&&req.method==='PATCH'){
        const id=Number(orderMatch[1]),d=await readJson(req),db=getDb(),allowedStatus=['PRZYJETE','DIAGNOZA','AKCEPTACJA','NAPRAWA','GOTOWE','WYDANE'],allowedWait=['BRAK','KLIENT','CZESCI','DECYZJA']
        if(d.status&&allowedStatus.includes(d.status))db.prepare('UPDATE orders SET status=? WHERE id=?').run(d.status,id)
        if(d.wait_state&&allowedWait.includes(d.wait_state))db.prepare('UPDATE orders SET wait_state=? WHERE id=?').run(d.wait_state,id)
        db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(id,'MOBILE_UPDATE','Zmiana z tabletu',JSON.stringify({status:d.status||null,wait_state:d.wait_state||null}))
        notifyDesktopSync('order-update');return sendJson(res,200,{ok:true})
      }
      if(notesMatch&&req.method==='PUT'){
        const id=Number(notesMatch[1]),d=await readJson(req),db=getDb()
        db.prepare(`INSERT INTO order_notes(order_id,intake_notes,release_notes,qc_notes) VALUES (?,?,?,?) ON CONFLICT(order_id) DO UPDATE SET intake_notes=excluded.intake_notes,release_notes=excluded.release_notes,qc_notes=excluded.qc_notes`).run(id,d.intake_notes||'',d.release_notes||'',d.qc_notes||'')
        notifyDesktopSync('notes');return sendJson(res,200,{ok:true})
      }
      if(diagMatch&&req.method==='PUT'){
        const id=Number(diagMatch[1]),d=await readJson(req),db=getDb()
        const ex=db.prepare('SELECT id FROM diagnostics WHERE order_id=? ORDER BY id DESC LIMIT 1').get(id)
        if(ex)db.prepare(`UPDATE diagnostics SET symptom_confirmed=?,dtcs=?,measurements=?,hypothesis=?,conclusion=?,recommendation=?,time_hours=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(d.symptom_confirmed||'',d.dtcs||'',d.measurements||'',d.hypothesis||'',d.conclusion||'',d.recommendation||'',Number(d.time_hours||0),ex.id)
        else db.prepare(`INSERT INTO diagnostics(order_id,symptom_confirmed,dtcs,measurements,hypothesis,conclusion,recommendation,time_hours) VALUES (?,?,?,?,?,?,?,?)`).run(id,d.symptom_confirmed||'',d.dtcs||'',d.measurements||'',d.hypothesis||'',d.conclusion||'',d.recommendation||'',Number(d.time_hours||0))
        notifyDesktopSync('diagnostics');return sendJson(res,200,{ok:true})
      }
      if(req.method==='POST'&&p==='/api/intake'){
        const d=await readJson(req),db=getDb()
        const result=db.transaction(()=>{
          const phone=String(d.customer_phone||'').trim(),vin=String(d.vin||'').trim().toUpperCase(),plate=String(d.plate||'').trim().toUpperCase()
          let c=phone?db.prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','')=? ORDER BY id DESC LIMIT 1").get(phone.replace(/[ -]/g,'')):null
          if(!c){const r=db.prepare('INSERT INTO customers(name,phone,email,company,notes) VALUES (?,?,?,?,?)').run(d.customer_name||'Klient',phone,'','','');c={id:r.lastInsertRowid}}
          let v=vin?db.prepare('SELECT * FROM vehicles WHERE UPPER(vin)=? LIMIT 1').get(vin):null
          if(!v&&plate)v=db.prepare('SELECT * FROM vehicles WHERE customer_id=? AND UPPER(plate)=? ORDER BY id DESC LIMIT 1').get(c.id,plate)
          if(!v){const r=db.prepare('INSERT INTO vehicles(customer_id,plate,vin,make,model,year,engine,mileage,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(c.id,plate,vin,d.make||'',d.model||'',null,d.engine||'',+d.mileage||0,'');v={id:r.lastInsertRowid}}
          const o=db.prepare(`INSERT INTO orders(vehicle_id,title,complaint,status,priority,diagnosis_limit,labor_rate,diagnosis_fee,source,wait_state) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(v.id,d.title||'Diagnostyka / naprawa',d.complaint||'','PRZYJETE','NORMALNY',350,220,0,'mobile','BRAK')
          db.prepare(`INSERT INTO order_notes(order_id,intake_notes,release_notes,qc_notes) VALUES (?,?,?,?)`).run(o.lastInsertRowid,'','','')
          db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(o.lastInsertRowid,'INTAKE','Przyjęcie mobilne',d.complaint||'')
          return{order_id:o.lastInsertRowid}
        })()
        notifyDesktopSync('intake');return sendJson(res,200,result)
      }
      return sendJson(res,404,{error:'Nie znaleziono'})
    }catch(e){console.error('mobile server',e);try{sendJson(res,500,{error:e.message||'Błąd serwera'})}catch{}}})
    srv.on('error',reject);srv.listen(mobileServerPort,'0.0.0.0',()=>{mobileServer=srv;resolve(mobileStatus())})
  })
}
function stopMobileServer(){return new Promise(resolve=>{if(!mobileServer){mobileServerPin=null;return resolve(mobileStatus())}const s=mobileServer;mobileServer=null;s.close(()=>{mobileServerPin=null;resolve(mobileStatus())})})}
ipcMain.handle('mobileServer:start',(_,port)=>createMobileServer(port))
ipcMain.handle('mobileServer:stop',()=>stopMobileServer())
ipcMain.handle('mobileServer:status',()=>mobileStatus())
ipcMain.handle('mobileServer:config',()=>loadRemoteConfig())
ipcMain.handle('mobileServer:saveConfig',(_e,cfg)=>{ if(mobileServer) throw new Error('Wyłącz serwer przed zmianą ustawień zdalnych.'); return saveRemoteConfig(cfg) })

function partMarkup(cost){ cost=Number(cost||0); if(cost<=50)return .40;if(cost<=200)return .30;if(cost<=500)return .25;if(cost<=1500)return .20;if(cost<=3000)return .15;return .12 }
function syncOrderItemTotals(orderId){
  const db=getDb(); const s=db.prepare(`SELECT COALESCE(SUM(CASE WHEN kind='CZESC' THEN qty*unit_cost ELSE 0 END),0) pc,COALESCE(SUM(CASE WHEN kind='CZESC' THEN qty*unit_price ELSE 0 END),0) ps,COALESCE(SUM(CASE WHEN kind!='CZESC' THEN qty*unit_cost ELSE 0 END),0) oc,COALESCE(SUM(CASE WHEN kind!='CZESC' THEN qty*unit_price ELSE 0 END),0) os FROM order_items WHERE order_id=?`).get(orderId)
  db.prepare('UPDATE orders SET parts_cost=?,parts_sale=?,other_cost=?,other_sale=? WHERE id=?').run(s.pc,s.ps,s.oc,s.os,orderId)
}

function syncCloseoutAutomation(orderId){
  const db=getDb()
  const state=db.prepare(`SELECT
    EXISTS(SELECT 1 FROM approvals WHERE order_id=? AND status='APPROVED') customer_approved,
    EXISTS(SELECT 1 FROM diagnostics WHERE order_id=? AND (TRIM(COALESCE(conclusion,''))!='' OR TRIM(COALESCE(recommendation,''))!='')) diagnosis_documented,
    NOT EXISTS(SELECT 1 FROM job_part_orders WHERE order_id=? AND status NOT IN ('ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE')) parts_documented,
    EXISTS(SELECT 1 FROM work_logs WHERE order_id=? AND ended_at IS NOT NULL) work_logged,
    (SELECT COUNT(DISTINCT check_key) FROM order_qc WHERE order_id=? AND deleted_at IS NULL AND checked=1 AND check_key IN ('symptom','dtc','leaks','torque','road','warning','clean','recommend'))=8 qc_done,
    COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=?),0)+0.01 >= COALESCE((SELECT labor_hours*labor_rate+parts_sale+other_sale+diagnosis_fee-discount FROM orders WHERE id=?),0) payment_checked,
    EXISTS(SELECT 1 FROM order_notes WHERE order_id=? AND TRIM(COALESCE(release_notes,''))!='') release_notes_done`)
    .get(orderId,orderId,orderId,orderId,orderId,orderId,orderId,orderId)
  db.prepare(`INSERT INTO closeout_checks(order_id,customer_approved,diagnosis_documented,parts_documented,work_logged,qc_done,payment_checked,release_notes_done,updated_at)
    VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(order_id) DO UPDATE SET
      customer_approved=excluded.customer_approved,
      diagnosis_documented=excluded.diagnosis_documented,
      parts_documented=excluded.parts_documented,
      work_logged=excluded.work_logged,
      qc_done=excluded.qc_done,
      payment_checked=excluded.payment_checked,
      release_notes_done=excluded.release_notes_done,
      updated_at=CURRENT_TIMESTAMP`)
    .run(orderId,state.customer_approved?1:0,state.diagnosis_documented?1:0,state.parts_documented?1:0,state.work_logged?1:0,state.qc_done?1:0,state.payment_checked?1:0,state.release_notes_done?1:0)
  return db.prepare('SELECT * FROM closeout_checks WHERE order_id=?').get(orderId)
}

ipcMain.handle('dashboard:get',()=>{
  const db=getDb();
  const open=db.prepare("SELECT COUNT(*) c FROM orders WHERE archived_at IS NULL AND status != 'WYDANE'").get().c
  const today=db.prepare("SELECT COUNT(*) c FROM orders WHERE date(opened_at)=date('now','localtime')").get().c
  const month=db.prepare(`SELECT COALESCE(SUM(labor_hours*labor_rate + parts_sale + other_sale + diagnosis_fee - discount),0) revenue,COALESCE(SUM(parts_cost + other_cost),0) variableCost,COALESCE(SUM(labor_hours),0) laborHours FROM orders WHERE strftime('%Y-%m',opened_at)=strftime('%Y-%m','now','localtime')`).get()
  const actual=db.prepare(`SELECT COALESCE(SUM(CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes ELSE (julianday('now')-julianday(started_at))*1440 END),0) minutes FROM work_logs WHERE strftime('%Y-%m',started_at)=strftime('%Y-%m','now','localtime')`).get().minutes
  const status=db.prepare("SELECT status,COUNT(*) c FROM orders WHERE archived_at IS NULL AND status!='WYDANE' GROUP BY status").all()
  const recent=db.prepare(`${orderSelect} WHERE o.archived_at IS NULL AND o.status!='WYDANE' ORDER BY o.opened_at DESC LIMIT 8`).all()
  const sources=db.prepare(`SELECT source, COUNT(*) c FROM orders WHERE strftime('%Y-%m',opened_at)=strftime('%Y-%m','now','localtime') GROUP BY source ORDER BY c DESC`).all()
  const reminders=db.prepare(`SELECT r.*,v.plate,v.make,v.model FROM reminders r JOIN vehicles v ON v.id=r.vehicle_id WHERE done=0 ORDER BY COALESCE(due_date,'9999-12-31') LIMIT 8`).all()
  const next=db.prepare(`SELECT a.*,v.plate,v.make,v.model FROM appointments a LEFT JOIN vehicles v ON v.id=a.vehicle_id WHERE datetime(a.end_at)>=datetime('now') ORDER BY a.start_at LIMIT 5`).all()
  const active=db.prepare(`SELECT w.*,o.title,v.plate,v.make,v.model FROM work_logs w JOIN orders o ON o.id=w.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE w.ended_at IS NULL ORDER BY w.started_at DESC`).all()
  const notificationCount =
    db.prepare("SELECT COUNT(*) c FROM orders WHERE archived_at IS NULL AND status!='WYDANE' AND COALESCE(wait_state,'BRAK')!='BRAK'").get().c +
    db.prepare("SELECT COUNT(*) c FROM communications WHERE needs_reply=1 AND resolved=0").get().c +
    db.prepare("SELECT COUNT(*) c FROM job_part_orders WHERE expected_at IS NOT NULL AND datetime(expected_at)<datetime('now') AND status NOT IN ('ODEBRANE','ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE')").get().c +
    db.prepare("SELECT COUNT(*) c FROM vehicle_findings f JOIN vehicles v ON v.id=f.vehicle_id WHERE f.deleted_at IS NULL AND f.status!='RESOLVED' AND (f.severity IN ('CRITICAL','HIGH') OR (f.due_date IS NOT NULL AND date(f.due_date)<=date('now','+14 days')) OR (f.due_mileage IS NOT NULL AND v.mileage>=f.due_mileage))").get().c
  return {open,today,month:{...month,actualHours:Number(actual)/60},status,recent,sources,reminders,next,active,notificationCount}
})


ipcMain.handle('finance:analytics',()=>{
  const db=getDb()
  const current=db.prepare(`SELECT COUNT(*) orders,COALESCE(SUM(labor_hours*labor_rate + parts_sale + other_sale + diagnosis_fee - discount),0) revenue,COALESCE(AVG(labor_hours*labor_rate + parts_sale + other_sale + diagnosis_fee - discount),0) avg_ticket,COALESCE(SUM(parts_sale),0) parts_sale,COALESCE(SUM(parts_cost),0) parts_cost,COALESCE(SUM(labor_hours*labor_rate),0) legacy_labor FROM orders WHERE strftime('%Y-%m',opened_at)=strftime('%Y-%m','now','localtime')`).get()
  const itemLabor=db.prepare(`SELECT COALESCE(SUM(i.qty*i.unit_price),0) v FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.kind='ROBOCIZNA' AND strftime('%Y-%m',o.opened_at)=strftime('%Y-%m','now','localtime')`).get().v
  const daily=db.prepare(`WITH RECURSIVE days(d) AS (SELECT date('now','localtime','-29 days') UNION ALL SELECT date(d,'+1 day') FROM days WHERE d<date('now','localtime')) SELECT d day,COALESCE(SUM(o.labor_hours*o.labor_rate+o.parts_sale+o.other_sale+o.diagnosis_fee-o.discount),0) revenue,COUNT(o.id) orders FROM days LEFT JOIN orders o ON date(o.opened_at,'localtime')=d GROUP BY d ORDER BY d`).all()
  const mix=db.prepare(`SELECT CASE WHEN diagnosis_fee>0 AND parts_sale=0 AND other_sale=0 AND labor_hours=0 THEN 'Diagnostyka' WHEN parts_sale>0 AND (other_sale>0 OR labor_hours>0) THEN 'Naprawa + części' WHEN parts_sale>0 THEN 'Części' ELSE 'Robocizna / usługa' END category,COUNT(*) count,COALESCE(SUM(labor_hours*labor_rate+parts_sale+other_sale+diagnosis_fee-discount),0) revenue FROM orders WHERE strftime('%Y-%m',opened_at)=strftime('%Y-%m','now','localtime') GROUP BY category ORDER BY revenue DESC`).all()
  const actualMinutes=db.prepare(`SELECT COALESCE(SUM(CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes ELSE (julianday('now')-julianday(started_at))*1440 END),0) m FROM work_logs WHERE strftime('%Y-%m',started_at)=strftime('%Y-%m','now','localtime')`).get().m
  return {current:{...current,labor_revenue:Number(current.legacy_labor||0)+Number(itemLabor||0),parts_margin:Number(current.parts_sale||0)-Number(current.parts_cost||0),actual_hours:Number(actualMinutes||0)/60},daily,mix}
})

ipcMain.handle('customers:list',(_,q='')=>getDb().prepare(`SELECT c.*, COUNT(DISTINCT v.id) vehicles, COUNT(DISTINCT o.id) orders FROM customers c LEFT JOIN vehicles v ON v.customer_id=c.id LEFT JOIN orders o ON o.vehicle_id=v.id WHERE c.name LIKE ? OR COALESCE(c.phone,'') LIKE ? OR COALESCE(c.company,'') LIKE ? GROUP BY c.id ORDER BY c.created_at DESC`).all(`%${q}%`,`%${q}%`,`%${q}%`))
ipcMain.handle('customers:create',(_,d)=>createCustomer(getDb(),d))
ipcMain.handle('customers:update',(_,{id,data})=>updateCustomer(getDb(),id,data))
ipcMain.handle('customers:deletePreview',(_,id)=>deletionPreview(getDb(),'customer',id))
ipcMain.handle('customers:remove',(_,id)=>removeEntity(getDb(),'customer',id,{unlink:file=>fs.unlinkSync(file)}))
ipcMain.handle('vehicles:list',(_,customerId)=>customerId?getDb().prepare('SELECT * FROM vehicles WHERE customer_id=? ORDER BY created_at DESC').all(customerId):getDb().prepare(`SELECT v.*,c.name customer FROM vehicles v JOIN customers c ON c.id=v.customer_id ORDER BY v.created_at DESC`).all())
ipcMain.handle('vehicles:create',(_,d)=>createVehicle(getDb(),d))
ipcMain.handle('vehicles:update',(_,{id,data})=>updateVehicle(getDb(),id,data))
ipcMain.handle('vehicles:deletePreview',(_,id)=>deletionPreview(getDb(),'vehicle',id))
ipcMain.handle('vehicles:remove',(_,id)=>removeEntity(getDb(),'vehicle',id,{unlink:file=>fs.unlinkSync(file)}))
ipcMain.handle('vehicles:history',(_,id)=>getDb().prepare(`${orderSelect} WHERE o.vehicle_id=? ORDER BY o.opened_at DESC`).all(id))

// --- 0.33 DEV: Vehicle Intelligence 2.0 -----------------------------------
ipcMain.handle('vehicles:profile',(_,id)=>{
  const db=getDb()
  const vehicle=db.prepare(`SELECT v.*,c.name customer,c.phone,c.email FROM vehicles v JOIN customers c ON c.id=v.customer_id WHERE v.id=?`).get(id)
  if(!vehicle)return null
  const orders=db.prepare(`${orderSelect} WHERE o.vehicle_id=? ORDER BY o.opened_at DESC`).all(id)
  const findings=db.prepare(`SELECT * FROM vehicle_findings WHERE vehicle_id=? AND deleted_at IS NULL ORDER BY CASE status WHEN 'OPEN' THEN 0 WHEN 'MONITOR' THEN 1 ELSE 2 END,CASE severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,created_at DESC`).all(id)
  const reminders=db.prepare(`SELECT * FROM service_reminders_v2 WHERE vehicle_id=? AND deleted_at IS NULL ORDER BY CASE status WHEN 'OPEN' THEN 0 ELSE 1 END,due_date,due_mileage`).all(id)
  const diagnostics=db.prepare(`SELECT d.*,o.opened_at,o.id order_id,o.title FROM diagnostics d JOIN orders o ON o.id=d.order_id WHERE o.vehicle_id=? AND d.deleted_at IS NULL ORDER BY o.opened_at DESC LIMIT 20`).all(id)
  const tech=db.prepare(`SELECT COUNT(*) total,SUM(CASE WHEN verified=1 THEN 1 ELSE 0 END) verified FROM technical_data_entries WHERE deleted_at IS NULL AND (vehicle_id=? OR (make=? AND engine_code!='' AND engine_code=?))`).get(id,vehicle.make||'',vehicle.engine_code||'')
  const totals=orders.reduce((a,o)=>{a.revenue+=Number(o.total||0);a.contribution+=Number(o.contribution||0);return a},{revenue:0,contribution:0})
  return {vehicle,orders,findings,reminders,diagnostics,tech:{total:Number(tech?.total||0),verified:Number(tech?.verified||0)},totals}
})
ipcMain.handle('vehicleFindings:list',(_,vehicleId)=>getDb().prepare(`SELECT * FROM vehicle_findings WHERE vehicle_id=? AND deleted_at IS NULL ORDER BY CASE status WHEN 'OPEN' THEN 0 WHEN 'MONITOR' THEN 1 ELSE 2 END,created_at DESC`).all(vehicleId))
ipcMain.handle('vehicleFindings:create',(_,{vehicleId,orderId,data})=>{const r=getDb().prepare(`INSERT INTO vehicle_findings(vehicle_id,source_order_id,category,title,details,severity,status,due_date,due_mileage) VALUES (?,?,?,?,?,?,?,?,?)`).run(vehicleId,orderId||null,data.category||'USTERKA',data.title,data.details||'',data.severity||'INFO',data.status||'OPEN',data.due_date||null,data.due_mileage||null);return{id:Number(r.lastInsertRowid)}})
ipcMain.handle('vehicleFindings:setStatus',(_,{id,status})=>{getDb().prepare(`UPDATE vehicle_findings SET status=?,resolved_at=CASE WHEN ?='RESOLVED' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?`).run(status,status,id);return true})

ipcMain.handle('orders:list',(_,status='')=>{const db=getDb();if(status==='ACTIVE')return db.prepare(`${orderSelect} WHERE o.archived_at IS NULL AND o.status!='WYDANE' ORDER BY o.opened_at DESC`).all();if(status==='ARCHIVE')return db.prepare(`${orderSelect} WHERE o.archived_at IS NOT NULL OR o.status='WYDANE' ORDER BY COALESCE(o.archived_at,o.closed_at,o.opened_at) DESC`).all();return status?db.prepare(`${orderSelect} WHERE o.status=? AND o.archived_at IS NULL ORDER BY o.opened_at DESC`).all(status):db.prepare(`${orderSelect} WHERE o.archived_at IS NULL AND o.status!='WYDANE' ORDER BY o.opened_at DESC`).all()})
ipcMain.handle('orders:get',(_,id)=>getDb().prepare(`${orderSelect} WHERE o.id=?`).get(id))
ipcMain.handle('orders:create',(_,d)=>{const r=getDb().prepare(`INSERT INTO orders(vehicle_id,title,complaint,status,priority,diagnosis_limit,labor_rate,diagnosis_fee,source,due_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(d.vehicle_id,d.title,d.complaint||'','PRZYJETE',d.priority||'NORMALNY',+d.diagnosis_limit||0,+d.labor_rate||220,+d.diagnosis_fee||0,d.source||'nieznane',d.due_at||null);return{id:r.lastInsertRowid}})
ipcMain.handle('orders:archive',(_event,id)=>{const db=getDb(),order=db.prepare('SELECT status FROM orders WHERE id=?').get(id);if(!order)return{ok:false,error:'Zlecenie nie istnieje.'};if(!['GOTOWE','WYDANE'].includes(order.status))return{ok:false,error:'Do archiwum można przenieść zlecenie gotowe lub wydane.'};db.prepare('UPDATE orders SET archived_at=CURRENT_TIMESTAMP WHERE id=?').run(id);return{ok:true}})
ipcMain.handle('orders:restore',(_event,id)=>{const result=getDb().prepare("UPDATE orders SET archived_at=NULL,status=CASE WHEN status='WYDANE' THEN 'GOTOWE' ELSE status END,closed_at=CASE WHEN status='WYDANE' THEN NULL ELSE closed_at END WHERE id=?").run(id);return{ok:result.changes>0}})
ipcMain.handle('orders:deletePreview',(_event,id)=>deletionPreview(getDb(),'order',id))
ipcMain.handle('orders:remove',(_event,id)=>removeEntity(getDb(),'order',id,{unlink:file=>fs.unlinkSync(file)}))
ipcMain.handle('intake:create',(_,d)=>{
  const db=getDb()
  const tx=db.transaction(()=>{
    const phone=String(d.customer_phone||'').trim(), vin=String(d.vin||'').trim().toUpperCase(), plate=String(d.plate||'').trim().toUpperCase()
    let customer=phone?db.prepare("SELECT * FROM customers WHERE REPLACE(REPLACE(phone,' ',''),'-','')=? ORDER BY id DESC LIMIT 1").get(phone.replace(/[ -]/g,'')):null
    if(!customer){
      const cr=db.prepare('INSERT INTO customers(name,phone,email,company,notes) VALUES (?,?,?,?,?)').run(d.customer_name||'Klient',phone,d.customer_email||'',d.company||'',d.customer_notes||'')
      customer={id:cr.lastInsertRowid}
    }
    let vehicle=null
    if(vin) vehicle=db.prepare('SELECT * FROM vehicles WHERE UPPER(vin)=? LIMIT 1').get(vin)
    if(!vehicle && plate) vehicle=db.prepare('SELECT * FROM vehicles WHERE customer_id=? AND UPPER(plate)=? ORDER BY id DESC LIMIT 1').get(customer.id,plate)
    if(!vehicle){
      const vr=db.prepare('INSERT INTO vehicles(customer_id,plate,vin,make,model,generation,year,engine,power_hp,engine_code,mileage,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(customer.id,plate,vin,d.make||'',d.model||'',d.generation||'',d.year||null,d.engine||'',+d.power_hp||null,d.engine_code||'',+d.mileage||0,d.vehicle_notes||'')
      vehicle={id:vr.lastInsertRowid}
    } else {
      db.prepare(`UPDATE vehicles SET plate=COALESCE(NULLIF(?,''),plate),vin=COALESCE(NULLIF(?,''),vin),make=COALESCE(NULLIF(?,''),make),model=COALESCE(NULLIF(?,''),model),generation=COALESCE(NULLIF(?,''),generation),year=COALESCE(?,year),engine=COALESCE(NULLIF(?,''),engine),power_hp=COALESCE(?,power_hp),engine_code=COALESCE(NULLIF(?,''),engine_code),mileage=CASE WHEN ?>0 THEN ? ELSE mileage END WHERE id=?`)
        .run(plate,vin,d.make||'',d.model||'',d.generation||'',d.year||null,d.engine||'',+d.power_hp||null,d.engine_code||'',+d.mileage||0,+d.mileage||0,vehicle.id)
    }
    const or=db.prepare(`INSERT INTO orders(vehicle_id,title,complaint,status,priority,diagnosis_limit,labor_rate,diagnosis_fee,source,due_at,wait_state) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(vehicle.id,d.title||'Nowe zlecenie',d.complaint||'','PRZYJETE',d.priority||'NORMALNY',+d.diagnosis_limit||0,+d.labor_rate||220,+d.diagnosis_fee||0,d.source||'nieznane',d.due_at||null,'BRAK')
    db.prepare(`INSERT INTO order_notes(order_id,intake_notes,release_notes,qc_notes) VALUES (?,?,?,?)`).run(or.lastInsertRowid,d.intake_notes||'','','')
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(or.lastInsertRowid,'INTAKE','Przyjęcie pojazdu',d.complaint||'')
    return {order_id:or.lastInsertRowid,vehicle_id:vehicle.id,customer_id:customer.id}
  })
  return tx()
})

ipcMain.handle('orders:updateStatus',(_,{id,status})=>{
  const db=getDb(); const prev=db.prepare('SELECT status FROM orders WHERE id=?').get(id)
  db.prepare("UPDATE orders SET status=?,closed_at=CASE WHEN ?='WYDANE' THEN CURRENT_TIMESTAMP ELSE closed_at END WHERE id=?").run(status,status,id)
  if(!prev || prev.status!==status) db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(id,'STATUS','Zmiana statusu',`${prev?.status||'—'} → ${status}`)
  return true
})
ipcMain.handle('orders:updateWait',(_,{id,waitState})=>{
  const db=getDb(); const v=waitState||'BRAK'; const prev=db.prepare('SELECT wait_state FROM orders WHERE id=?').get(id)
  db.prepare("UPDATE orders SET wait_state=? WHERE id=?").run(v,id)
  if(!prev || prev.wait_state!==v) db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(id,'WAIT','Zmiana oczekiwania',`${prev?.wait_state||'BRAK'} → ${v}`)
  return true
})

ipcMain.handle('orders:updateFinancials',(_,{id,data})=>{getDb().prepare(`UPDATE orders SET labor_hours=?,labor_rate=?,parts_cost=?,parts_sale=?,other_cost=?,other_sale=?,discount=?,diagnosis_fee=? WHERE id=?`).run(+data.labor_hours||0,+data.labor_rate||0,+data.parts_cost||0,+data.parts_sale||0,+data.other_cost||0,+data.other_sale||0,+data.discount||0,+data.diagnosis_fee||0,id);return true})
ipcMain.handle('orders:notesGet',(_,id)=>getDb().prepare('SELECT * FROM order_notes WHERE order_id=?').get(id)||{order_id:id,intake_notes:'',release_notes:'',qc_notes:''})
ipcMain.handle('orders:notesSave',(_,{id,data})=>{getDb().prepare(`INSERT INTO order_notes(order_id,intake_notes,release_notes,qc_notes,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(order_id) DO UPDATE SET intake_notes=excluded.intake_notes,release_notes=excluded.release_notes,qc_notes=excluded.qc_notes,updated_at=CURRENT_TIMESTAMP`).run(id,data.intake_notes||'',data.release_notes||'',data.qc_notes||'');return true})

ipcMain.handle('items:list',(_,orderId)=>getDb().prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id DESC').all(orderId))
ipcMain.handle('items:create',(_,{orderId,data})=>{const r=getDb().prepare(`INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,supplier,notes,catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderId,data.kind||'CZESC',data.name,+data.qty||1,+data.unit_cost||0,+data.unit_price||0,data.part_no||'',data.supplier||'',data.notes||data.customer_description||'',data.catalog_work_id||null,data.catalog_variant_id||null,data.work_name||null,data.variant_name||null,data.customer_description||data.notes||'',data.technical_description||'',data.hours_snapshot??(+data.qty||1),data.price_snapshot??(+data.unit_price||0));syncOrderItemTotals(orderId);return{id:r.lastInsertRowid}})
ipcMain.handle('items:remove',(_,id)=>{const db=getDb();const row=db.prepare('SELECT order_id FROM order_items WHERE id=?').get(id);if(row){db.prepare('DELETE FROM order_items WHERE id=?').run(id);syncOrderItemTotals(row.order_id)}return true})
ipcMain.handle('items:updateDescription',(_,{id,description})=>{getDb().prepare('UPDATE order_items SET customer_description=?,notes=? WHERE id=?').run(String(description||''),String(description||''),id);return true})

ipcMain.handle('diagnostics:get',(_,orderId)=>getDb().prepare('SELECT * FROM diagnostics WHERE order_id=? ORDER BY id DESC LIMIT 1').get(orderId)||null)
ipcMain.handle('diagnostics:save',(_,{orderId,data})=>{const db=getDb();const ex=db.prepare('SELECT id FROM diagnostics WHERE order_id=?').get(orderId);if(ex)db.prepare(`UPDATE diagnostics SET symptom_confirmed=?,dtcs=?,measurements=?,hypothesis=?,conclusion=?,recommendation=?,time_hours=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(data.symptom_confirmed||'',data.dtcs||'',data.measurements||'',data.hypothesis||'',data.conclusion||'',data.recommendation||'',+data.time_hours||0,ex.id);else db.prepare(`INSERT INTO diagnostics(order_id,symptom_confirmed,dtcs,measurements,hypothesis,conclusion,recommendation,time_hours) VALUES (?,?,?,?,?,?,?,?)`).run(orderId,data.symptom_confirmed||'',data.dtcs||'',data.measurements||'',data.hypothesis||'',data.conclusion||'',data.recommendation||'',+data.time_hours||0);return true})

ipcMain.handle('appointments:list',(_,{from,to})=>listAppointments(getDb(),from,to))
ipcMain.handle('appointments:create',(_,d)=>createAppointment(getDb(),d))
ipcMain.handle('appointments:update',(_,{id,data})=>updateAppointment(getDb(),id,data))
ipcMain.handle('appointments:remove',(_,id)=>removeAppointment(getDb(),id))

ipcMain.handle('knowledge:list',(_,q='')=>getDb().prepare(`SELECT * FROM knowledge_cases WHERE symptom LIKE ? OR COALESCE(dtcs,'') LIKE ? OR COALESCE(tags,'') LIKE ? OR COALESCE(vehicle,'') LIKE ? ORDER BY created_at DESC`).all(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`))
ipcMain.handle('knowledge:create',(_,d)=>{const r=getDb().prepare('INSERT INTO knowledge_cases(vehicle,engine,symptom,dtcs,measurements,cause,solution,tags,source_order_id) VALUES (?,?,?,?,?,?,?,?,?)').run(d.vehicle||'',d.engine||'',d.symptom,d.dtcs||'',d.measurements||'',d.cause||'',d.solution||'',d.tags||'',d.source_order_id||null);return{id:r.lastInsertRowid}})
ipcMain.handle('knowledge:fromOrder',(_,orderId)=>{const db=getDb();const o=db.prepare(`${orderSelect} WHERE o.id=?`).get(orderId);const d=db.prepare('SELECT * FROM diagnostics WHERE order_id=? ORDER BY id DESC LIMIT 1').get(orderId);if(!o||!d)return{ok:false,error:'Brak zlecenia lub diagnostyki'};const r=db.prepare('INSERT INTO knowledge_cases(vehicle,engine,symptom,dtcs,measurements,cause,solution,tags,source_order_id) VALUES (?,?,?,?,?,?,?,?,?)').run(`${o.make} ${o.model}`,o.engine||'',o.complaint||o.title,d.dtcs||'',d.measurements||'',d.conclusion||'',d.recommendation||'',o.make||'',orderId);return{ok:true,id:r.lastInsertRowid}})

ipcMain.handle('reminders:list',()=>getDb().prepare(`SELECT r.*,v.plate,v.make,v.model,c.name customer FROM reminders r JOIN vehicles v ON v.id=r.vehicle_id JOIN customers c ON c.id=v.customer_id WHERE done=0 ORDER BY COALESCE(due_date,'9999-12-31')`).all())
ipcMain.handle('reminders:create',(_,d)=>{const r=getDb().prepare('INSERT INTO reminders(vehicle_id,title,due_date,due_mileage) VALUES (?,?,?,?)').run(d.vehicle_id,d.title,d.due_date||null,d.due_mileage||null);return{id:r.lastInsertRowid}})
ipcMain.handle('reminders:done',(_,id)=>{getDb().prepare('UPDATE reminders SET done=1 WHERE id=?').run(id);return true})

ipcMain.handle('worklog:list',(_,orderId)=>getDb().prepare('SELECT * FROM work_logs WHERE order_id=? ORDER BY started_at DESC').all(orderId))
ipcMain.handle('worklog:active',()=>getDb().prepare(`SELECT w.*,o.title,v.plate,v.make,v.model FROM work_logs w JOIN orders o ON o.id=w.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE w.ended_at IS NULL ORDER BY w.started_at DESC`).all())
ipcMain.handle('worklog:start',(_,{orderId,note})=>{const db=getDb();const active=db.prepare("SELECT id FROM work_logs WHERE worker='Właściciel' AND ended_at IS NULL").get();if(active)return{ok:false,error:'Najpierw zatrzymaj aktywny licznik czasu.'};const r=db.prepare('INSERT INTO work_logs(order_id,worker,note) VALUES (?,?,?)').run(orderId,'Właściciel',note||'');return{ok:true,id:r.lastInsertRowid}})
ipcMain.handle('worklog:stop',(_,id)=>{const db=getDb();const w=db.prepare('SELECT * FROM work_logs WHERE id=?').get(id);if(!w||w.ended_at)return false;const mins=Math.max(1,Math.round((Date.now()-new Date(w.started_at).getTime())/60000));db.prepare('UPDATE work_logs SET ended_at=CURRENT_TIMESTAMP,duration_minutes=? WHERE id=?').run(mins,id);return true})

ipcMain.handle('quotes:get',(_,orderId)=>{
  const db=getDb();let q=db.prepare("SELECT * FROM quotes WHERE order_id=? AND status='ROBOCZA' ORDER BY id DESC LIMIT 1").get(orderId)
  if(!q)q=db.prepare("SELECT * FROM quotes WHERE order_id=? ORDER BY id DESC LIMIT 1").get(orderId)
  if(!q){const r=db.prepare("INSERT INTO quotes(order_id,status) VALUES (?,'ROBOCZA')").run(orderId);q=db.prepare('SELECT * FROM quotes WHERE id=?').get(r.lastInsertRowid)}
  const items=db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY id').all(q.id)
  const total=items.reduce((s,x)=>s+(x.kind==='ROBOCIZNA'?Number(x.labor_hours)*Number(x.labor_rate):Number(x.qty)*Number(x.unit_price)),0)
  const cost=items.reduce((s,x)=>s+(x.kind==='ROBOCIZNA'?0:Number(x.qty)*Number(x.unit_cost)),0)
  const approval=findQuoteApproval(db,orderId,q.id)
  return{...q,items,total,cost,margin:total-cost,approval:approval||null}
})
ipcMain.handle('quotes:addItem',(_,{orderId,data})=>{const db=getDb();let q=db.prepare("SELECT * FROM quotes WHERE order_id=? AND status='ROBOCZA' ORDER BY id DESC LIMIT 1").get(orderId);if(!q){const r=db.prepare("INSERT INTO quotes(order_id,status) VALUES (?,'ROBOCZA')").run(orderId);q=db.prepare('SELECT * FROM quotes WHERE id=?').get(r.lastInsertRowid)}assertQuoteEditable(db,q);let price=+data.unit_price||0;if((data.kind||'CZESC')==='CZESC'&&!price)price=Math.round((+data.unit_cost||0)*(1+partMarkup(+data.unit_cost||0))*100)/100;const hours=+data.labor_hours||0,total=(data.kind||'CZESC')==='ROBOCIZNA'?hours*(+data.labor_rate||0):(+data.qty||1)*price;const r=db.prepare(`INSERT INTO quote_items(quote_id,kind,name,qty,unit_cost,unit_price,labor_hours,labor_rate,notes,catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(q.id,data.kind||'CZESC',data.name,+data.qty||1,+data.unit_cost||0,price,hours,+data.labor_rate||0,data.notes||data.customer_description||'',data.catalog_work_id||null,data.catalog_variant_id||null,data.work_name||null,data.variant_name||null,data.customer_description||data.notes||'',data.technical_description||'',hours,total);return{id:r.lastInsertRowid,recommendedPrice:price}})
ipcMain.handle('quotes:removeItem',(_,id)=>{const db=getDb(),item=db.prepare('SELECT * FROM quote_items WHERE id=?').get(id);if(!item)return true;assertQuoteEditable(db,db.prepare('SELECT * FROM quotes WHERE id=?').get(item.quote_id));db.prepare('DELETE FROM quote_items WHERE id=?').run(id);return true})
ipcMain.handle('quotes:requestApproval',(_,id)=>{
  const db=getDb(); const q=db.prepare('SELECT * FROM quotes WHERE id=?').get(id); if(!q)return{ok:false}
  const existing=findQuoteApproval(db,q.order_id,id);if(existing)return{ok:true,approvalId:existing.id,total:Number(existing.amount||0),already:true}
  assertQuoteEditable(db,q)
  const items=db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY id').all(id)
  if(!items.length)return{ok:false,reason:'EMPTY_QUOTE'}
  const total=items.reduce((s,x)=>s+(x.kind==='ROBOCIZNA'?Number(x.labor_hours)*Number(x.labor_rate):Number(x.qty)*Number(x.unit_price)),0)
  const summary=items.slice(0,5).map(x=>x.name).join(', ')+(items.length>5?` +${items.length-5}`:'')
  const scope=`Wycena #${id} · ${summary||'zakres naprawy'}`
  const r=db.prepare(`INSERT INTO approvals(order_id,status,amount,scope,channel,note) VALUES (?,'PENDING',?,?,?,?)`).run(q.order_id,total,scope,'SMS',`Kosztorys ${items.length} pozycji`)
  db.prepare(`UPDATE orders SET status='AKCEPTACJA',wait_state='DECYZJA' WHERE id=?`).run(q.order_id)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(q.order_id,'APPROVAL','Wycena wysłana do akceptacji',`${total.toFixed(2)} zł · ${scope}`)
  return{ok:true,approvalId:r.lastInsertRowid,total}
})
ipcMain.handle('quotes:accept',(_,id)=>{const db=getDb();const q=db.prepare('SELECT * FROM quotes WHERE id=?').get(id);if(!q)return{ok:false};if(q.status==='ZAAKCEPTOWANA')return{ok:true,already:true};const approval=findQuoteApproval(db,q.order_id,id);if(!approval||approval.status!=='APPROVED')return{ok:false,reason:'APPROVAL_REQUIRED'};const items=db.prepare('SELECT * FROM quote_items WHERE quote_id=?').all(id);let parts=0;const tx=db.transaction(()=>{for(const x of items){if(x.kind==='ROBOCIZNA'){db.prepare(`INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,notes,catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot) VALUES (?,'ROBOCIZNA',?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(q.order_id,x.name,x.labor_hours||1,0,x.labor_rate||220,x.customer_description||x.notes||'',x.catalog_work_id||null,x.catalog_variant_id||null,x.work_name||x.name,x.variant_name||'',x.customer_description||x.notes||'',x.technical_description||'',x.hours_snapshot??x.labor_hours??1,x.price_snapshot??((x.labor_hours||1)*(x.labor_rate||220)))}else if(x.kind==='CZESC'){db.prepare(`INSERT INTO job_part_orders(order_id,part_no,name,qty,unit_cost,unit_price,status,notes) VALUES (?,?,?,?,?,?,'DO_ZAMOWIENIA',?)`).run(q.order_id,'',x.name,x.qty,x.unit_cost,x.unit_price,`Z zaakceptowanego kosztorysu #${id}`);parts++}else{db.prepare('INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,notes) VALUES (?,?,?,?,?,?,?)').run(q.order_id,x.kind,x.name,x.qty,x.unit_cost,x.unit_price,x.notes||'')}}db.prepare("UPDATE quotes SET status='ZAAKCEPTOWANA',accepted_at=CURRENT_TIMESTAMP WHERE id=?").run(id);syncOrderItemTotals(q.order_id);db.prepare('UPDATE orders SET status=?,wait_state=? WHERE id=?').run(parts?'AKCEPTACJA':'NAPRAWA',parts?'CZESCI':'BRAK',q.order_id);db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(q.order_id,'QUOTE_PREPARED',parts?'Zakres zaakceptowany — części do zamówienia':'Zakres zaakceptowany — gotowe do naprawy',parts?`${parts} pozycji części utworzono jako DO_ZAMOWIENIA`:'Brak części blokujących rozpoczęcie naprawy')});tx();return{ok:true,partsPrepared:parts}})

ipcMain.handle('attachments:list',(_,orderId)=>getDb().prepare("SELECT id,order_id,name,file_path,mime,storage_path,size_bytes,sha256,category,cloud_id,updated_at,created_at FROM attachments WHERE order_id=? AND deleted_at IS NULL ORDER BY created_at DESC").all(orderId))
ipcMain.handle('attachments:pick',async(_,{orderId,category='PRZYJECIE'}={})=>{const r=await dialog.showOpenDialog({properties:['openFile','multiSelections'],filters:[{name:'Zdjęcia i PDF',extensions:['jpg','jpeg','png','webp','heic','pdf']}]});if(r.canceled)return[];const db=getDb();const dir=path.join(app.getPath('userData'),'attachments',String(orderId));fs.mkdirSync(dir,{recursive:true});const out=[];for(const src of r.filePaths){const ext=path.extname(src).toLowerCase();const name=path.basename(src);const dst=path.join(dir,`${Date.now()}-${crypto.randomBytes(3).toString('hex')}${ext}`);fs.copyFileSync(src,dst);const buf=fs.readFileSync(dst);const mime=ext==='.pdf'?'application/pdf':`image/${ext.replace('.','').replace('jpg','jpeg')}`;const rr=db.prepare('INSERT INTO attachments(order_id,name,file_path,mime,size_bytes,sha256,category) VALUES (?,?,?,?,?,?,?)').run(orderId,name,dst,mime,buf.length,crypto.createHash('sha256').update(buf).digest('hex'),category);out.push({id:rr.lastInsertRowid,name,file_path:dst,category})}return out})
ipcMain.handle('attachments:remove',(_,id)=>{const db=getDb();const a=db.prepare('SELECT * FROM attachments WHERE id=?').get(id);if(a){try{if(a.file_path)fs.unlinkSync(a.file_path)}catch{}db.prepare("UPDATE attachments SET file_path='',deleted_at=CURRENT_TIMESTAMP WHERE id=?").run(id)}return true})
ipcMain.handle('attachments:open',(_,id)=>{const a=getDb().prepare('SELECT * FROM attachments WHERE id=?').get(id);if(a)shell.openPath(a.file_path);return true})

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function signatureSvg(sig){
  if(!sig?.points_json)return ''
  try{
    const pts=JSON.parse(sig.points_json)
    if(!Array.isArray(pts)||pts.length<2)return ''
    const poly=pts.map(p=>`${Number(p[0]||0).toFixed(1)},${Number(p[1]||0).toFixed(1)}`).join(' ')
    return `<div class="sigbox"><div class="muted">Podpis klienta — ${esc(sig.signed_by||'Klient')}</div><svg viewBox="0 0 620 170" preserveAspectRatio="xMidYMid meet"><polyline points="${poly}" fill="none" stroke="#182028" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="muted">${esc(sig.created_at||'')}</div></div>`
  }catch{return ''}
}
function documentHtml(o,items,diag,notes,type,signature,qcRows=[]){
  const works=items.filter(x=>x.kind==='ROBOCIZNA')
  const saleItems=items.filter(x=>x.kind!=='ROBOCIZNA')
  const rows=saleItems.map(x=>`<tr><td><b>${esc(x.name)}</b>${x.part_no?`<small>${esc(x.part_no)}</small>`:''}</td><td>${esc(x.kind)}</td><td class="num">${Number(x.qty||0).toFixed(1)}</td><td class="num">${Number(x.unit_price||0).toFixed(2)} zł</td><td class="num"><b>${(x.qty*x.unit_price).toFixed(2)} zł</b></td></tr>`).join('')
  const workRows=works.map((x,i)=>`<section class="work"><div class="workNo">${String(i+1).padStart(2,'0')}</div><div><h3>${esc(x.work_name||x.name)}</h3>${x.variant_name?`<small>${esc(x.variant_name)}</small>`:''}<p>${esc(x.customer_description||x.notes||'Zakres wykonanej pracy nie został opisany.')}</p><div class="workMeta">Czas rozliczeniowy: ${Number(x.hours_snapshot??x.qty??0).toFixed(1)} h <span>•</span> Wartość: ${Number(x.price_snapshot??(x.qty*x.unit_price)).toFixed(2)} zł</div></div></section>`).join('')
  const title=type==='intake'?'KARTA PRZYJĘCIA POJAZDU':type==='release'?'PROTOKÓŁ WYKONANIA I WYDANIA':'ZLECENIE SERWISOWE'
  const docCode=`AL/${new Date().getFullYear()}/${String(o.id).padStart(5,'0')}`
  const qcDone=qcRows.filter(x=>x.checked).length, qcHtml=qcRows.length?`<div class="qcDoc">${qcRows.map(x=>`<div class="${x.checked?'ok':'no'}"><b>${x.checked?'✓':'○'}</b><span>${esc(x.label)}</span></div>`).join('')}</div>`:''
  const special=type==='intake'?`<div class="sectionTitle">ZGŁOSZENIE KLIENTA</div><div class="note">${esc(o.complaint||'Brak opisu zgłoszenia.')}</div><div class="sectionTitle">STAN / UWAGI PRZY PRZYJĘCIU</div><div class="note">${esc(notes?.intake_notes||'Brak dodatkowych uwag.')}</div><div class="infoLine"><b>Uzgodniony limit diagnostyki</b><strong>${Number(o.diagnosis_limit||0).toFixed(2)} zł</strong></div>${signatureSvg(signature)||'<div class="signRow"><div>Podpis / potwierdzenie klienta</div><div>Przyjął pojazd</div></div>'}`:type==='release'?`<div class="sectionTitle">WYNIK DIAGNOSTYKI / PRZYCZYNA</div><div class="note">${esc(diag?.conclusion||'Nie zapisano osobnego wniosku diagnostycznego.')}</div>${works.length?`<div class="sectionTitle">WYKONANE PRACE</div>${workRows}`:''}<div class="sectionTitle">KONTROLA JAKOŚCI · ${qcDone}/${qcRows.length||0}</div>${qcHtml}<div class="note">${esc(notes?.qc_notes||'Brak dodatkowych uwag kontroli jakości.')}</div><div class="sectionTitle">ZALECENIA DLA KLIENTA</div><div class="note recommendation">${esc(notes?.release_notes||diag?.recommendation||'Brak dodatkowych zaleceń.')}</div>${signatureSvg(signature)||'<div class="signRow"><div>Odbiór pojazdu / klient</div><div>Wydał pojazd</div></div>'}`:''
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:13mm 14mm 15mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#172026;font-size:10.5px;line-height:1.45;margin:0}.header{display:grid;grid-template-columns:1fr auto;gap:20px;align-items:end;padding:0 0 13px;border-bottom:4px solid #c99a22}.brand{font-size:28px;font-weight:900;letter-spacing:1.8px}.brand i{color:#c99a22;font-style:normal}.claim{color:#68747b;font-size:9px;letter-spacing:.5px;margin-top:2px}.doc{text-align:right}.doc b{display:block;font-size:13px}.doc span{color:#68747b}.vehicle{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:8px;margin:13px 0}.cell{background:#f3f5f5;border:1px solid #e1e5e5;border-radius:5px;padding:8px 10px}.cell small,.sectionTitle{display:block;color:#758087;font-size:7.8px;font-weight:700;letter-spacing:1.1px}.cell b{font-size:12px}.sectionTitle{margin:15px 0 6px;color:#916b0d;border-bottom:1px solid #ded4bb;padding-bottom:4px}.note{white-space:pre-wrap;border-left:3px solid #c99a22;background:#f7f7f5;padding:9px 11px;min-height:35px}.recommendation{background:#fff8e8}.work{display:grid;grid-template-columns:31px 1fr;gap:10px;padding:9px 0;border-bottom:1px solid #e5e7e7;break-inside:avoid}.workNo{width:27px;height:27px;border-radius:50%;background:#172026;color:white;text-align:center;line-height:27px;font-size:9px;font-weight:bold}.work h3{margin:0 0 3px;font-size:11.5px}.work p{margin:0;color:#3d484e;white-space:pre-wrap}.workMeta{margin-top:5px;color:#7a858a;font-size:8.5px}.workMeta span{color:#c99a22;margin:0 5px}table{width:100%;border-collapse:collapse;margin-top:3px}th{background:#172026;color:#fff;font-size:8px;letter-spacing:.5px;text-align:left;padding:6px}td{border-bottom:1px solid #e1e4e4;padding:6px}td small{display:block;color:#7c858a}.num{text-align:right}.summary{margin:13px 0 0 auto;width:48%;border-top:2px solid #172026}.summary div{display:flex;justify-content:space-between;padding:4px 2px}.summary .grand{font-size:16px;font-weight:900;border-top:1px solid #cfd4d4;margin-top:3px;padding-top:8px}.summary .grand b{color:#916b0d}.infoLine{display:flex;justify-content:space-between;margin-top:10px;padding:8px 10px;background:#f3f5f5}.signRow{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:38px}.signRow div{border-top:1px solid #879096;padding-top:5px;text-align:center;color:#68747b}.sigbox{margin-top:20px;border:1px solid #d8dddd;padding:8px}.sigbox svg{width:100%;height:95px;background:#fff}.muted{color:#758087}.qcDoc{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:5px 0 8px}.qcDoc div{display:flex;gap:7px;align-items:center;padding:6px 8px;border:1px solid #e1e5e5;border-radius:4px}.qcDoc .ok b{color:#27835d}.qcDoc .no{color:#8a5d18;background:#fff8e8}.footer{margin-top:15px;padding-top:7px;border-top:1px solid #e1e4e4;color:#81898d;font-size:7.8px;display:flex;justify-content:space-between}
  </style></head><body><header class="header"><div><div class="brand">AUTO<i>LOGIKA</i></div><div class="claim">DIAGNOSTYKA • MECHANIKA • ELEKTRONIKA • PROGRAMOWANIE</div></div><div class="doc"><b>${title}</b><span>${docCode} · ${new Date().toLocaleDateString('pl-PL')}</span></div></header><section class="vehicle"><div class="cell"><small>POJAZD</small><b>${esc(o.plate)} · ${esc(o.make)} ${esc(o.model)}</b><div>VIN: ${esc(o.vin||'—')}</div></div><div class="cell"><small>KLIENT</small><b>${esc(o.customer||'—')}</b><div>${esc(o.phone||'')}</div></div><div class="cell"><small>PRZEBIEG / ZLECENIE</small><b>${esc(o.mileage||'—')} km</b><div>#${o.id} · ${esc(o.title||'')}</div></div></section>${special}${saleItems.length?`<div class="sectionTitle">CZĘŚCI / MATERIAŁY / USŁUGI</div><table><thead><tr><th>POZYCJA</th><th>TYP</th><th class="num">ILOŚĆ</th><th class="num">CENA</th><th class="num">RAZEM</th></tr></thead><tbody>${rows}</tbody></table>`:''}<div class="summary"><div><span>Robocizna</span><b>${Number((works.reduce((a,x)=>a+x.qty*x.unit_price,0))||o.labor_hours*o.labor_rate||0).toFixed(2)} zł</b></div><div><span>Diagnostyka</span><b>${Number(o.diagnosis_fee||0).toFixed(2)} zł</b></div><div><span>Rabat</span><b>− ${Number(o.discount||0).toFixed(2)} zł</b></div><div class="grand"><span>RAZEM</span><b>${Number(o.total||0).toFixed(2)} zł</b></div></div><footer class="footer"><span>Autologika · dokument wygenerowany w Autologika OS</span><span>${docCode}</span></footer></body></html>`
}

ipcMain.handle('orders:exportPdf',async(_,{id,type='order'})=>{const db=getDb();const o=db.prepare(`${orderSelect} WHERE o.id=?`).get(id);if(!o)return{canceled:true};const items=db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(id);const diag=db.prepare('SELECT * FROM diagnostics WHERE order_id=? ORDER BY id DESC LIMIT 1').get(id);const notes=db.prepare('SELECT * FROM order_notes WHERE order_id=?').get(id);const signature=db.prepare('SELECT * FROM signatures WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(id);const qcRows=db.prepare('SELECT * FROM order_qc WHERE order_id=? AND deleted_at IS NULL ORDER BY id').all(id);const html=documentHtml(o,items,diag,notes,type,signature,qcRows);const w=new BrowserWindow({show:false,webPreferences:{sandbox:true}});await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));const suffix=type==='intake'?'Przyjecie':type==='release'?'Wydanie':'Zlecenie';const {filePath,canceled}=await dialog.showSaveDialog({defaultPath:`Autologika_${suffix}_${o.id}_${o.plate||'auto'}.pdf`,filters:[{name:'PDF',extensions:['pdf']}]});if(canceled||!filePath){w.destroy();return{canceled:true}}const pdf=await w.webContents.printToPDF({printBackground:true,pageSize:'A4'});fs.writeFileSync(filePath,pdf);w.destroy();return{canceled:false,filePath}})

ipcMain.handle('system:dbPath',()=>databasePath())
ipcMain.handle('system:backup',async()=>{const src=path.join(app.getPath('userData'),'autologika.db');const {filePath,canceled}=await dialog.showSaveDialog({defaultPath:`autologika-backup-${new Date().toISOString().slice(0,10)}.db`,filters:[{name:'SQLite database',extensions:['db']}]});if(canceled||!filePath)return{canceled:true};fs.copyFileSync(src,filePath);return{canceled:false,filePath}})
async function autoBackupDb(){const dir=path.join(app.getPath('userData'),'backups');fs.mkdirSync(dir,{recursive:true});const day=new Date().toISOString().slice(0,10);const dst=path.join(dir,`autologika-auto-${day}.db`);if(!fs.existsSync(dst)){await getDb().backup(dst);const files=fs.readdirSync(dir).filter(x=>/^autologika-auto-\d{4}-\d{2}-\d{2}\.db$/.test(x)).sort().reverse();for(const old of files.slice(14)){try{fs.unlinkSync(path.join(dir,old))}catch{}}}return {dir,file:dst,exists:fs.existsSync(dst)}}
ipcMain.handle('system:autoBackup',()=>autoBackupDb())
ipcMain.handle('system:autoBackupStatus',()=>{const dir=path.join(app.getPath('userData'),'backups');const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.startsWith('autologika-auto-')).sort().reverse():[];return {dir,count:files.length,last:files[0]||''}})

async function prepareUpdateInstall({currentVersion,targetVersion}){
  cloudSync.stopAuto()
  for(let i=0;i<50&&cloudSync.status().running;i++)await new Promise(resolve=>setTimeout(resolve,100))
  if(cloudSync.status().running)throw new Error('Synchronizacja danych nadal trwa. Spróbuj ponownie za chwilę.')
  if(mobileServer)await stopMobileServer()
  return createVersionBackup({currentVersion,targetVersion,kind:'BEFORE_UPDATE'})
}

// --- Autologika OS 0.4 ------------------------------------------------------
ipcMain.handle('vehicles:findByVin',(_,vin)=>getDb().prepare(`SELECT v.*,c.name customer,c.phone FROM vehicles v JOIN customers c ON c.id=v.customer_id WHERE UPPER(REPLACE(v.vin,' ',''))=? LIMIT 1`).get(String(vin||'').replace(/\s/g,'').toUpperCase())||null)

ipcMain.handle('employees:list',()=>getDb().prepare(`SELECT e.*,
  COALESCE(SUM(CASE WHEN strftime('%Y-%m',w.started_at)=strftime('%Y-%m','now','localtime') THEN COALESCE(w.duration_minutes,(julianday('now')-julianday(w.started_at))*1440) ELSE 0 END),0) minutes_month,
  COUNT(DISTINCT CASE WHEN strftime('%Y-%m',w.started_at)=strftime('%Y-%m','now','localtime') THEN w.order_id END) orders_month
  FROM employees e LEFT JOIN work_logs w ON w.employee_id=e.id GROUP BY e.id ORDER BY e.active DESC,e.name`).all())
ipcMain.handle('employees:create',(_,d)=>{const r=getDb().prepare('INSERT INTO employees(name,role,hourly_cost,active) VALUES (?,?,?,1)').run(d.name,d.role||'Mechanik',+d.hourly_cost||0);return{id:r.lastInsertRowid}})
ipcMain.handle('employees:update',(_,{id,data})=>{getDb().prepare('UPDATE employees SET name=?,role=?,hourly_cost=?,active=? WHERE id=?').run(data.name,data.role||'',+data.hourly_cost||0,data.active===false?0:1,id);return true})
ipcMain.handle('worklog:startAs',(_,{orderId,employeeId,note})=>{const db=getDb();const emp=db.prepare('SELECT * FROM employees WHERE id=? AND active=1').get(employeeId);if(!emp)return{ok:false,error:'Nie znaleziono aktywnego pracownika.'};const active=db.prepare('SELECT id FROM work_logs WHERE employee_id=? AND ended_at IS NULL').get(employeeId);if(active)return{ok:false,error:`${emp.name} ma już aktywny licznik czasu.`};const r=db.prepare('INSERT INTO work_logs(order_id,worker,note,employee_id) VALUES (?,?,?,?)').run(orderId,emp.name,note||'',employeeId);return{ok:true,id:r.lastInsertRowid}})
ipcMain.handle('worklog:productivity',()=>getDb().prepare(`SELECT e.id,e.name,e.role,e.hourly_cost,
 COALESCE(SUM(CASE WHEN strftime('%Y-%m',w.started_at)=strftime('%Y-%m','now','localtime') THEN COALESCE(w.duration_minutes,(julianday('now')-julianday(w.started_at))*1440) ELSE 0 END),0) minutes,
 COUNT(DISTINCT CASE WHEN strftime('%Y-%m',w.started_at)=strftime('%Y-%m','now','localtime') THEN w.order_id END) jobs,
 COALESCE(SUM(CASE WHEN strftime('%Y-%m',w.started_at)=strftime('%Y-%m','now','localtime') THEN COALESCE(w.duration_minutes,(julianday('now')-julianday(w.started_at))*1440)*e.hourly_cost/60 ELSE 0 END),0) labor_cost
 FROM employees e LEFT JOIN work_logs w ON w.employee_id=e.id WHERE e.active=1 GROUP BY e.id ORDER BY minutes DESC`).all())

ipcMain.handle('suppliers:list',()=>getDb().prepare('SELECT * FROM suppliers ORDER BY name').all())
ipcMain.handle('suppliers:create',(_,d)=>{const r=getDb().prepare('INSERT INTO suppliers(name,phone,email,account_no,notes) VALUES (?,?,?,?,?)').run(d.name,d.phone||'',d.email||'',d.account_no||'',d.notes||'');return{id:r.lastInsertRowid}})

ipcMain.handle('jobParts:list',(_,filter='OTWARTE')=>{const db=getDb();let where="";if(filter==='OTWARTE')where="WHERE j.status NOT IN ('ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE')";else if(filter!=='WSZYSTKIE')where="WHERE j.status=?";const sql=`SELECT j.*,s.name supplier,o.vehicle_id,v.plate,v.make,v.model,c.name customer FROM job_part_orders j JOIN orders o ON o.id=j.order_id JOIN vehicles v ON v.id=o.vehicle_id JOIN customers c ON c.id=v.customer_id LEFT JOIN suppliers s ON s.id=j.supplier_id ${where} ORDER BY CASE j.status WHEN 'DO_ZAMOWIENIA' THEN 0 WHEN 'ZAMOWIONE' THEN 1 WHEN 'W_DRODZE' THEN 2 WHEN 'ODEBRANE' THEN 3 WHEN 'DO_ZWROTU' THEN 4 ELSE 5 END,j.created_at DESC`;return filter!=='OTWARTE'&&filter!=='WSZYSTKIE'?db.prepare(sql).all(filter):db.prepare(sql).all()})
ipcMain.handle('jobParts:forOrder',(_,orderId)=>getDb().prepare(`SELECT j.*,s.name supplier FROM job_part_orders j LEFT JOIN suppliers s ON s.id=j.supplier_id WHERE j.order_id=? ORDER BY j.created_at DESC`).all(orderId))
ipcMain.handle('jobParts:create',(_,d)=>{const db=getDb();let price=+d.unit_price||0;if(!price)price=Math.round((+d.unit_cost||0)*(1+partMarkup(+d.unit_cost||0))*100)/100;const r=db.prepare(`INSERT INTO job_part_orders(order_id,supplier_id,part_no,name,qty,unit_cost,unit_price,status,external_order_no,expected_at,ordered_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,CASE WHEN ? IN ('ZAMOWIONE','W_DRODZE','ODEBRANE') THEN CURRENT_TIMESTAMP ELSE NULL END,?)`).run(d.order_id,d.supplier_id||null,d.part_no||'',d.name,+d.qty||1,+d.unit_cost||0,price,d.status||'DO_ZAMOWIENIA',d.external_order_no||'',d.expected_at||null,d.status||'DO_ZAMOWIENIA',d.notes||'');return{id:r.lastInsertRowid,unit_price:price}})
ipcMain.handle('jobParts:status',(_,{id,status})=>{const db=getDb();db.prepare(`UPDATE job_part_orders SET status=?,updated_at=CURRENT_TIMESTAMP,ordered_at=CASE WHEN ?='ZAMOWIONE' AND ordered_at IS NULL THEN CURRENT_TIMESTAMP ELSE ordered_at END,received_at=CASE WHEN ?='ODEBRANE' THEN CURRENT_TIMESTAMP ELSE received_at END,installed_at=CASE WHEN ?='ZAMONTOWANE' THEN CURRENT_TIMESTAMP ELSE installed_at END,returned_at=CASE WHEN ?='ZWROT_ZAKONCZONY' THEN CURRENT_TIMESTAMP ELSE returned_at END WHERE id=?`).run(status,status,status,status,status,id);if(status==='ZAMONTOWANE'){const x=db.prepare('SELECT * FROM job_part_orders WHERE id=?').get(id);const exists=db.prepare("SELECT id FROM order_items WHERE order_id=? AND kind='CZESC' AND name=? AND ABS(qty-?)<0.0001 AND ABS(unit_cost-?)<0.0001 ORDER BY id DESC LIMIT 1").get(x.order_id,x.name,x.qty,x.unit_cost);if(!exists){db.prepare("INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,supplier,notes) VALUES (?,'CZESC',?,?,?,?,?,?,?)").run(x.order_id,x.name,x.qty,x.unit_cost,x.unit_price,x.part_no||'',(db.prepare('SELECT name FROM suppliers WHERE id=?').get(x.supplier_id)||{}).name||'',`Zamówienie ${x.external_order_no||''}`);syncOrderItemTotals(x.order_id)}}return true})
ipcMain.handle('jobParts:batchStatus',(_,{ids,status,externalOrderNo='',expectedAt=null})=>{const db=getDb();const clean=(ids||[]).map(Number).filter(Boolean);if(!clean.length)return{ok:false,count:0};const tx=db.transaction(()=>{for(const id of clean){db.prepare(`UPDATE job_part_orders SET status=?,external_order_no=CASE WHEN ?!='' THEN ? ELSE external_order_no END,expected_at=COALESCE(?,expected_at),ordered_at=CASE WHEN ?='ZAMOWIONE' AND ordered_at IS NULL THEN CURRENT_TIMESTAMP ELSE ordered_at END,received_at=CASE WHEN ?='ODEBRANE' THEN CURRENT_TIMESTAMP ELSE received_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,externalOrderNo,externalOrderNo,expectedAt,status,status,id)}});tx();return{ok:true,count:clean.length}})

ipcMain.handle('inventory:list',(_,q='')=>getDb().prepare(`SELECT p.*,s.name supplier FROM inventory_parts p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.name LIKE ? OR COALESCE(p.part_no,'') LIKE ? ORDER BY CASE WHEN p.stock<=p.min_stock THEN 0 ELSE 1 END,p.name`).all(`%${q}%`,`%${q}%`))
ipcMain.handle('inventory:create',(_,d)=>{const price=(+d.sell_price||0)||Math.round((+d.unit_cost||0)*(1+partMarkup(+d.unit_cost||0))*100)/100;const r=getDb().prepare('INSERT INTO inventory_parts(part_no,name,stock,min_stock,unit_cost,sell_price,supplier_id,location,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(d.part_no||'',d.name,+d.stock||0,+d.min_stock||0,+d.unit_cost||0,price,d.supplier_id||null,d.location||'',d.notes||'');return{id:r.lastInsertRowid,sell_price:price}})
ipcMain.handle('inventory:adjust',(_,{id,delta})=>{getDb().prepare('UPDATE inventory_parts SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(+delta||0,id);return true})
ipcMain.handle('inventory:low',()=>getDb().prepare(`SELECT p.*,s.name supplier FROM inventory_parts p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.stock<=p.min_stock ORDER BY (p.min_stock-p.stock) DESC,p.name`).all())

ipcMain.handle('purchases:list',()=>getDb().prepare(`SELECT po.*,s.name supplier,COUNT(i.id) item_count,COALESCE(SUM(i.qty*i.unit_cost),0) total FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id LEFT JOIN purchase_order_items i ON i.purchase_order_id=po.id GROUP BY po.id ORDER BY po.created_at DESC`).all())
ipcMain.handle('purchases:create',(_,d)=>{const r=getDb().prepare('INSERT INTO purchase_orders(supplier_id,status,ordered_at,expected_at,notes) VALUES (?,?,?,?,?)').run(d.supplier_id||null,d.status||'ROBOCZE',d.ordered_at||null,d.expected_at||null,d.notes||'');return{id:r.lastInsertRowid}})
ipcMain.handle('purchases:get',(_,id)=>{const db=getDb();const order=db.prepare(`SELECT po.*,s.name supplier FROM purchase_orders po LEFT JOIN suppliers s ON s.id=po.supplier_id WHERE po.id=?`).get(id);const items=db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id=? ORDER BY id').all(id);return{order,items}})
ipcMain.handle('purchases:addItem',(_,{purchaseId,data})=>{const r=getDb().prepare('INSERT INTO purchase_order_items(purchase_order_id,inventory_part_id,part_no,name,qty,unit_cost) VALUES (?,?,?,?,?,?)').run(purchaseId,data.inventory_part_id||null,data.part_no||'',data.name,+data.qty||1,+data.unit_cost||0);return{id:r.lastInsertRowid}})
ipcMain.handle('purchases:setStatus',(_,{id,status})=>{const db=getDb();const tx=db.transaction(()=>{const po=db.prepare('SELECT * FROM purchase_orders WHERE id=?').get(id);if(!po)return;if(status==='ODEBRANE'&&po.status!=='ODEBRANE'){const items=db.prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id=?').all(id);for(const x of items){if(x.inventory_part_id)db.prepare('UPDATE inventory_parts SET stock=stock+?,unit_cost=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(x.qty,x.unit_cost,x.inventory_part_id);db.prepare('UPDATE purchase_order_items SET received_qty=qty WHERE id=?').run(x.id)}}db.prepare(`UPDATE purchase_orders SET status=?,ordered_at=CASE WHEN ?='ZAMOWIONE' AND ordered_at IS NULL THEN CURRENT_TIMESTAMP ELSE ordered_at END WHERE id=?`).run(status,status,id)});tx();return true})



ipcMain.handle('system:copyText',(_,text)=>{clipboard.writeText(String(text||''));return true})
ipcMain.handle('system:openPhone',(_,phone)=>{const p=String(phone||'').replace(/[^\d+]/g,''); if(!p)return false; shell.openExternal(`tel:${p}`); return true})
ipcMain.handle('system:openSms',(_,{phone,body})=>{
  const p=String(phone||'').replace(/[^\d+]/g,''); if(!p)return false
  const url=`sms:${p}?body=${encodeURIComponent(String(body||''))}`
  shell.openExternal(url); return true
})

ipcMain.handle('communications:list',(_,orderId)=>getDb().prepare(`SELECT * FROM communications WHERE order_id=? ORDER BY created_at DESC,id DESC`).all(orderId))
ipcMain.handle('communications:add',(_,{orderId,data})=>{
  const db=getDb()
  const r=db.prepare(`INSERT INTO communications(order_id,direction,channel,message,contact_name,needs_reply,resolved,reply_due_at) VALUES (?,?,?,?,?,?,0,?)`)
    .run(orderId,data.direction||'OUT',data.channel||'TELEFON',data.message||'',data.contact_name||'',data.needs_reply?1:0,data.needs_reply?(data.reply_due_at||null):null)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(orderId,'CONTACT',`${data.direction==='IN'?'Kontakt od klienta':'Kontakt z klientem'} · ${data.channel||'TELEFON'}`,data.message||'')
  return {id:r.lastInsertRowid}
})
ipcMain.handle('communications:resolve',(_,id)=>{
  const db=getDb(); const row=db.prepare('SELECT * FROM communications WHERE id=?').get(id)
  db.prepare('UPDATE communications SET resolved=1 WHERE id=?').run(id)
  if(row) db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(row.order_id,'CONTACT_RESOLVED','Odpowiedź klienta otrzymana',row.message||'')
  return true
})


ipcMain.handle('payments:list',(_,orderId)=>getDb().prepare(`SELECT * FROM payments WHERE order_id=? ORDER BY paid_at DESC,id DESC`).all(orderId))
ipcMain.handle('payments:add',(_,{orderId,data})=>{
  const db=getDb()
  const r=db.prepare(`INSERT INTO payments(order_id,amount,method,reference,note) VALUES (?,?,?,?,?)`)
    .run(orderId,+data.amount||0,data.method||'GOTOWKA',data.reference||'',data.note||'')
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(orderId,'PAYMENT','Płatność',`${Number(data.amount||0).toFixed(2)} zł · ${data.method||'GOTOWKA'}`)
  syncCloseoutAutomation(orderId)
  return {id:r.lastInsertRowid}
})
ipcMain.handle('payments:remove',(_,id)=>{
  const db=getDb(); const row=db.prepare(`SELECT * FROM payments WHERE id=?`).get(id)
  if(!row)return false
  db.prepare(`DELETE FROM payments WHERE id=?`).run(id)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(row.order_id,'PAYMENT','Usunięto płatność',`${Number(row.amount||0).toFixed(2)} zł`)
  syncCloseoutAutomation(row.order_id)
  return true
})

ipcMain.handle('closeout:get',(_,orderId)=>{
  return syncCloseoutAutomation(orderId)
})
ipcMain.handle('closeout:save',(_,{orderId,data})=>{
  const db=getDb()
  db.prepare(`INSERT INTO closeout_checks(order_id,customer_approved,diagnosis_documented,parts_documented,work_logged,qc_done,payment_checked,release_notes_done,updated_at)
    VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(order_id) DO UPDATE SET
      customer_approved=excluded.customer_approved,
      diagnosis_documented=excluded.diagnosis_documented,
      parts_documented=excluded.parts_documented,
      work_logged=excluded.work_logged,
      qc_done=excluded.qc_done,
      payment_checked=excluded.payment_checked,
      release_notes_done=excluded.release_notes_done,
      updated_at=CURRENT_TIMESTAMP`)
    .run(orderId,!!data.customer_approved?1:0,!!data.diagnosis_documented?1:0,!!data.parts_documented?1:0,!!data.work_logged?1:0,!!data.qc_done?1:0,!!data.payment_checked?1:0,!!data.release_notes_done?1:0)
  return true
})
ipcMain.handle('closeout:complete',(_,{orderId})=>{
  const db=getDb()
  const checks=syncCloseoutAutomation(orderId)
  const fields=['customer_approved','diagnosis_documented','parts_documented','work_logged','qc_done','payment_checked','release_notes_done']
  const missing=fields.filter(key=>!checks[key])
  if(missing.length)return{ok:false,error:'Nie wszystkie warunki wydania są spełnione.',missing}
  const tx=db.transaction(()=>{
    const changed=db.prepare(`UPDATE orders SET status='WYDANE',wait_state='BRAK',closed_at=COALESCE(closed_at,CURRENT_TIMESTAMP) WHERE id=? AND status!='WYDANE'`).run(orderId)
    if(!changed.changes)throw new Error('Zlecenie jest już zamknięte lub nie istnieje.')
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(orderId,'ORDER_RELEASED','Pojazd wydany','Zlecenie zamknięte po spełnieniu checklisty wydania')
  })
  try{tx();return{ok:true}}catch(error){return{ok:false,error:error.message}}
})

ipcMain.handle('salesRefs:list',(_,orderId)=>getDb().prepare(`SELECT * FROM sales_refs WHERE order_id=? ORDER BY issued_at DESC,id DESC`).all(orderId))
ipcMain.handle('salesRefs:add',(_,{orderId,data})=>{
  const db=getDb()
  const r=db.prepare(`INSERT INTO sales_refs(order_id,document_type,document_no,note) VALUES (?,?,?,?)`)
    .run(orderId,data.document_type||'PARAGON',data.document_no||'',data.note||'')
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(orderId,'SALES_DOC','Dokument sprzedaży',`${data.document_type||'PARAGON'} · ${data.document_no||'bez numeru'}`)
  return {id:r.lastInsertRowid}
})

ipcMain.handle('serviceReminders:listForVehicle',(_,vehicleId)=>getDb().prepare(`SELECT * FROM service_reminders_v2 WHERE vehicle_id=? ORDER BY status,due_date,due_mileage`).all(vehicleId))
ipcMain.handle('serviceReminders:add',(_,{vehicleId,orderId,data})=>{
  const db=getDb()
  const r=db.prepare(`INSERT INTO service_reminders_v2(vehicle_id,order_id,title,due_date,due_mileage,note,status) VALUES (?,?,?,?,?,?,'OPEN')`)
    .run(vehicleId,orderId||null,data.title||'Następna obsługa',data.due_date||null,+data.due_mileage||null,data.note||'')
  if(orderId) db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(orderId,'REMINDER','Utworzono przypomnienie serwisowe',`${data.title||'Następna obsługa'}${data.due_date?` · ${data.due_date}`:''}${data.due_mileage?` · ${data.due_mileage} km`:''}`)
  return {id:r.lastInsertRowid}
})
ipcMain.handle('serviceReminders:close',(_,id)=>{getDb().prepare(`UPDATE service_reminders_v2 SET status='DONE' WHERE id=?`).run(id);return true})

ipcMain.handle('debtors:list',()=>{
  const db=getDb()
  return db.prepare(`${orderSelect},
    COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id=o.id),0) paid,
    ROUND(o.total-COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id=o.id),0),2) balance
    FROM orders o
    JOIN vehicles v ON v.id=o.vehicle_id
    JOIN customers c ON c.id=v.customer_id
    WHERE ROUND(o.total-COALESCE((SELECT SUM(amount) FROM payments p WHERE p.order_id=o.id),0),2)>0.01
      AND o.status IN ('GOTOWE','WYDANE')
    ORDER BY balance DESC,o.opened_at`)
    .all()
})

ipcMain.handle('templates:list',()=>getDb().prepare(`SELECT * FROM message_templates WHERE active=1 ORDER BY id`).all())

ipcMain.handle('approvals:list',(_,orderId)=>getDb().prepare(`SELECT * FROM approvals WHERE order_id=? ORDER BY created_at DESC,id DESC`).all(orderId))
ipcMain.handle('approvals:add',(_,{orderId,data})=>{
  const db=getDb()
  const status=data.status||'PENDING'
  const r=db.prepare(`INSERT INTO approvals(order_id,status,amount,scope,channel,note,decided_at) VALUES (?,?,?,?,?,?,CASE WHEN ?='PENDING' THEN NULL ELSE CURRENT_TIMESTAMP END)`)
    .run(orderId,status,+data.amount||0,data.scope||'',data.channel||'TELEFON',data.note||'',status)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(orderId,'APPROVAL',status==='APPROVED'?'Klient zaakceptował koszt':status==='DECLINED'?'Klient odrzucił koszt':'Oczekiwanie na akceptację',`${Number(data.amount||0).toFixed(2)} zł · ${data.scope||''}`)
  syncCloseoutAutomation(orderId)
  return {id:r.lastInsertRowid}
})
ipcMain.handle('approvals:decide',(_,{id,status,note})=>{
  const db=getDb(); const row=db.prepare('SELECT * FROM approvals WHERE id=?').get(id)
  if(!row)return false
  db.prepare(`UPDATE approvals SET status=?,note=CASE WHEN ?!='' THEN ? ELSE note END,decided_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,note||'',note||'',id)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(row.order_id,'APPROVAL',status==='APPROVED'?'Klient zaakceptował koszt':'Klient odrzucił koszt',`${Number(row.amount||0).toFixed(2)} zł · ${row.scope||''}`)
  syncCloseoutAutomation(row.order_id)
  return true
})

ipcMain.handle('timeline:list',(_,orderId)=>{
  const db=getDb()
  const events=db.prepare(`SELECT id,event_type type,title,details,created_at FROM order_events WHERE order_id=?`).all(orderId)
  const parts=db.prepare(`SELECT id,'PART' type,'Część: '||name title,status||CASE WHEN external_order_no!='' THEN ' · zam. '||external_order_no ELSE '' END details,created_at FROM job_part_orders WHERE order_id=?`).all(orderId)
  const logs=db.prepare(`SELECT id,'WORK' type,'Praca: '||COALESCE(worker,'') title,CASE WHEN ended_at IS NULL THEN 'START' ELSE 'STOP · '||duration_minutes||' min' END details,started_at created_at FROM work_logs WHERE order_id=?`).all(orderId)
  const approvals=db.prepare(`SELECT id,'APPROVAL' type,CASE status WHEN 'APPROVED' THEN 'Akceptacja kosztów' WHEN 'DECLINED' THEN 'Odrzucenie kosztów' ELSE 'Wysłano do akceptacji' END title,printf('%.2f zł · %s',amount,scope) details,created_at FROM approvals WHERE order_id=?`).all(orderId)
  const payments=db.prepare(`SELECT id,'PAYMENT' type,'Płatność' title,printf('%.2f zł · %s',amount,method) details,paid_at created_at FROM payments WHERE order_id=?`).all(orderId)
  const docs=db.prepare(`SELECT id,'SALES_DOC' type,'Dokument sprzedaży' title,document_type||CASE WHEN document_no!='' THEN ' · '||document_no ELSE '' END details,issued_at created_at FROM sales_refs WHERE order_id=?`).all(orderId)
  return [...events,...parts,...logs,...approvals,...payments,...docs].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at)))
})

ipcMain.handle('notifications:list',()=>{
  const db=getDb()
  const waits=db.prepare(`${orderSelect} WHERE o.status!='WYDANE' AND COALESCE(o.wait_state,'BRAK')!='BRAK' ORDER BY o.opened_at`).all()
    .map(x=>({kind:'WAIT',order_id:x.id,plate:x.plate,title:x.title,text:x.wait_state,created_at:x.opened_at}))
  const replies=db.prepare(`SELECT m.*,v.plate,o.title FROM communications m JOIN orders o ON o.id=m.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE m.needs_reply=1 AND m.resolved=0 AND (m.reply_due_at IS NULL OR datetime(m.reply_due_at)<=datetime('now')) ORDER BY COALESCE(m.reply_due_at,m.created_at)`).all()
    .map(x=>({kind:'REPLY',order_id:x.order_id,plate:x.plate,title:x.title,text:x.message,created_at:x.reply_due_at||x.created_at,communication_id:x.id}))
  const late=db.prepare(`SELECT j.*,v.plate,o.title FROM job_part_orders j JOIN orders o ON o.id=j.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE j.expected_at IS NOT NULL AND datetime(j.expected_at)<datetime('now') AND j.status NOT IN ('ODEBRANE','ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE') ORDER BY j.expected_at`).all()
    .map(x=>({kind:'PART_LATE',order_id:x.order_id,plate:x.plate,title:x.title,text:x.name,created_at:x.expected_at}))
  const decisions=db.prepare(`SELECT a.*,v.plate,o.title,o.status order_status FROM approvals a JOIN orders o ON o.id=a.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE a.status IN ('APPROVED','DECLINED') AND o.status='AKCEPTACJA' ORDER BY COALESCE(a.decided_at,a.created_at) DESC`).all()
    .map(x=>({kind:'APPROVAL',order_id:x.order_id,plate:x.plate,title:x.title,text:x.status,amount:x.amount,note:x.note||'',created_at:x.decided_at||x.created_at}))
  const findings=db.prepare(`SELECT f.*,v.plate,v.make,v.model,(SELECT id FROM orders o WHERE o.vehicle_id=f.vehicle_id ORDER BY o.opened_at DESC LIMIT 1) order_id FROM vehicle_findings f JOIN vehicles v ON v.id=f.vehicle_id WHERE f.deleted_at IS NULL AND f.status!='RESOLVED' AND (f.severity IN ('CRITICAL','HIGH') OR (f.due_date IS NOT NULL AND date(f.due_date)<=date('now','+14 days')) OR (f.due_mileage IS NOT NULL AND v.mileage>=f.due_mileage)) ORDER BY CASE f.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 ELSE 2 END,f.created_at`).all()
    .map(x=>({kind:'VEHICLE_FINDING',order_id:x.order_id,plate:x.plate,title:`${x.make} ${x.model}`,text:x.title,note:x.details||'',severity:x.severity,created_at:x.created_at}))
  return [...waits,...replies,...late,...decisions,...findings].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))
})

function normTokens(s){return [...new Set(String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').split(/\s+/).filter(x=>x.length>2))]}
function caseScore(q,c){const toks=normTokens(q);if(!toks.length)return 0;const fields=[c.vehicle,c.engine,c.symptom,c.dtcs,c.measurements,c.cause,c.solution,c.tags].map(x=>String(x||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));let score=0;for(const t of toks){fields.forEach((f,i)=>{if(f.includes(t))score += [2,2,5,7,3,5,5,4][i]})}return score}
ipcMain.handle('assistant:search',(_,query)=>{const db=getDb();const cases=db.prepare('SELECT * FROM knowledge_cases ORDER BY created_at DESC LIMIT 500').all();const ranked=cases.map(c=>({...c,score:caseScore(query,c)})).filter(c=>c.score>0).sort((a,b)=>b.score-a.score).slice(0,8);const qTokens=normTokens(query);const hints=[];if(/brak mocy|turbo|doladow/.test(String(query).toLowerCase()))hints.push('Porównaj żądane i rzeczywiste doładowanie oraz sterowanie siłownikiem/N75.');if(/nie odpala|rozruch|kreci/.test(String(query).toLowerCase()))hints.push('Sprawdź napięcie podczas rozruchu, obroty RPM, synchronizację i ciśnienie paliwa.');if(/can|komunikac/.test(String(query).toLowerCase()))hints.push('Zacznij od zasilania/mas, rezystancji magistrali i topologii błędów komunikacji.');return{query,tokens:qTokens,results:ranked,hints,mode:'offline-local-retrieval'}})
ipcMain.handle('bays:productivity',()=>getDb().prepare(`SELECT a.bay,
 COUNT(*) appointments,
 ROUND(COALESCE(SUM((julianday(a.end_at)-julianday(a.start_at))*24),0),1) booked_hours,
 COUNT(DISTINCT a.order_id) linked_orders,
 ROUND(COALESCE(SUM(CASE WHEN a.order_id IS NOT NULL THEN (SELECT o.labor_hours*o.labor_rate+o.parts_sale+o.other_sale+o.diagnosis_fee-o.discount FROM orders o WHERE o.id=a.order_id) ELSE 0 END),0),2) linked_revenue
 FROM appointments a WHERE strftime('%Y-%m',a.start_at)=strftime('%Y-%m','now','localtime') GROUP BY a.bay ORDER BY booked_hours DESC`).all())

// --- 0.33 DEV: persistent QC / release readiness ---------------------------
ipcMain.handle('qc:list',(_,orderId)=>getDb().prepare(`SELECT * FROM order_qc WHERE order_id=? AND deleted_at IS NULL ORDER BY id`).all(orderId))
ipcMain.handle('qc:set',(_,{orderId,key,label,checked,note=''})=>{const db=getDb();db.prepare(`INSERT INTO order_qc(order_id,check_key,label,checked,note,checked_at) VALUES (?,?,?,?,?,CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END) ON CONFLICT(order_id,check_key) DO UPDATE SET label=excluded.label,checked=excluded.checked,note=excluded.note,checked_at=CASE WHEN excluded.checked=1 THEN CURRENT_TIMESTAMP ELSE NULL END`).run(orderId,key,label,checked?1:0,note,checked?1:0);syncCloseoutAutomation(orderId);return true})

// --- 0.32.3 DEV: Vehicle Intelligence / technical data ---------------------
function technicalForOrder(orderId){
 const db=getDb(),o=db.prepare(`${orderSelect} WHERE o.id=?`).get(orderId);if(!o)return[]
 return db.prepare(`SELECT * FROM technical_data_entries t WHERE t.deleted_at IS NULL AND (
   (t.scope='VEHICLE' AND t.vehicle_id=?) OR
   (t.scope='ENGINE' AND lower(COALESCE(t.make,''))=lower(?) AND lower(COALESCE(t.engine_code,''))=lower(?)) OR
   (t.scope='MODEL' AND lower(COALESCE(t.make,''))=lower(?) AND lower(COALESCE(t.model,''))=lower(?) AND (COALESCE(t.generation,'')='' OR lower(t.generation)=lower(?)) AND (t.year_from IS NULL OR t.year_from<=?) AND (t.year_to IS NULL OR t.year_to>=?)) OR
   t.scope='GLOBAL') ORDER BY t.verified DESC,CASE t.scope WHEN 'VEHICLE' THEN 1 WHEN 'ENGINE' THEN 2 WHEN 'MODEL' THEN 3 ELSE 4 END,t.category,t.parameter`)
   .all(o.vehicle_id,o.make,o.engine_code||'',o.make,o.model,o.generation||'',Number(o.year||0),Number(o.year||0))
}
ipcMain.handle('technicalData:forOrder',(_,orderId)=>technicalForOrder(orderId))
ipcMain.handle('technicalData:search',(_,query='')=>{
 const db=getDb(),q=`%${String(query||'').trim()}%`;
 return db.prepare(`SELECT * FROM technical_data_entries WHERE deleted_at IS NULL AND (parameter LIKE ? OR notes LIKE ? OR work_tags LIKE ? OR make LIKE ? OR model LIKE ? OR engine LIKE ? OR engine_code LIKE ?) ORDER BY CASE verification_level WHEN 'OEM_VERIFIED' THEN 1 WHEN 'VERIFIED' THEN 2 WHEN 'CORROBORATED_SECONDARY' THEN 3 ELSE 4 END, make,engine_code,category,parameter LIMIT 100`).all(q,q,q,q,q,q,q)
})
ipcMain.handle('technicalData:create',(_,{orderId,data})=>{const db=getDb(),o=db.prepare(`${orderSelect} WHERE o.id=?`).get(orderId);if(!o)return{ok:false};const scope=data.scope||'VEHICLE';const r=db.prepare(`INSERT INTO technical_data_entries(scope,vehicle_id,make,model,generation,year_from,year_to,engine,engine_code,category,parameter,value,unit,notes,work_tags,source_type,source_name,source_ref,source_date,verified) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(scope,scope==='VEHICLE'?o.vehicle_id:null,o.make||'',scope==='MODEL'?o.model||'':'',scope==='MODEL'?o.generation||'':'',scope==='MODEL'?(Number(o.year)||null):null,scope==='MODEL'?(Number(o.year)||null):null,o.engine||'',scope==='ENGINE'?o.engine_code||'':'',data.category||'NOTE',data.parameter||'',data.value||'',data.unit||'',data.notes||'',data.work_tags||'',data.source_type||'WORKSHOP',data.source_name||'',data.source_ref||'',data.source_date||'',data.verified?1:0);return{ok:true,id:Number(r.lastInsertRowid)}})
ipcMain.handle('technicalData:update',(_,{id,data})=>{getDb().prepare(`UPDATE technical_data_entries SET category=?,parameter=?,value=?,unit=?,notes=?,work_tags=?,source_type=?,source_name=?,source_ref=?,source_date=?,verified=? WHERE id=?`).run(data.category||'NOTE',data.parameter||'',data.value||'',data.unit||'',data.notes||'',data.work_tags||'',data.source_type||'WORKSHOP',data.source_name||'',data.source_ref||'',data.source_date||'',data.verified?1:0,id);return true})
ipcMain.handle('technicalData:remove',(_,id)=>{getDb().prepare('UPDATE technical_data_entries SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(id);return true})

// --- 0.38 DEV: interactive technical documentation --------------------------
function manualAssetDir(){const d=path.join(app.getPath('userData'),'technical-manuals');fs.mkdirSync(d,{recursive:true});return d}
function manualMime(ext){ext=String(ext||'').toLowerCase();if(ext==='.pdf')return'application/pdf';if(ext==='.svg')return'image/svg+xml';if(ext==='.webp')return'image/webp';if(ext==='.png')return'image/png';return'image/jpeg'}
function manualAssetData(row){if(!row?.file_path||!fs.existsSync(row.file_path))return null;try{return `data:${row.mime||manualMime(path.extname(row.file_path))};base64,${fs.readFileSync(row.file_path).toString('base64')}`}catch{return null}}
ipcMain.handle('technicalManual:list',(_e,filter={})=>{const db=getDb(),where=['1=1'],args=[];const q=String(filter.query||'').trim();if(q){where.push('(title LIKE ? OR section LIKE ? OR subsection LIKE ? OR make LIKE ? OR model LIKE ? OR engine_code LIKE ? OR work_tags LIKE ? OR notes LIKE ?)');for(let i=0;i<8;i++)args.push(`%${q}%`)}if(filter.make){where.push("lower(COALESCE(make,''))=lower(?)");args.push(filter.make)}if(filter.model){where.push("lower(COALESCE(model,''))=lower(?)");args.push(filter.model)}if(filter.engine_code){where.push("lower(COALESCE(engine_code,''))=lower(?)");args.push(filter.engine_code)}return db.prepare(`SELECT p.*,(SELECT COUNT(*) FROM technical_manual_hotspots h WHERE h.manual_page_id=p.id) hotspot_count,(SELECT COUNT(*) FROM technical_manual_steps s WHERE s.manual_page_id=p.id) step_count FROM technical_manual_pages p WHERE ${where.join(' AND ')} ORDER BY make,model,section,sort_order,title LIMIT 500`).all(...args)})
ipcMain.handle('technicalManual:get',(_e,id)=>{const db=getDb(),page=db.prepare('SELECT * FROM technical_manual_pages WHERE id=?').get(id);if(!page)return null;return{page,hotspots:db.prepare('SELECT * FROM technical_manual_hotspots WHERE manual_page_id=? ORDER BY id').all(id),steps:db.prepare('SELECT * FROM technical_manual_steps WHERE manual_page_id=? ORDER BY step_no,id').all(id),assetData:manualAssetData(page)}})
ipcMain.handle('technicalManual:create',(_e,data={})=>{const db=getDb();const r=db.prepare(`INSERT INTO technical_manual_pages(title,section,subsection,make,model,generation,year_from,year_to,engine,engine_code,gearbox_code,work_tags,page_type,file_path,mime,source_type,source_name,source_ref,source_date,verification_level,notes,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(data.title||'Nowa strona',data.section||'Ogólne',data.subsection||'',data.make||'',data.model||'',data.generation||'',data.year_from||null,data.year_to||null,data.engine||'',data.engine_code||'',data.gearbox_code||'',data.work_tags||'',data.page_type||'DIAGRAM',data.file_path||'',data.mime||'',data.source_type||'WORKSHOP',data.source_name||'',data.source_ref||'',data.source_date||'',data.verification_level||'WORKSHOP',data.notes||'',Number(data.sort_order)||0);return{id:Number(r.lastInsertRowid)}})
ipcMain.handle('technicalManual:update',(_e,{id,data})=>{getDb().prepare(`UPDATE technical_manual_pages SET title=?,section=?,subsection=?,make=?,model=?,generation=?,year_from=?,year_to=?,engine=?,engine_code=?,gearbox_code=?,work_tags=?,source_type=?,source_name=?,source_ref=?,source_date=?,verification_level=?,notes=?,sort_order=? WHERE id=?`).run(data.title||'',data.section||'Ogólne',data.subsection||'',data.make||'',data.model||'',data.generation||'',data.year_from||null,data.year_to||null,data.engine||'',data.engine_code||'',data.gearbox_code||'',data.work_tags||'',data.source_type||'WORKSHOP',data.source_name||'',data.source_ref||'',data.source_date||'',data.verification_level||'WORKSHOP',data.notes||'',Number(data.sort_order)||0,id);return true})
ipcMain.handle('technicalManual:pickAsset',async(_e,data={})=>{const r=await dialog.showOpenDialog({properties:['openFile'],filters:[{name:'Dokumentacja techniczna',extensions:['jpg','jpeg','png','webp','svg','pdf']}]});if(r.canceled||!r.filePaths[0])return null;const src=r.filePaths[0],ext=path.extname(src).toLowerCase(),dst=path.join(manualAssetDir(),`${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);fs.copyFileSync(src,dst);const db=getDb();const title=data.title||path.basename(src,path.extname(src));const rr=db.prepare(`INSERT INTO technical_manual_pages(title,section,subsection,make,model,generation,year_from,year_to,engine,engine_code,gearbox_code,work_tags,page_type,file_path,mime,source_type,source_name,source_ref,source_date,verification_level,notes,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(title,data.section||'Import',data.subsection||'',data.make||'',data.model||'',data.generation||'',data.year_from||null,data.year_to||null,data.engine||'',data.engine_code||'',data.gearbox_code||'',data.work_tags||'',ext==='.pdf'?'PDF':'IMAGE',dst,manualMime(ext),data.source_type||'CAPTURED',data.source_name||path.basename(src),data.source_ref||'',data.source_date||'',data.verification_level||'WORKSHOP',data.notes||'',Number(data.sort_order)||0);return{id:Number(rr.lastInsertRowid),title,file_path:dst,mime:manualMime(ext)}})
ipcMain.handle('technicalManual:captureClipboard',(_e,data={})=>{const image=clipboard.readImage();if(image.isEmpty())return{ok:false,error:'Schowek nie zawiera obrazu.'};const png=image.toPNG(),dst=path.join(manualAssetDir(),`${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`);fs.writeFileSync(dst,png);const db=getDb();const rr=db.prepare(`INSERT INTO technical_manual_pages(title,section,subsection,make,model,generation,year_from,year_to,engine,engine_code,gearbox_code,work_tags,page_type,file_path,mime,source_type,source_name,source_ref,source_date,verification_level,notes,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(data.title||`Przechwycona instrukcja ${new Date().toLocaleDateString('pl-PL')}`,data.section||'Przechwycone',data.subsection||'',data.make||'',data.model||'',data.generation||'',data.year_from||null,data.year_to||null,data.engine||'',data.engine_code||'',data.gearbox_code||'',data.work_tags||'','IMAGE',dst,'image/png','CAPTURED',data.source_name||'Schowek Windows',data.source_ref||'',data.source_date||'',data.verification_level||'WORKSHOP',data.notes||'',Number(data.sort_order)||0);return{ok:true,id:Number(rr.lastInsertRowid)}})
ipcMain.handle('technicalManual:remove',(_e,id)=>{const db=getDb(),p=db.prepare('SELECT file_path FROM technical_manual_pages WHERE id=?').get(id);if(p?.file_path){try{fs.unlinkSync(p.file_path)}catch{}}db.prepare('DELETE FROM technical_manual_pages WHERE id=?').run(id);return true})
ipcMain.handle('technicalManual:openAsset',(_e,id)=>{const p=getDb().prepare('SELECT file_path FROM technical_manual_pages WHERE id=?').get(id);if(p?.file_path)shell.openPath(p.file_path);return true})
ipcMain.handle('technicalManual:openSource',(_e,id)=>{const p=getDb().prepare('SELECT source_ref FROM technical_manual_pages WHERE id=?').get(id);if(p?.source_ref&&/^https?:\/\//i.test(p.source_ref))shell.openExternal(p.source_ref);return true})
ipcMain.handle('technicalManual:addHotspot',(_e,{pageId,data})=>{const d=data||{},r=getDb().prepare(`INSERT INTO technical_manual_hotspots(manual_page_id,x,y,w,h,label,kind,value,unit,angle,note,source_type,source_name,source_ref,verification_level,technical_data_id,part_hint,tool_hint,sequence_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(pageId,Math.max(0,Math.min(1,+d.x||0.5)),Math.max(0,Math.min(1,+d.y||0.5)),+d.w||0.03,+d.h||0.03,d.label||'Punkt techniczny',d.kind||'TORQUE',d.value||'',d.unit||'',d.angle||'',d.note||'',d.source_type||'WORKSHOP',d.source_name||'',d.source_ref||'',d.verification_level||'WORKSHOP',d.technical_data_id||null,d.part_hint||'',d.tool_hint||'',d.sequence_ref||'');return{id:Number(r.lastInsertRowid)}})
ipcMain.handle('technicalManual:updateHotspot',(_e,{id,data})=>{const d=data||{};getDb().prepare(`UPDATE technical_manual_hotspots SET x=?,y=?,label=?,kind=?,value=?,unit=?,angle=?,note=?,source_type=?,source_name=?,source_ref=?,verification_level=?,technical_data_id=?,part_hint=?,tool_hint=?,sequence_ref=? WHERE id=?`).run(+d.x||0,+d.y||0,d.label||'',d.kind||'TORQUE',d.value||'',d.unit||'',d.angle||'',d.note||'',d.source_type||'WORKSHOP',d.source_name||'',d.source_ref||'',d.verification_level||'WORKSHOP',d.technical_data_id||null,d.part_hint||'',d.tool_hint||'',d.sequence_ref||'',id);return true})
ipcMain.handle('technicalManual:removeHotspot',(_e,id)=>{getDb().prepare('DELETE FROM technical_manual_hotspots WHERE id=?').run(id);return true})
ipcMain.handle('technicalManual:addStep',(_e,{pageId,data})=>{const db=getDb(),next=db.prepare('SELECT COALESCE(MAX(step_no),0)+1 n FROM technical_manual_steps WHERE manual_page_id=?').get(pageId).n,d=data||{},r=db.prepare(`INSERT INTO technical_manual_steps(manual_page_id,step_no,title,instruction,warning,tool,technical_data_id) VALUES (?,?,?,?,?,?,?)`).run(pageId,d.step_no||next,d.title||`Krok ${next}`,d.instruction||'',d.warning||'',d.tool||'',d.technical_data_id||null);return{id:Number(r.lastInsertRowid)}})
ipcMain.handle('technicalManual:updateStep',(_e,{id,data})=>{const d=data||{};getDb().prepare('UPDATE technical_manual_steps SET step_no=?,title=?,instruction=?,warning=?,tool=?,technical_data_id=? WHERE id=?').run(+d.step_no||1,d.title||'',d.instruction||'',d.warning||'',d.tool||'',d.technical_data_id||null,id);return true})
ipcMain.handle('technicalManual:removeStep',(_e,id)=>{getDb().prepare('DELETE FROM technical_manual_steps WHERE id=?').run(id);return true})

// --- 0.32.2 DEV: procedure bundles -----------------------------------------
// --- 0.34 DEV: custom workshop procedure templates ------------------------
const parseWorkTemplate=x=>{if(!x)return x;for(const k of ['pre_json','steps_json','qc_json','parts_json','materials_json','recommendations_json','safety_json']){try{x[k.replace('_json','')]=JSON.parse(x[k]||'[]')}catch{x[k.replace('_json','')]=[]}}return x}
ipcMain.handle('workTemplates:list',()=>getDb().prepare("SELECT * FROM work_templates WHERE deleted_at IS NULL AND active=1 ORDER BY group_name,name").all().map(parseWorkTemplate))
ipcMain.handle('workTemplates:create',(_d,data)=>{const db=getDb();const j=x=>JSON.stringify(Array.isArray(x)?x:[]);const r=db.prepare(`INSERT INTO work_templates(name,group_name,variant,scope,hours,rate,pre_json,steps_json,qc_json,parts_json,materials_json,recommendations_json,safety_json,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`).run(data.name||'Własna procedura',data.group_name||'Własne',data.variant||'standard',data.scope||'',+data.hours||1,+data.rate||220,j(data.pre),j(data.steps),j(data.qc),j(data.parts),j(data.materials),j(data.recommendations),j(data.safety));return{id:Number(r.lastInsertRowid)}})
ipcMain.handle('workTemplates:update',(_d,{id,data})=>{const db=getDb();const j=x=>JSON.stringify(Array.isArray(x)?x:[]);db.prepare(`UPDATE work_templates SET name=?,group_name=?,variant=?,scope=?,hours=?,rate=?,pre_json=?,steps_json=?,qc_json=?,parts_json=?,materials_json=?,recommendations_json=?,safety_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(data.name||'Własna procedura',data.group_name||'Własne',data.variant||'standard',data.scope||'',+data.hours||1,+data.rate||220,j(data.pre),j(data.steps),j(data.qc),j(data.parts),j(data.materials),j(data.recommendations),j(data.safety),id);return true})
ipcMain.handle('workTemplates:remove',(_d,id)=>{getDb().prepare('UPDATE work_templates SET active=0,deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);return true})

ipcMain.handle('procedures:list',(_,orderId)=>getDb().prepare('SELECT * FROM work_procedure_runs WHERE order_id=? ORDER BY id DESC').all(orderId).map(x=>{for(const k of ['pre_json','steps_json','qc_json','recommendations_json','safety_json','parts_json','materials_json','technical_json','progress_json']){try{x[k.replace('_json','')]=JSON.parse(x[k]|| (k==='progress_json'?'{}':'[]'))}catch{x[k.replace('_json','')]=k==='progress_json'?{}:[]}}return x}))
ipcMain.handle('procedures:createBundle',(_,{orderId,data})=>{const db=getDb();const tx=db.transaction(()=>{
  const hours=+data.hours||1,unitPrice=+data.rate||0,total=hours*unitPrice
  const labor=db.prepare("INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,notes,catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot) VALUES (?,'ROBOCIZNA',?,?,?,?,?,?,?,?,?,?,?,?,?)").run(orderId,data.name,hours,0,unitPrice,data.scope||'',data.catalog_work_id||null,data.catalog_variant_id||null,data.title||data.name,data.variant||'',data.scope||'',data.technicalDescription||'',hours,total)
  const selectedParts=(data.parts||[]).filter(x=>x.selected!==false)
  const partIds=[]
  for(const p of selectedParts){const r=db.prepare("INSERT INTO job_part_orders(order_id,part_no,name,qty,unit_cost,unit_price,status,notes) VALUES (?,?,?,?,?,?,'DO_ZAMOWIENIA',?)").run(orderId,'',p.name,+p.qty||1,0,0,`Sugestia z procedury: ${data.name}${p.note?` · ${p.note}`:''}`);partIds.push(Number(r.lastInsertRowid))}
  const progress={};for(const section of ['pre','steps','qc'])for(let i=0;i<(data[section]||[]).length;i++)progress[`${section}:${i}`]=false
  const proc=db.prepare(`INSERT INTO work_procedure_runs(order_id,order_item_id,template_key,title,variant,pre_json,steps_json,qc_json,recommendations_json,safety_json,parts_json,materials_json,technical_json,progress_json,catalog_work_id,catalog_variant_id,technical_description,technical_data_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderId,labor.lastInsertRowid,data.template_key||'',data.title||data.name,data.variant||'',JSON.stringify(data.pre||[]),JSON.stringify(data.steps||[]),JSON.stringify(data.qc||[]),JSON.stringify(data.recommendations||[]),JSON.stringify(data.safety||[]),JSON.stringify(selectedParts),JSON.stringify((data.materials||[]).filter(x=>x.selected!==false)),JSON.stringify(data.technical||[]),JSON.stringify(progress),data.catalog_work_id||null,data.catalog_variant_id||null,data.technicalDescription||'',data.technicalDataKey||null)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(orderId,'PROCEDURE','Dodano pakiet procedury',`${data.name} · ${selectedParts.length} sugerowanych części`)
  syncOrderItemTotals(orderId);return {procedureId:Number(proc.lastInsertRowid),orderItemId:Number(labor.lastInsertRowid),partIds}
 });return tx()})
ipcMain.handle('procedures:toggle',(_,{id,key,checked})=>{const db=getDb();const row=db.prepare('SELECT progress_json FROM work_procedure_runs WHERE id=?').get(id);if(!row)return false;let p={};try{p=JSON.parse(row.progress_json||'{}')}catch{}p[key]=!!checked;db.prepare('UPDATE work_procedure_runs SET progress_json=? WHERE id=?').run(JSON.stringify(p),id);return true})
ipcMain.handle('procedures:remove',(_,id)=>{getDb().prepare('DELETE FROM work_procedure_runs WHERE id=?').run(id);return true})
ipcMain.handle('jobParts:update',(_,{id,data})=>{const db=getDb();let price=+data.unit_price||0;if(!price&&+data.unit_cost>0)price=Math.round((+data.unit_cost)*(1+partMarkup(+data.unit_cost))*100)/100;db.prepare(`UPDATE job_part_orders SET supplier_id=?,part_no=?,name=?,qty=?,unit_cost=?,unit_price=?,external_order_no=?,expected_at=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(data.supplier_id||null,data.part_no||'',data.name||'',+data.qty||1,+data.unit_cost||0,price,data.external_order_no||'',data.expected_at||null,data.notes||'',id);return true})
