const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, Notification } = require('electron')
const path = require('path')
const fs = require('fs')
const http = require('http')
const os = require('os')
const crypto = require('crypto')
const { getDb } = require('./db.cjs')
const cloudSync = require('./cloud-sync.cjs')
const { findQuoteApproval, assertQuoteEditable } = require('./quote-approval.cjs')

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
app.whenReady().then(async()=>{
  createWindow()
  try{ cloudSync.startAuto() }catch(e){ console.error('[cloud sync autostart]',e) }
  try{ await autoBackupDb() }catch(e){ console.error('[auto backup]',e) }
  try{ const cfg=loadRemoteConfig(); if(cfg.autoStart) await createMobileServer(cfg.port) }catch(e){ console.error('[mobile autostart]',e) }
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


const orderSelect = `SELECT o.*,v.id vehicle_id,v.plate,v.make,v.model,v.generation,v.vin,v.mileage,v.engine,v.power_hp,v.engine_code,c.name customer,c.phone,c.email,
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

ipcMain.handle('dashboard:get',()=>{
  const db=getDb();
  const open=db.prepare("SELECT COUNT(*) c FROM orders WHERE status != 'WYDANE'").get().c
  const today=db.prepare("SELECT COUNT(*) c FROM orders WHERE date(opened_at)=date('now','localtime')").get().c
  const month=db.prepare(`SELECT COALESCE(SUM(labor_hours*labor_rate + parts_sale + other_sale + diagnosis_fee - discount),0) revenue,COALESCE(SUM(parts_cost + other_cost),0) variableCost,COALESCE(SUM(labor_hours),0) laborHours FROM orders WHERE strftime('%Y-%m',opened_at)=strftime('%Y-%m','now','localtime')`).get()
  const actual=db.prepare(`SELECT COALESCE(SUM(CASE WHEN duration_minutes IS NOT NULL THEN duration_minutes ELSE (julianday('now')-julianday(started_at))*1440 END),0) minutes FROM work_logs WHERE strftime('%Y-%m',started_at)=strftime('%Y-%m','now','localtime')`).get().minutes
  const status=db.prepare("SELECT status,COUNT(*) c FROM orders WHERE status!='WYDANE' GROUP BY status").all()
  const recent=db.prepare(`${orderSelect} ORDER BY o.opened_at DESC LIMIT 8`).all()
  const sources=db.prepare(`SELECT source, COUNT(*) c FROM orders WHERE strftime('%Y-%m',opened_at)=strftime('%Y-%m','now','localtime') GROUP BY source ORDER BY c DESC`).all()
  const reminders=db.prepare(`SELECT r.*,v.plate,v.make,v.model FROM reminders r JOIN vehicles v ON v.id=r.vehicle_id WHERE done=0 ORDER BY COALESCE(due_date,'9999-12-31') LIMIT 8`).all()
  const next=db.prepare(`SELECT a.*,v.plate,v.make,v.model FROM appointments a LEFT JOIN vehicles v ON v.id=a.vehicle_id WHERE datetime(a.end_at)>=datetime('now') ORDER BY a.start_at LIMIT 5`).all()
  const active=db.prepare(`SELECT w.*,o.title,v.plate,v.make,v.model FROM work_logs w JOIN orders o ON o.id=w.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE w.ended_at IS NULL ORDER BY w.started_at DESC`).all()
  const notificationCount =
    db.prepare("SELECT COUNT(*) c FROM orders WHERE status!='WYDANE' AND COALESCE(wait_state,'BRAK')!='BRAK'").get().c +
    db.prepare("SELECT COUNT(*) c FROM communications WHERE needs_reply=1 AND resolved=0").get().c +
    db.prepare("SELECT COUNT(*) c FROM job_part_orders WHERE expected_at IS NOT NULL AND datetime(expected_at)<datetime('now') AND status NOT IN ('ODEBRANE','ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE')").get().c
  return {open,today,month:{...month,actualHours:Number(actual)/60},status,recent,sources,reminders,next,active,notificationCount}
})

ipcMain.handle('customers:list',(_,q='')=>getDb().prepare(`SELECT c.*, COUNT(DISTINCT v.id) vehicles, COUNT(DISTINCT o.id) orders FROM customers c LEFT JOIN vehicles v ON v.customer_id=c.id LEFT JOIN orders o ON o.vehicle_id=v.id WHERE c.name LIKE ? OR COALESCE(c.phone,'') LIKE ? OR COALESCE(c.company,'') LIKE ? GROUP BY c.id ORDER BY c.created_at DESC`).all(`%${q}%`,`%${q}%`,`%${q}%`))
ipcMain.handle('customers:create',(_,d)=>{const r=getDb().prepare('INSERT INTO customers(name,phone,email,company,notes) VALUES (?,?,?,?,?)').run(d.name,d.phone||'',d.email||'',d.company||'',d.notes||'');return{id:r.lastInsertRowid}})
ipcMain.handle('vehicles:list',(_,customerId)=>customerId?getDb().prepare('SELECT * FROM vehicles WHERE customer_id=? ORDER BY created_at DESC').all(customerId):getDb().prepare(`SELECT v.*,c.name customer FROM vehicles v JOIN customers c ON c.id=v.customer_id ORDER BY v.created_at DESC`).all())
ipcMain.handle('vehicles:create',(_,d)=>{const r=getDb().prepare('INSERT INTO vehicles(customer_id,plate,vin,make,model,year,engine,mileage,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(d.customer_id,d.plate||'',d.vin||'',d.make||'',d.model||'',d.year||null,d.engine||'',d.mileage||0,d.notes||'');return{id:r.lastInsertRowid}})
ipcMain.handle('vehicles:history',(_,id)=>getDb().prepare(`${orderSelect} WHERE o.vehicle_id=? ORDER BY o.opened_at DESC`).all(id))

ipcMain.handle('orders:list',(_,status='')=>status?getDb().prepare(`${orderSelect} WHERE o.status=? ORDER BY o.opened_at DESC`).all(status):getDb().prepare(`${orderSelect} ORDER BY CASE WHEN o.status='WYDANE' THEN 1 ELSE 0 END,o.opened_at DESC`).all())
ipcMain.handle('orders:get',(_,id)=>getDb().prepare(`${orderSelect} WHERE o.id=?`).get(id))
ipcMain.handle('orders:create',(_,d)=>{const r=getDb().prepare(`INSERT INTO orders(vehicle_id,title,complaint,status,priority,diagnosis_limit,labor_rate,diagnosis_fee,source,due_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(d.vehicle_id,d.title,d.complaint||'','PRZYJETE',d.priority||'NORMALNY',+d.diagnosis_limit||0,+d.labor_rate||220,+d.diagnosis_fee||0,d.source||'nieznane',d.due_at||null);return{id:r.lastInsertRowid}})
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
ipcMain.handle('items:create',(_,{orderId,data})=>{const r=getDb().prepare('INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,supplier,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(orderId,data.kind||'CZESC',data.name,+data.qty||1,+data.unit_cost||0,+data.unit_price||0,data.part_no||'',data.supplier||'',data.notes||'');syncOrderItemTotals(orderId);return{id:r.lastInsertRowid}})
ipcMain.handle('items:remove',(_,id)=>{const db=getDb();const row=db.prepare('SELECT order_id FROM order_items WHERE id=?').get(id);if(row){db.prepare('DELETE FROM order_items WHERE id=?').run(id);syncOrderItemTotals(row.order_id)}return true})

ipcMain.handle('diagnostics:get',(_,orderId)=>getDb().prepare('SELECT * FROM diagnostics WHERE order_id=? ORDER BY id DESC LIMIT 1').get(orderId)||null)
ipcMain.handle('diagnostics:save',(_,{orderId,data})=>{const db=getDb();const ex=db.prepare('SELECT id FROM diagnostics WHERE order_id=?').get(orderId);if(ex)db.prepare(`UPDATE diagnostics SET symptom_confirmed=?,dtcs=?,measurements=?,hypothesis=?,conclusion=?,recommendation=?,time_hours=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(data.symptom_confirmed||'',data.dtcs||'',data.measurements||'',data.hypothesis||'',data.conclusion||'',data.recommendation||'',+data.time_hours||0,ex.id);else db.prepare(`INSERT INTO diagnostics(order_id,symptom_confirmed,dtcs,measurements,hypothesis,conclusion,recommendation,time_hours) VALUES (?,?,?,?,?,?,?,?)`).run(orderId,data.symptom_confirmed||'',data.dtcs||'',data.measurements||'',data.hypothesis||'',data.conclusion||'',data.recommendation||'',+data.time_hours||0);return true})

ipcMain.handle('appointments:list',(_,{from,to})=>getDb().prepare(`SELECT a.*,v.plate,v.make,v.model,c.name customer FROM appointments a LEFT JOIN vehicles v ON v.id=a.vehicle_id LEFT JOIN customers c ON c.id=v.customer_id WHERE datetime(a.start_at)<datetime(?) AND datetime(a.end_at)>datetime(?) ORDER BY a.start_at`).all(to,from))
ipcMain.handle('appointments:create',(_,d)=>{const r=getDb().prepare('INSERT INTO appointments(order_id,vehicle_id,title,start_at,end_at,bay,status,notes) VALUES (?,?,?,?,?,?,?,?)').run(d.order_id||null,d.vehicle_id||null,d.title,d.start_at,d.end_at,d.bay||'Stanowisko 1',d.status||'PLAN',d.notes||'');return{id:r.lastInsertRowid}})
ipcMain.handle('appointments:update',(_,{id,data})=>{getDb().prepare('UPDATE appointments SET title=?,start_at=?,end_at=?,bay=?,status=?,notes=? WHERE id=?').run(data.title,data.start_at,data.end_at,data.bay,data.status||'PLAN',data.notes||'',id);return true})
ipcMain.handle('appointments:remove',(_,id)=>{getDb().prepare('DELETE FROM appointments WHERE id=?').run(id);return true})

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
ipcMain.handle('quotes:addItem',(_,{orderId,data})=>{const db=getDb();let q=db.prepare("SELECT * FROM quotes WHERE order_id=? AND status='ROBOCZA' ORDER BY id DESC LIMIT 1").get(orderId);if(!q){const r=db.prepare("INSERT INTO quotes(order_id,status) VALUES (?,'ROBOCZA')").run(orderId);q={id:r.lastInsertRowid,order_id:orderId,status:'ROBOCZA'}};assertQuoteEditable(db,q);let price=+data.unit_price||0;if((data.kind||'CZESC')==='CZESC'&&!price)price=Math.round((+data.unit_cost||0)*(1+partMarkup(+data.unit_cost||0))*100)/100;const r=db.prepare('INSERT INTO quote_items(quote_id,kind,name,qty,unit_cost,unit_price,labor_hours,labor_rate,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(q.id,data.kind||'CZESC',data.name,+data.qty||1,+data.unit_cost||0,price,+data.labor_hours||0,+data.labor_rate||0,data.notes||'');return{id:r.lastInsertRowid,recommendedPrice:price}})
ipcMain.handle('quotes:removeItem',(_,id)=>{const db=getDb();const item=db.prepare('SELECT quote_id FROM quote_items WHERE id=?').get(id);if(!item)return false;assertQuoteEditable(db,db.prepare('SELECT * FROM quotes WHERE id=?').get(item.quote_id));db.prepare('DELETE FROM quote_items WHERE id=?').run(id);return true})
ipcMain.handle('quotes:requestApproval',(_,id)=>{
  const db=getDb(); const q=db.prepare('SELECT * FROM quotes WHERE id=?').get(id); if(!q)return{ok:false}
  const existing=findQuoteApproval(db,q.order_id,q.id)
  if(existing)return{ok:true,already:true,approvalId:existing.id,total:existing.amount}
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
ipcMain.handle('quotes:accept',(_,id)=>{const db=getDb();const q=db.prepare('SELECT * FROM quotes WHERE id=?').get(id);if(!q)return{ok:false};if(q.status==='ZAAKCEPTOWANA')return{ok:true,already:true};const approval=findQuoteApproval(db,q.order_id,id);if(!approval||approval.status!=='APPROVED')return{ok:false,reason:'APPROVAL_REQUIRED'};const items=db.prepare('SELECT * FROM quote_items WHERE quote_id=?').all(id);let parts=0;const tx=db.transaction(()=>{for(const x of items){if(x.kind==='ROBOCIZNA'){db.prepare('UPDATE orders SET labor_hours=labor_hours+?,labor_rate=? WHERE id=?').run(x.labor_hours,x.labor_rate||220,q.order_id)}else if(x.kind==='CZESC'){db.prepare(`INSERT INTO job_part_orders(order_id,part_no,name,qty,unit_cost,unit_price,status,notes) VALUES (?,?,?,?,?,?,'DO_ZAMOWIENIA',?)`).run(q.order_id,'',x.name,x.qty,x.unit_cost,x.unit_price,`Z zaakceptowanego kosztorysu #${id}`);parts++}else{db.prepare('INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,notes) VALUES (?,?,?,?,?,?,?)').run(q.order_id,x.kind,x.name,x.qty,x.unit_cost,x.unit_price,x.notes||'')}}db.prepare("UPDATE quotes SET status='ZAAKCEPTOWANA',accepted_at=CURRENT_TIMESTAMP WHERE id=?").run(id);syncOrderItemTotals(q.order_id);db.prepare('UPDATE orders SET status=?,wait_state=? WHERE id=?').run(parts?'AKCEPTACJA':'NAPRAWA',parts?'CZESCI':'BRAK',q.order_id);db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(q.order_id,'QUOTE_PREPARED',parts?'Zakres zaakceptowany — części do zamówienia':'Zakres zaakceptowany — gotowe do naprawy',parts?`${parts} pozycji części utworzono jako DO_ZAMOWIENIA`:'Brak części blokujących rozpoczęcie naprawy')});tx();return{ok:true,partsPrepared:parts}})

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
function documentHtml(o,items,diag,notes,type,signature){
  const rows=items.map(x=>`<tr><td>${esc(x.kind)}</td><td>${esc(x.name)}</td><td>${x.qty}</td><td>${Number(x.unit_price).toFixed(2)} zł</td><td>${(x.qty*x.unit_price).toFixed(2)} zł</td></tr>`).join('')
  const title=type==='intake'?'KARTA PRZYJĘCIA':type==='release'?'PROTOKÓŁ WYDANIA':'ZLECENIE / PODSUMOWANIE'
  const special=type==='intake'?`<h3>Zgłoszenie klienta</h3><div class="box pre">${esc(o.complaint)}</div><h3>Uwagi przy przyjęciu</h3><div class="box pre">${esc(notes?.intake_notes)}</div><p><b>Limit diagnostyki:</b> ${Number(o.diagnosis_limit||0).toFixed(2)} zł</p>${signatureSvg(signature)||'<div class="signature">Podpis / potwierdzenie klienta: ______________________________</div>'}`:type==='release'?`<h3>Wniosek / wykonane prace</h3><div class="box pre">${esc(diag?.conclusion||'')}\n${esc(diag?.recommendation||'')}</div><h3>Kontrola jakości / uwagi</h3><div class="box pre">${esc(notes?.qc_notes)}</div><h3>Zalecenia przy wydaniu</h3><div class="box pre">${esc(notes?.release_notes)}</div>${signatureSvg(signature)||'<div class="signature">Odbiór pojazdu: ______________________ &nbsp;&nbsp; Wydał: ______________________</div>'}`:''
  return `<!doctype html><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#182028;font-size:12px}h1{margin:0;font-size:25px}.top{display:flex;justify-content:space-between;border-bottom:3px solid #b28a00;padding-bottom:12px}.box{border:1px solid #ccd1d1;padding:10px;margin:10px 0}.pre{white-space:pre-wrap;min-height:42px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:7px;text-align:left}.total{text-align:right;font-size:19px;font-weight:bold}.signature{margin-top:35px;border-top:1px solid #ccc;padding-top:18px}.sigbox{margin-top:22px;border:1px solid #ccd1d1;padding:10px}.sigbox svg{width:100%;height:120px;background:#fff}.muted{color:#666}</style><div class="top"><div><h1>AUTOLOGIKA</h1><div class="muted">Diagnostyka • Mechanika • Elektronika • Programowanie</div></div><div><b>${title}</b><br>#${o.id} · ${new Date().toLocaleDateString('pl-PL')}</div></div><div class="box"><b>${esc(o.customer)}</b> · ${esc(o.phone)}<br><b>${esc(o.plate)} — ${esc(o.make)} ${esc(o.model)}</b><br>VIN: ${esc(o.vin)} · przebieg: ${esc(o.mileage)} km</div>${special}<h3>Pozycje</h3><table><thead><tr><th>Typ</th><th>Pozycja</th><th>Ilość</th><th>Cena</th><th>Razem</th></tr></thead><tbody>${rows||'<tr><td colspan="5">Brak pozycji</td></tr>'}</tbody></table><p>Robocizna: ${o.labor_hours} h × ${o.labor_rate} zł/h &nbsp; | &nbsp; Diagnostyka: ${o.diagnosis_fee} zł &nbsp; | &nbsp; Rabat: ${o.discount} zł</p><div class="total">RAZEM: ${Number(o.total).toFixed(2)} zł</div><br><small>Dokument wygenerowany przez Autologika OS.</small>`
}
ipcMain.handle('orders:exportPdf',async(_,{id,type='order'})=>{const db=getDb();const o=db.prepare(`${orderSelect} WHERE o.id=?`).get(id);if(!o)return{canceled:true};const items=db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(id);const diag=db.prepare('SELECT * FROM diagnostics WHERE order_id=? ORDER BY id DESC LIMIT 1').get(id);const notes=db.prepare('SELECT * FROM order_notes WHERE order_id=?').get(id);const signature=db.prepare('SELECT * FROM signatures WHERE order_id=? ORDER BY created_at DESC,id DESC LIMIT 1').get(id);const html=documentHtml(o,items,diag,notes,type,signature);const w=new BrowserWindow({show:false,webPreferences:{sandbox:true}});await w.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(html));const suffix=type==='intake'?'Przyjecie':type==='release'?'Wydanie':'Zlecenie';const {filePath,canceled}=await dialog.showSaveDialog({defaultPath:`Autologika_${suffix}_${o.id}_${o.plate||'auto'}.pdf`,filters:[{name:'PDF',extensions:['pdf']}]});if(canceled||!filePath){w.destroy();return{canceled:true}}const pdf=await w.webContents.printToPDF({printBackground:true,pageSize:'A4'});fs.writeFileSync(filePath,pdf);w.destroy();return{canceled:false,filePath}})

ipcMain.handle('system:dbPath',()=>path.join(app.getPath('userData'),'autologika.db'))
ipcMain.handle('system:backup',async()=>{const src=path.join(app.getPath('userData'),'autologika.db');const {filePath,canceled}=await dialog.showSaveDialog({defaultPath:`autologika-backup-${new Date().toISOString().slice(0,10)}.db`,filters:[{name:'SQLite database',extensions:['db']}]});if(canceled||!filePath)return{canceled:true};fs.copyFileSync(src,filePath);return{canceled:false,filePath}})
async function autoBackupDb(){const dir=path.join(app.getPath('userData'),'backups');fs.mkdirSync(dir,{recursive:true});const day=new Date().toISOString().slice(0,10);const dst=path.join(dir,`autologika-auto-${day}.db`);if(!fs.existsSync(dst)){await getDb().backup(dst);const files=fs.readdirSync(dir).filter(x=>/^autologika-auto-\d{4}-\d{2}-\d{2}\.db$/.test(x)).sort().reverse();for(const old of files.slice(14)){try{fs.unlinkSync(path.join(dir,old))}catch{}}}return {dir,file:dst,exists:fs.existsSync(dst)}}
ipcMain.handle('system:autoBackup',()=>autoBackupDb())
ipcMain.handle('system:autoBackupStatus',()=>{const dir=path.join(app.getPath('userData'),'backups');const files=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>x.startsWith('autologika-auto-')).sort().reverse():[];return {dir,count:files.length,last:files[0]||''}})

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
  return {id:r.lastInsertRowid}
})
ipcMain.handle('payments:remove',(_,id)=>{
  const db=getDb(); const row=db.prepare(`SELECT * FROM payments WHERE id=?`).get(id)
  if(!row)return false
  db.prepare(`DELETE FROM payments WHERE id=?`).run(id)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(row.order_id,'PAYMENT','Usunięto płatność',`${Number(row.amount||0).toFixed(2)} zł`)
  return true
})

ipcMain.handle('closeout:get',(_,orderId)=>{
  const db=getDb()
  let r=db.prepare(`SELECT * FROM closeout_checks WHERE order_id=?`).get(orderId)
  if(!r){
    db.prepare(`INSERT INTO closeout_checks(order_id) VALUES (?)`).run(orderId)
    r=db.prepare(`SELECT * FROM closeout_checks WHERE order_id=?`).get(orderId)
  }
  return r
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
  return {id:r.lastInsertRowid}
})
ipcMain.handle('approvals:decide',(_,{id,status,note})=>{
  const db=getDb(); const row=db.prepare('SELECT * FROM approvals WHERE id=?').get(id)
  if(!row)return false
  db.prepare(`UPDATE approvals SET status=?,note=CASE WHEN ?!='' THEN ? ELSE note END,decided_at=CURRENT_TIMESTAMP WHERE id=?`).run(status,note||'',note||'',id)
  db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`)
    .run(row.order_id,'APPROVAL',status==='APPROVED'?'Klient zaakceptował koszt':'Klient odrzucił koszt',`${Number(row.amount||0).toFixed(2)} zł · ${row.scope||''}`)
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
    .map(x=>({kind:'REPLY',order_id:x.order_id,plate:x.plate,title:x.title,text:x.message,created_at:COALESCE(x.reply_due_at,x.created_at),communication_id:x.id}))
  const late=db.prepare(`SELECT j.*,v.plate,o.title FROM job_part_orders j JOIN orders o ON o.id=j.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE j.expected_at IS NOT NULL AND datetime(j.expected_at)<datetime('now') AND j.status NOT IN ('ODEBRANE','ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE') ORDER BY j.expected_at`).all()
    .map(x=>({kind:'PART_LATE',order_id:x.order_id,plate:x.plate,title:x.title,text:x.name,created_at:x.expected_at}))
  const decisions=db.prepare(`SELECT a.*,v.plate,o.title,o.status order_status FROM approvals a JOIN orders o ON o.id=a.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE a.status IN ('APPROVED','DECLINED') AND o.status='AKCEPTACJA' ORDER BY COALESCE(a.decided_at,a.created_at) DESC`).all()
    .map(x=>({kind:'APPROVAL',order_id:x.order_id,plate:x.plate,title:x.title,text:x.status,amount:x.amount,note:x.note||'',created_at:x.decided_at||x.created_at}))
  return [...waits,...replies,...late,...decisions].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))
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
