const {createCustomer,createVehicle}=require('./record-editing.cjs')

const text=value=>String(value??'').trim()
const number=(value,label,{min=0,max=10000000,fallback=0}={})=>{
  if(value===''||value===null||value===undefined)return fallback
  const parsed=Number(value)
  if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new Error(`${label} ma nieprawidłową wartość.`)
  return parsed
}

function normalizeOrder(input={}){
  const title=text(input.title),priority=text(input.priority||'NORMALNY').toUpperCase()
  if(!title)throw new Error('Wpisz nazwę zlecenia.')
  if(title.length>180)throw new Error('Nazwa zlecenia może mieć maksymalnie 180 znaków.')
  if(!['NORMALNY','PILNY'].includes(priority))throw new Error('Wybierz prawidłowy priorytet zlecenia.')
  const dueAt=text(input.due_at)
  if(dueAt&&Number.isNaN(Date.parse(dueAt)))throw new Error('Termin realizacji ma nieprawidłowy format.')
  return {
    title,
    complaint:text(input.complaint),
    priority,
    diagnosis_limit:number(input.diagnosis_limit,'Limit diagnostyki',{max:1000000}),
    labor_rate:number(input.labor_rate,'Stawka robocizny',{max:100000,fallback:220}),
    diagnosis_fee:number(input.diagnosis_fee,'Opłata diagnostyczna',{max:1000000}),
    source:text(input.source)||'nieznane',
    due_at:dueAt||null,
    intake_notes:text(input.intake_notes)
  }
}

function activeOrderForVehicle(db,vehicleId){
  return db.prepare("SELECT id,title,status,opened_at FROM orders WHERE vehicle_id=? AND archived_at IS NULL AND status!='WYDANE' ORDER BY opened_at DESC,id DESC LIMIT 1").get(vehicleId)||null
}

function insertOrder(db,vehicleId,input={},allowDuplicate=false){
  const vehicle=db.prepare('SELECT id FROM vehicles WHERE id=?').get(vehicleId)
  if(!vehicle)throw new Error('Wybrany pojazd nie istnieje już w kartotece. Odśwież listę i wybierz go ponownie.')
  const existing=activeOrderForVehicle(db,vehicleId)
  if(existing&&!allowDuplicate)throw new Error(`Pojazd ma już aktywne zlecenie #${existing.id}: ${existing.title}. Otwórz je albo świadomie wybierz utworzenie osobnego zlecenia.`)
  const order=normalizeOrder(input)
  const result=db.prepare(`INSERT INTO orders(vehicle_id,title,complaint,status,priority,diagnosis_limit,labor_rate,diagnosis_fee,source,due_at,wait_state) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(vehicleId,order.title,order.complaint,'PRZYJETE',order.priority,order.diagnosis_limit,order.labor_rate,order.diagnosis_fee,order.source,order.due_at,'BRAK')
  const orderId=Number(result.lastInsertRowid)
  db.prepare('INSERT INTO order_notes(order_id,intake_notes,release_notes,qc_notes) VALUES (?,?,?,?)').run(orderId,order.intake_notes,'','')
  db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(orderId,'INTAKE','Utworzono zlecenie',order.complaint)
  return {order_id:orderId,vehicle_id:Number(vehicleId),existing_order_id:existing?Number(existing.id):null}
}

function createOrderBundle(db,payload={}){
  const mode=payload.mode==='new'?'new':'existing',allowDuplicate=payload.allow_duplicate===true
  return db.transaction(()=>{
    let customerId=null,vehicleId=Number(payload.order?.vehicle_id)||0
    if(mode==='new'){
      if(payload.owner_mode==='new')customerId=Number(createCustomer(db,payload.customer||{}).id)
      else customerId=Number(payload.vehicle?.customer_id)||null
      vehicleId=Number(createVehicle(db,{...(payload.vehicle||{}),customer_id:customerId}).id)
    }
    const created=insertOrder(db,vehicleId,payload.order||{},allowDuplicate)
    return {...created,customer_id:customerId}
  })()
}

module.exports={normalizeOrder,activeOrderForVehicle,insertOrder,createOrderBundle}
