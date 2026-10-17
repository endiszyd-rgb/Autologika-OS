const STATUSES=['PRZYJETE','DIAGNOZA','WYCENA','AKCEPTACJA','NAPRAWA','QC_NAPRAWY','QC_WYDANIA','PLATNOSC','GOTOWE','WYDANE']
const WAIT_STATES=['BRAK','KLIENT','CZESCI','DECYZJA']
const {stopActiveWorkLogs}=require('./work-time.cjs')

function getOrder(db,id){
  const orderId=Number(id)
  if(!Number.isInteger(orderId)||orderId<=0)throw new Error('Nie wybrano zlecenia.')
  const order=db.prepare('SELECT * FROM orders WHERE id=?').get(orderId)
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

function updateOrderDetails(db,id,data={}){
  const order=getOrder(db,id)
  if(order.archived_at||order.status==='WYDANE')throw new Error('Zamknięte zlecenie można zmienić dopiero po kontrolowanym przywróceniu do aktywnych.')
  const expectedVersion=data.expected_version
  if(expectedVersion!==undefined&&expectedVersion!==null&&Number(expectedVersion)!==Number(order.version||1)){
    throw new Error('Zlecenie zostało w międzyczasie zmienione na innym urządzeniu. Zamknij edycję, odśwież dane i spróbuj ponownie.')
  }
  const title=String(data.title??order.title??'').trim()
  const complaint=String(data.complaint??order.complaint??'').trim()
  const priority=String(data.priority??order.priority??'NORMALNY').toUpperCase()
  const diagnosisLimit=Number(data.diagnosis_limit??order.diagnosis_limit??0)
  const dueAt=String(data.due_at??order.due_at??'').trim()||null
  if(!title)throw new Error('Nazwa zlecenia jest wymagana.')
  if(title.length>180)throw new Error('Nazwa zlecenia może mieć maksymalnie 180 znaków.')
  if(complaint.length>5000)throw new Error('Opis zgłoszenia jest zbyt długi.')
  if(!['NORMALNY','PILNY'].includes(priority))throw new Error('Nieprawidłowy priorytet zlecenia.')
  if(!Number.isFinite(diagnosisLimit)||diagnosisLimit<0||diagnosisLimit>1000000)throw new Error('Limit diagnostyki musi być liczbą nieujemną.')
  if(dueAt&&!Number.isFinite(Date.parse(dueAt)))throw new Error('Nieprawidłowy termin zlecenia.')
  const changes=[]
    if(title!==order.title)changes.push(`nazwa: ${order.title||'brak'} → ${title}`)
    if(complaint!==String(order.complaint||''))changes.push('zaktualizowano zgłoszenie klienta')
    if(priority!==order.priority)changes.push(`priorytet: ${order.priority||'NORMALNY'} → ${priority}`)
    if(diagnosisLimit!==Number(order.diagnosis_limit||0))changes.push(`limit diagnostyki: ${diagnosisLimit.toFixed(2)} zł`)
    if((dueAt||'')!==(order.due_at||''))changes.push(dueAt?'zmieniono termin':'usunięto termin')
  if(!changes.length)return{id:order.id,title,complaint,priority,diagnosis_limit:diagnosisLimit,due_at:dueAt,version:Number(order.version||1),changed:false}
  return db.transaction(()=>{
    db.prepare('UPDATE orders SET title=?,complaint=?,priority=?,diagnosis_limit=?,due_at=? WHERE id=?').run(title,complaint,priority,diagnosisLimit,dueAt,order.id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(order.id,'ORDER_DETAILS_UPDATED','Zmieniono dane zlecenia',changes.join(' · ')||'Zapisano dane bez zmiany wartości')
    const fresh=db.prepare('SELECT version FROM orders WHERE id=?').get(order.id)
    return{id:order.id,title,complaint,priority,diagnosis_limit:diagnosisLimit,due_at:dueAt,version:Number(fresh?.version||order.version||1),changed:true}
  })()
}

function requireOrderReadyForRelease(db,id){
  const order=getOrder(db,id)
  if(order.archived_at)throw new Error('Zarchiwizowane zlecenie trzeba najpierw otworzyć do korekty.')
  if(order.status==='WYDANE')throw new Error('Zlecenie jest już zamknięte.')
  return order
}

function releaseOrder(db,id,{completed=0,total=0,now=Date.now()}={}){
  const order=requireOrderReadyForRelease(db,id)
  return db.transaction(()=>{
    const stopped=stopActiveWorkLogs(db,order.id,now)
    const changed=db.prepare(`UPDATE orders SET status='WYDANE',wait_state='BRAK',closed_at=COALESCE(closed_at,CURRENT_TIMESTAMP) WHERE id=? AND status!='WYDANE' AND archived_at IS NULL`).run(order.id)
    if(!changed.changes)throw new Error('Zlecenie jest już zamknięte lub nie istnieje.')
    const checklistTotal=Math.max(0,Number(total)||0),checklistCompleted=Math.min(checklistTotal,Math.max(0,Number(completed)||0))
    let details=checklistTotal
      ?`Zlecenie zamknięte ręcznie · opcjonalna checklista: ${checklistCompleted}/${checklistTotal}`
      :'Zlecenie zamknięte ręcznie'
    if(stopped.count)details+=` · zakończono aktywne timery: ${stopped.count} (${stopped.minutes} min)`
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

module.exports={STATUSES,WAIT_STATES,archiveOrder,reopenOrder,releaseOrder,requireOrderReadyForRelease,updateOrderDetails,updateOrderStatus,updateOrderWait}
