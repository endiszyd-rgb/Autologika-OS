const BLOCKING_PART_STATUSES=['DO_ZAMOWIENIA','ZAMOWIONE','W_DRODZE']

function blockingPartCount(db,orderId){
  const placeholders=BLOCKING_PART_STATUSES.map(()=>'?').join(',')
  return Number(db.prepare(`SELECT COUNT(*) count FROM job_part_orders WHERE order_id=? AND status IN (${placeholders})`).get(Number(orderId),...BLOCKING_PART_STATUSES)?.count||0)
}

function reconcileOrderPartWait(db,orderId){
  const id=Number(orderId)
  const order=db.prepare('SELECT id,wait_state FROM orders WHERE id=?').get(id)
  if(!order)return{changed:false,blocking:0,waitState:'BRAK'}
  const blocking=blockingPartCount(db,id)
  const current=order.wait_state||'BRAK'
  const next=blocking>0
    ?(['BRAK','CZESCI'].includes(current)?'CZESCI':current)
    :(current==='CZESCI'?'BRAK':current)
  if(next===current)return{changed:false,blocking,waitState:next}
  db.prepare('UPDATE orders SET wait_state=? WHERE id=?').run(next,id)
  db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(
    id,'PARTS_WAIT',blocking?'Zlecenie oczekuje na części':'Wszystkie zamówione części są dostępne',blocking?`${blocking} pozycji wymaga zamówienia lub dostawy`:'Zdjęto blokadę oczekiwania na części'
  )
  return{changed:true,blocking,waitState:next}
}

module.exports={BLOCKING_PART_STATUSES,blockingPartCount,reconcileOrderPartWait}
