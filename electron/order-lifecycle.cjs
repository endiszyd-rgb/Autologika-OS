const STATUSES=['PRZYJETE','DIAGNOZA','AKCEPTACJA','NAPRAWA','GOTOWE','WYDANE']
const WAIT_STATES=['BRAK','KLIENT','CZESCI','DECYZJA']

function getOrder(db,id){
  const orderId=Number(id)
  if(!Number.isInteger(orderId)||orderId<=0)throw new Error('Nie wybrano zlecenia.')
  const order=db.prepare('SELECT id,status,wait_state,closed_at,archived_at FROM orders WHERE id=?').get(orderId)
  if(!order)throw new Error('Zlecenie nie istnieje.')
  return order
}

function updateOrderStatus(db,id,status){
  const next=String(status||'').toUpperCase(),order=getOrder(db,id)
  if(!STATUSES.includes(next))throw new Error('Nieprawidłowy status zlecenia.')
  if(order.archived_at||order.status==='WYDANE')throw new Error('Zamknięte zlecenie można zmienić dopiero po kontrolowanym przywróceniu do aktywnych.')
  if(next==='WYDANE')throw new Error('Wydanie pojazdu potwierdź w zakładce QC / wydanie.')
  if(order.status===next)return true
  return db.transaction(()=>{
    db.prepare('UPDATE orders SET status=? WHERE id=?').run(next,order.id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(order.id,'STATUS','Zmiana statusu',`${order.status} → ${next}`)
    return true
  })()
}

function updateOrderWait(db,id,waitState){
  const next=String(waitState||'BRAK').toUpperCase(),order=getOrder(db,id)
  if(!WAIT_STATES.includes(next))throw new Error('Nieprawidłowy status oczekiwania.')
  if(order.archived_at||order.status==='WYDANE')throw new Error('Nie można zmieniać oczekiwania w zamkniętym zleceniu.')
  if((order.wait_state||'BRAK')===next)return true
  return db.transaction(()=>{
    db.prepare('UPDATE orders SET wait_state=? WHERE id=?').run(next,order.id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(order.id,'WAIT','Zmiana oczekiwania',`${order.wait_state||'BRAK'} → ${next}`)
    return true
  })()
}

function requireOrderReadyForRelease(db,id){
  const order=getOrder(db,id)
  if(order.archived_at)throw new Error('Zarchiwizowane zlecenie trzeba najpierw otworzyć do korekty.')
  if(order.status==='WYDANE')throw new Error('Zlecenie jest już zamknięte.')
  return order
}

function releaseOrder(db,id,{completed=0,total=0}={}){
  const order=requireOrderReadyForRelease(db,id)
  return db.transaction(()=>{
    const changed=db.prepare(`UPDATE orders SET status='WYDANE',wait_state='BRAK',closed_at=COALESCE(closed_at,CURRENT_TIMESTAMP) WHERE id=? AND status!='WYDANE' AND archived_at IS NULL`).run(order.id)
    if(!changed.changes)throw new Error('Zlecenie jest już zamknięte lub nie istnieje.')
    const checklistTotal=Math.max(0,Number(total)||0),checklistCompleted=Math.min(checklistTotal,Math.max(0,Number(completed)||0))
    const details=checklistTotal
      ?`Zlecenie zamknięte ręcznie · opcjonalna checklista: ${checklistCompleted}/${checklistTotal}`
      :'Zlecenie zamknięte ręcznie'
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(order.id,'ORDER_RELEASED','Pojazd wydany',details)
    return{ok:true,id:order.id,status:'WYDANE'}
  })()
}

function archiveOrder(db,id){
  const order=getOrder(db,id)
  if(order.archived_at)return{ok:true}
  if(!['GOTOWE','WYDANE'].includes(order.status))return{ok:false,error:'Do archiwum można przenieść zlecenie gotowe lub wydane.'}
  return db.transaction(()=>{
    db.prepare('UPDATE orders SET archived_at=CURRENT_TIMESTAMP WHERE id=?').run(order.id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(order.id,'ORDER_ARCHIVED','Zlecenie przeniesiono do archiwum',`Status: ${order.status}`)
    return{ok:true}
  })()
}

function reopenOrder(db,id,note){
  const order=getOrder(db,id),reason=String(note||'').trim()
  if(!reason)throw new Error('Podaj powód ponownego otwarcia zlecenia.')
  if(!order.archived_at&&order.status!=='WYDANE')throw new Error('Zlecenie jest już aktywne.')
  return db.transaction(()=>{
    db.prepare("UPDATE orders SET archived_at=NULL,status='GOTOWE',closed_at=NULL,wait_state='BRAK' WHERE id=?").run(order.id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(order.id,'ORDER_REOPENED','Ponownie otwarto zlecenie',`${order.status} → GOTOWE · ${reason}`)
    return{ok:true,id:order.id,status:'GOTOWE'}
  })()
}

module.exports={STATUSES,WAIT_STATES,archiveOrder,reopenOrder,releaseOrder,requireOrderReadyForRelease,updateOrderStatus,updateOrderWait}
