const STATUS_ALIASES={PROGRESS:'W_TRAKCIE',W_PRACY:'W_TRAKCIE',DONE:'ZAKONCZONY',GOTOWE:'ZAKONCZONY',CANCELLED:'ANULOWANY'}
const VALID_STATUSES=new Set(['PLAN','POTWIERDZONY','W_TRAKCIE','ZAKONCZONY','ANULOWANY'])

function ensureResourceSchema(db){
 const columns=db.prepare('PRAGMA table_info(appointments)').all().map(row=>row.name)
 if(!columns.includes('planned_minutes'))db.exec('ALTER TABLE appointments ADD COLUMN planned_minutes INTEGER')
 db.exec(`CREATE TABLE IF NOT EXISTS work_resources(id INTEGER PRIMARY KEY AUTOINCREMENT,resource_type TEXT NOT NULL,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,capacity INTEGER NOT NULL DEFAULT 1,work_calendar_json TEXT NOT NULL DEFAULT '{}',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(resource_type,name));CREATE TABLE IF NOT EXISTS appointment_resources(appointment_id INTEGER NOT NULL,resource_id INTEGER NOT NULL,role TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(appointment_id,resource_id));CREATE TABLE IF NOT EXISTS schedule_conflict_overrides(id INTEGER PRIMARY KEY AUTOINCREMENT,appointment_id INTEGER NOT NULL,resource_id INTEGER NOT NULL,reason TEXT NOT NULL,actor TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`)
}
function atomic(db,fn){if(typeof db.transaction==='function')return db.transaction(fn)();db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result}catch(error){try{db.exec('ROLLBACK')}catch{}throw error}}

function appointmentStatus(value='PLAN'){
 const status=STATUS_ALIASES[String(value).toUpperCase()]||String(value).toUpperCase()
 if(!VALID_STATUSES.has(status))throw new Error('Nieprawidłowy status wizyty.')
 return status
}

