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
 return {title,vehicle_id:vehicleId,order_id:orderId,start_at:start.toISOString(),end_at:end.toISOString(),bay:String(data.bay||'Stanowisko 1').trim()||'Stanowisko 1',status:data.status||'PLAN',notes:String(data.notes||'')}
}
function createAppointment(db,input){
 const d=normalizeAppointment(db,input)
 const r=db.prepare('INSERT INTO appointments(order_id,vehicle_id,title,start_at,end_at,bay,status,notes) VALUES (?,?,?,?,?,?,?,?)').run(d.order_id,d.vehicle_id,d.title,d.start_at,d.end_at,d.bay,d.status,d.notes)
 return {id:r.lastInsertRowid}
}
function updateAppointment(db,id,input){
 const existing=db.prepare('SELECT * FROM appointments WHERE id=?').get(id)
 if(!existing)throw new Error('Wizyta już nie istnieje. Odśwież terminarz.')
 const d=normalizeAppointment(db,input,existing)
 db.prepare('UPDATE appointments SET order_id=?,vehicle_id=?,title=?,start_at=?,end_at=?,bay=?,status=?,notes=? WHERE id=?').run(d.order_id,d.vehicle_id,d.title,d.start_at,d.end_at,d.bay,d.status,d.notes,id)
 return true
}
module.exports={normalizeAppointment,createAppointment,updateAppointment}
