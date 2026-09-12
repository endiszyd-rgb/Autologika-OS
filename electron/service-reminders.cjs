const OPEN='OPEN'
const DONE='DONE'

function cleanText(value){return String(value||'').trim()}
function dateKey(value){return String(value||'').slice(0,10)}

function reminderUrgency(row,today=new Date()){
  const todayKey=dateKey(new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString())
  const dueDate=dateKey(row.due_date)
  const currentMileage=Number(row.current_mileage||0)
  const dueMileage=Number(row.due_mileage||0)
  const mileageRemaining=dueMileage?dueMileage-currentMileage:null
  if(row.status===DONE)return {urgency:'DONE',days_remaining:null,mileage_remaining:mileageRemaining}
  if((dueDate&&dueDate<todayKey)||(dueMileage&&mileageRemaining<=0))return {urgency:'OVERDUE',days_remaining:dueDate?Math.round((new Date(`${dueDate}T12:00:00`)-new Date(`${todayKey}T12:00:00`))/86400000):null,mileage_remaining:mileageRemaining}
  const daysRemaining=dueDate?Math.round((new Date(`${dueDate}T12:00:00`)-new Date(`${todayKey}T12:00:00`))/86400000):null
  if((daysRemaining!==null&&daysRemaining<=30)||(mileageRemaining!==null&&mileageRemaining<=1500))return {urgency:'SOON',days_remaining:daysRemaining,mileage_remaining:mileageRemaining}
  return {urgency:'PLANNED',days_remaining:daysRemaining,mileage_remaining:mileageRemaining}
}

function listServiceReminders(db,{vehicleId=null,includeDone=false,today=new Date()}={}){
  const where=['r.deleted_at IS NULL']
  const args=[]
  if(vehicleId!==null&&vehicleId!==undefined){where.push('r.vehicle_id=?');args.push(Number(vehicleId))}
  if(!includeDone)where.push("r.status='OPEN'")
  const rows=db.prepare(`SELECT r.*,v.plate,v.make,v.model,v.mileage current_mileage,c.name customer,o.title order_title
    FROM service_reminders_v2 r
    JOIN vehicles v ON v.id=r.vehicle_id
    LEFT JOIN customers c ON c.id=v.customer_id
    LEFT JOIN orders o ON o.id=r.order_id
    WHERE ${where.join(' AND ')}`).all(...args)
  const rank={OVERDUE:0,SOON:1,PLANNED:2,DONE:3}
  return rows.map(row=>({...row,...reminderUrgency(row,today)})).sort((a,b)=>
    rank[a.urgency]-rank[b.urgency]||String(a.due_date||'9999-12-31').localeCompare(String(b.due_date||'9999-12-31'))||Number(a.due_mileage||Infinity)-Number(b.due_mileage||Infinity)||Number(b.id)-Number(a.id))
}

function createServiceReminder(db,{vehicleId,orderId=null,data={}}){
  const vehicle=db.prepare('SELECT id FROM vehicles WHERE id=?').get(Number(vehicleId))
  if(!vehicle)throw new Error('Wybrany pojazd nie istnieje.')
  const title=cleanText(data.title)
  if(!title)throw new Error('Podaj nazwę przypomnienia.')
  const dueDate=dateKey(data.due_date)||null
  const dueMileage=data.due_mileage===''||data.due_mileage===null||data.due_mileage===undefined?null:Number(data.due_mileage)
  if(dueMileage!==null&&(!Number.isFinite(dueMileage)||dueMileage<0))throw new Error('Przebieg przypomnienia jest nieprawidłowy.')
  const linkedOrder=orderId?db.prepare('SELECT id,vehicle_id FROM orders WHERE id=?').get(Number(orderId)):null
  if(orderId&&(!linkedOrder||Number(linkedOrder.vehicle_id)!==Number(vehicleId)))throw new Error('Zlecenie nie należy do wybranego pojazdu.')
  const result=db.prepare(`INSERT INTO service_reminders_v2(vehicle_id,order_id,title,due_date,due_mileage,note,status)
    VALUES (?,?,?,?,?,?,'OPEN')`).run(Number(vehicleId),orderId?Number(orderId):null,title,dueDate,dueMileage,cleanText(data.note))
  return {id:Number(result.lastInsertRowid)}
}

function setServiceReminderStatus(db,id,status){
  if(![OPEN,DONE].includes(status))throw new Error('Nieprawidłowy status przypomnienia.')
  const result=db.prepare('UPDATE service_reminders_v2 SET status=? WHERE id=? AND deleted_at IS NULL').run(status,Number(id))
  if(!result.changes)throw new Error('Przypomnienie nie istnieje.')
  return true
}

function migrateLegacyServiceReminders(db){
  return db.prepare(`INSERT INTO service_reminders_v2(vehicle_id,order_id,title,due_date,due_mileage,note,status)
    SELECT legacy.vehicle_id,NULL,legacy.title,legacy.due_date,legacy.due_mileage,'',CASE WHEN legacy.done=1 THEN 'DONE' ELSE 'OPEN' END
    FROM reminders legacy
    WHERE NOT EXISTS (
      SELECT 1 FROM service_reminders_v2 current
      WHERE current.vehicle_id=legacy.vehicle_id
        AND current.title=legacy.title
        AND COALESCE(current.due_date,'')=COALESCE(legacy.due_date,'')
        AND COALESCE(current.due_mileage,-1)=COALESCE(legacy.due_mileage,-1)
        AND current.deleted_at IS NULL
    )`).run()
}

module.exports={reminderUrgency,listServiceReminders,createServiceReminder,setServiceReminderStatus,migrateLegacyServiceReminders}