function normalizeAppointment(db, input, existing={}) {
 const data={...existing,...input},title=String(data.title||'').trim()
 if(!title)throw new Error('Wpisz opis wizyty.')
 const start=new Date(data.start_at),end=new Date(data.end_at)
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime()))throw new Error('Podaj prawidłową datę i godzinę wizyty.')
 if(end<=start)throw new Error('Koniec wizyty musi być późniejszy niż początek.')
 let vehicleId=data.vehicle_id?Number(data.vehicle_id):null,orderId=data.order_id?Number(data.order_id):null
 if(orderId){
  const order=db.prepare('SELECT vehicle_id FROM orders WHERE id=?').get(orderId)
  if(!order)throw new Error('Wybrane zlecenie już nie istnieje.')
  if(vehicleId&&vehicleId!==order.vehicle_id)throw new Error('Zlecenie dotyczy innego pojazdu.')
  vehicleId=order.vehicle_id
 }
 if(vehicleId&&!db.prepare('SELECT id FROM vehicles WHERE id=?').get(vehicleId))throw new Error('Wybrany pojazd już nie istnieje.')
 return {title,vehicle_id:vehicleId,order_id:orderId,start_at:start.toISOString(),end_at:end.toISOString(),bay:String(data.bay||'Stanowisko 1').trim()||'Stanowisko 1',status:appointmentStatus(data.status),notes:String(data.notes||''),planned_minutes:Math.max(1,Math.round((end-start)/60000))}
}
function resourceForBay(db,bay){
 db.prepare("INSERT OR IGNORE INTO work_resources(resource_type,name) VALUES ('BAY',?)").run(bay)
 return db.prepare("SELECT * FROM work_resources WHERE resource_type='BAY' AND name=? AND active=1").get(bay)
}
function resourcesForAppointment(db,data){
 const selected=Array.isArray(data.resource_ids)?data.resource_ids:String(data.resource_ids||'').split(',').filter(Boolean)
 const bay=resourceForBay(db,data.bay),ids=[bay.id,...selected.map(Number).filter(Number.isInteger)]
 return [...new Set(ids)].map(id=>db.prepare('SELECT * FROM work_resources WHERE id=? AND active=1').get(id)).filter(Boolean)
}
function appointmentConflicts(db,{id=null,start_at,end_at,resourceId}){
 return db.prepare(`SELECT a.id,a.title,a.start_at,a.end_at,r.name resource_name
  FROM appointment_resources ar JOIN appointments a ON a.id=ar.appointment_id JOIN work_resources r ON r.id=ar.resource_id
  WHERE ar.resource_id=? AND a.id!=COALESCE(?,0) AND a.status!='ANULOWANY'
   AND datetime(a.start_at)<datetime(?) AND datetime(a.end_at)>datetime(?) ORDER BY a.start_at`).all(resourceId,id,end_at,start_at)
}
function assertOrAuditConflict(db,{id=null,data,resource}){
 const conflicts=appointmentConflicts(db,{id,start_at:data.start_at,end_at:data.end_at,resourceId:resource.id})
 if(!conflicts.length)return conflicts
 const override=data.override_conflict===true&&String(data.override_reason||'').trim()&&String(data.override_actor||'').trim()
 if(!override)throw new Error(`Zasób „${resource.name}” jest zajęty w tym czasie. Wymagana jest zmiana terminu albo jawny wyjątek z uzasadnieniem.`)
 return conflicts
}
function listAppointments(db,from,to){
 ensureResourceSchema(db)
 const start=new Date(from),end=new Date(to)
 if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start)throw new Error('Nieprawidłowy zakres terminarza.')
 return db.prepare(`SELECT a.*,v.plate,v.make,v.model,c.name customer,o.title order_title,o.status order_status,
  (SELECT group_concat(r.name,' • ') FROM appointment_resources ar JOIN work_resources r ON r.id=ar.resource_id WHERE ar.appointment_id=a.id) resource_names,
  (SELECT group_concat(ar.resource_id,',') FROM appointment_resources ar WHERE ar.appointment_id=a.id) resource_ids,
  COALESCE((SELECT group_concat(item_label,' • ') FROM (
   SELECT COALESCE(NULLIF(TRIM(oi.work_name),''),NULLIF(TRIM(oi.name),'')) item_label
   FROM order_items oi
   WHERE oi.order_id=a.order_id
    AND UPPER(COALESCE(oi.kind,'')) NOT IN ('CZESC','CZĘŚĆ','PART')
    AND COALESCE(NULLIF(TRIM(oi.work_name),''),NULLIF(TRIM(oi.name),'')) IS NOT NULL
   ORDER BY oi.id LIMIT 4
  )),'') work_summary,
  (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id=a.order_id AND UPPER(COALESCE(oi.kind,'')) NOT IN ('CZESC','CZĘŚĆ','PART')) work_count
  FROM appointments a
  LEFT JOIN vehicles v ON v.id=a.vehicle_id
  LEFT JOIN customers c ON c.id=v.customer_id
  LEFT JOIN orders o ON o.id=a.order_id
  WHERE datetime(a.start_at)<datetime(?) AND datetime(a.end_at)>datetime(?)
  ORDER BY a.start_at`).all(end.toISOString(),start.toISOString()).map(row=>({...row,status:appointmentStatus(row.status)}))
}
function createAppointment(db,input){
 ensureResourceSchema(db)
 const d=normalizeAppointment(db,input)
 return atomic(db,()=>{const resources=resourcesForAppointment(db,{...d,...input}),conflicts=resources.flatMap(resource=>assertOrAuditConflict(db,{data:{...d,...input},resource}).map(conflict=>({...conflict,resource_id:resource.id})));const r=db.prepare('INSERT INTO appointments(order_id,vehicle_id,title,start_at,end_at,bay,status,notes,planned_minutes) VALUES (?,?,?,?,?,?,?,?,?)').run(d.order_id,d.vehicle_id,d.title,d.start_at,d.end_at,d.bay,d.status,d.notes,d.planned_minutes);for(const resource of resources)db.prepare('INSERT INTO appointment_resources(appointment_id,resource_id) VALUES (?,?)').run(r.lastInsertRowid,resource.id);for(const conflict of conflicts)db.prepare('INSERT INTO schedule_conflict_overrides(appointment_id,resource_id,reason,actor) VALUES (?,?,?,?)').run(r.lastInsertRowid,conflict.resource_id,String(input.override_reason).trim(),String(input.override_actor).trim());return {id:Number(r.lastInsertRowid),conflicts}})
}
function updateAppointment(db,id,input){
 ensureResourceSchema(db)
 const existing=db.prepare('SELECT * FROM appointments WHERE id=?').get(id)
 if(!existing)throw new Error('Wizyta już nie istnieje. Odśwież terminarz.')
 const d=normalizeAppointment(db,input,existing)
 return atomic(db,()=>{const resources=resourcesForAppointment(db,{...d,...input}),conflicts=resources.flatMap(resource=>assertOrAuditConflict(db,{id:Number(id),data:{...d,...input},resource}).map(conflict=>({...conflict,resource_id:resource.id})));db.prepare('UPDATE appointments SET order_id=?,vehicle_id=?,title=?,start_at=?,end_at=?,bay=?,status=?,notes=?,planned_minutes=? WHERE id=?').run(d.order_id,d.vehicle_id,d.title,d.start_at,d.end_at,d.bay,d.status,d.notes,d.planned_minutes,id);db.prepare('DELETE FROM appointment_resources WHERE appointment_id=?').run(id);for(const resource of resources)db.prepare('INSERT INTO appointment_resources(appointment_id,resource_id) VALUES (?,?)').run(id,resource.id);for(const conflict of conflicts)db.prepare('INSERT INTO schedule_conflict_overrides(appointment_id,resource_id,reason,actor) VALUES (?,?,?,?)').run(id,conflict.resource_id,String(input.override_reason).trim(),String(input.override_actor).trim());return {updated:true,conflicts}})
}
function removeAppointment(db,id){
 const result=db.prepare('DELETE FROM appointments WHERE id=?').run(Number(id))
 if(!result.changes)throw new Error('Wizyta już nie istnieje. Odśwież terminarz.')
 return true
}
function listResources(db){ensureResourceSchema(db);return db.prepare('SELECT * FROM work_resources WHERE active=1 ORDER BY resource_type,name').all()}
function createResource(db,input={}){ensureResourceSchema(db);const type=String(input.resource_type||'BAY').toUpperCase(),name=String(input.name||'').trim();if(!['BAY','LIFT','MECHANIC'].includes(type)||!name)throw new Error('Podaj prawidłowy typ i nazwę zasobu.');const r=db.prepare('INSERT INTO work_resources(resource_type,name,capacity,work_calendar_json) VALUES (?,?,?,?)').run(type,name,Math.max(1,Math.round(Number(input.capacity)||1)),JSON.stringify(input.calendar||{}));return{id:Number(r.lastInsertRowid)}}
module.exports={appointmentStatus,normalizeAppointment,listAppointments,createAppointment,updateAppointment,removeAppointment,appointmentConflicts,listResources,createResource}
