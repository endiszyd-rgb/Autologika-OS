const crypto=require('crypto')
const {wholePartQuantity}=require('./part-quantity.cjs')

const money=value=>Math.round((Number(value)||0)*100)/100
const percent=value=>Math.min(100,Math.max(0,Number(value)||0))
const integer=value=>wholePartQuantity(value)
const json=value=>JSON.stringify(value??null)
const parse=value=>{try{return JSON.parse(value)}catch{return null}}

function assertOperation(db,id,orderId=null){
  const row=db.prepare('SELECT * FROM order_repair_operations WHERE id=?').get(Number(id))
  if(!row||orderId&&Number(row.order_id)!==Number(orderId))throw new Error('Wybrana naprawa nie istnieje w tym zleceniu.')
  return row
}

function listRepairOperations(db,orderId){
  return db.prepare(`SELECT r.*,
    (SELECT COUNT(*) FROM repair_parts p WHERE p.repair_operation_id=r.id) part_count,
    (SELECT COUNT(*) FROM order_qc q WHERE q.repair_operation_id=r.id AND q.checked=1 AND q.deleted_at IS NULL) qc_done,
    (SELECT COUNT(*) FROM order_qc q WHERE q.repair_operation_id=r.id AND q.deleted_at IS NULL) qc_total
    FROM order_repair_operations r WHERE r.order_id=? ORDER BY r.id`).all(Number(orderId)).map(row=>({...row,parts:listRepairParts(db,row.id),estimate:calculateRepairEstimate(db,row.id)}))
}

function createSmartJob(db,{orderId,data,idempotencyKey}){
  const order=Number(orderId),key=String(idempotencyKey||data?.idempotency_key||'').trim()
  if(!Number.isInteger(order)||order<=0)throw new Error('Nie wybrano zlecenia.')
  if(!key)throw new Error('Brakuje klucza idempotencji pakietu pracy.')
  const existing=db.prepare('SELECT * FROM order_repair_operations WHERE order_id=? AND idempotency_key=?').get(order,key)
  if(existing)return{...existing,existing:true,parts:listRepairParts(db,existing.id)}
  const hours=Math.max(0,Number(data.hours)||0),rate=Math.max(0,Number(data.rate)||0),laborCostRate=Math.max(0,Number(data.labor_cost_rate)||0)
  return db.transaction(()=>{
    const operationResult=db.prepare(`INSERT INTO order_repair_operations(order_id,idempotency_key,catalog_work_id,catalog_variant_id,title,variant,customer_description,technical_description,planned_hours,labor_rate,labor_cost_rate,discount_percent,vat_rate)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(order,key,data.catalog_work_id||null,data.catalog_variant_id||null,data.title||data.name,data.variant||'',data.scope||'',data.technicalDescription||'',hours,rate,laborCostRate,percent(data.discount_percent),Number.isFinite(Number(data.vat_rate))?Number(data.vat_rate):23)
    const operationId=Number(operationResult.lastInsertRowid)
    const labor=db.prepare(`INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,notes,catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot,repair_operation_id)
      VALUES (?,'ROBOCIZNA',?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(order,data.name,hours,laborCostRate,rate,data.scope||'',data.catalog_work_id||null,data.catalog_variant_id||null,data.title||data.name,data.variant||'',data.scope||'',data.technicalDescription||'',hours,money(hours*rate),operationId)
    const selectedParts=(data.parts||[]).filter(item=>item.selected!==false)
    const partIds=[]
    for(const part of selectedParts){
      const qty=integer(part.qty||1)
      const planned=db.prepare(`INSERT INTO job_part_orders(order_id,part_no,name,qty,unit_cost,unit_price,status,notes,repair_operation_id)
        VALUES (?,?,?,?,?,?,'DO_ZAMOWIENIA',?,?)`).run(order,part.part_no||'',part.name,qty,Number(part.unit_cost)||0,Number(part.unit_price)||0,`Sugestia z procedury: ${data.name}${part.note?` · ${part.note}`:''}`,operationId)
      const linked=db.prepare(`INSERT INTO repair_parts(repair_operation_id,order_id,job_part_order_id,name,part_no,source,qty,unit_cost,unit_price,status,notes)
        VALUES (?,?,?,?,?,'SUGGESTED',?,?,?,'SUGGESTED',?)`).run(operationId,order,planned.lastInsertRowid,part.name,part.part_no||'',qty,Number(part.unit_cost)||0,Number(part.unit_price)||0,part.note||'')
      partIds.push(Number(linked.lastInsertRowid))
    }
    const progress={};for(const section of ['pre','steps','qc'])for(let i=0;i<(data[section]||[]).length;i++)progress[`${section}:${i}`]=false
    const procedure=db.prepare(`INSERT INTO work_procedure_runs(order_id,order_item_id,template_key,title,variant,pre_json,steps_json,qc_json,recommendations_json,safety_json,parts_json,materials_json,technical_json,progress_json,catalog_work_id,catalog_variant_id,technical_description,technical_data_key,repair_operation_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(order,labor.lastInsertRowid,data.template_key||'',data.title||data.name,data.variant||'',json(data.pre||[]),json(data.steps||[]),json(data.qc||[]),json(data.recommendations||[]),json(data.safety||[]),json(selectedParts),json((data.materials||[]).filter(item=>item.selected!==false)),json(data.technical||[]),json(progress),data.catalog_work_id||null,data.catalog_variant_id||null,data.technicalDescription||'',data.technicalDataKey||null,operationId)
    db.prepare('UPDATE order_repair_operations SET order_item_id=?,procedure_run_id=? WHERE id=?').run(labor.lastInsertRowid,procedure.lastInsertRowid,operationId)
    const insertQc=db.prepare(`INSERT OR IGNORE INTO order_qc(order_id,check_key,label,checked,note,repair_operation_id) VALUES (?,?,?,?,?,?)`)
    for(let i=0;i<(data.qc||[]).length;i++)insertQc.run(order,`repair:${operationId}:qc:${i}`,String(data.qc[i]),0,'',operationId)
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(order,'SMART_JOB_CREATED','Dodano Smart Job',`${data.title||data.name} · ${selectedParts.length} sugestii części · ${hours.toFixed(1)} h`)
    return{operationId,procedureId:Number(procedure.lastInsertRowid),orderItemId:Number(labor.lastInsertRowid),partIds,existing:false}
  })()
}

function listRepairParts(db,operationId){
  return db.prepare(`SELECT rp.*,ip.stock,ip.location,ip.brand,
    CASE WHEN rp.inventory_part_id IS NULL THEN NULL ELSE ip.stock-COALESCE((SELECT SUM(p.reserved_qty) FROM repair_parts p WHERE p.inventory_part_id=rp.inventory_part_id),0) END available_stock
    FROM repair_parts rp LEFT JOIN inventory_parts ip ON ip.id=rp.inventory_part_id WHERE rp.repair_operation_id=? ORDER BY rp.id`).all(Number(operationId))
}

function reserveInventoryPart(db,{operationId,inventoryPartId,qty,eventKey}){
  const amount=integer(qty),key=String(eventKey||'').trim()
  if(!key)throw new Error('Brakuje klucza zdarzenia rezerwacji.')
  return db.transaction(()=>{
    const operation=assertOperation(db,operationId),duplicate=db.prepare('SELECT * FROM repair_part_events WHERE event_key=?').get(key)
    if(duplicate)return{repairPartId:duplicate.repair_part_id,existing:true}
    const part=db.prepare('SELECT * FROM inventory_parts WHERE id=?').get(Number(inventoryPartId))
    if(!part)throw new Error('Część nie istnieje w magazynie.')
    const reserved=Number(db.prepare(`SELECT COALESCE(SUM(reserved_qty),0) qty FROM repair_parts WHERE inventory_part_id=?`).get(part.id).qty||0),available=Math.max(0,Math.floor(Number(part.stock)||0)-reserved)
    if(available<amount)throw new Error(`Dostępny stan: ${available} szt. Rezerwacja ${amount} szt. nie jest możliwa.`)
    const linked=db.prepare(`INSERT INTO repair_parts(repair_operation_id,order_id,inventory_part_id,name,part_no,source,qty,reserved_qty,unit_cost,unit_price,status,notes)
      VALUES (?,?,?,?,?,'INVENTORY',?,?,?,?,'RESERVED',?)`).run(operation.id,operation.order_id,part.id,part.name,part.part_no||'',amount,amount,Number(part.unit_cost)||0,Number(part.sell_price)||0,`Magazyn${part.location?` · ${part.location}`:''}`)
    db.prepare(`INSERT INTO repair_part_events(repair_part_id,event_key,event_type,qty) VALUES (?,?,?,?)`).run(linked.lastInsertRowid,key,'RESERVE',amount)
    return{repairPartId:Number(linked.lastInsertRowid),available:available-amount,physical:Number(part.stock)||0,existing:false}
  })()
}

function issueRepairPart(db,{repairPartId,qty,eventKey}){
  const amount=integer(qty),key=String(eventKey||'').trim()
  if(!key)throw new Error('Brakuje klucza zdarzenia wydania.')
  return db.transaction(()=>{
    const duplicate=db.prepare('SELECT * FROM repair_part_events WHERE event_key=?').get(key)
    if(duplicate)return{repairPartId:duplicate.repair_part_id,existing:true}
    const row=db.prepare('SELECT * FROM repair_parts WHERE id=?').get(Number(repairPartId))
    if(!row||!row.inventory_part_id)throw new Error('Ta pozycja nie jest częścią magazynową.')
    const remaining=Number(row.qty)-Number(row.issued_qty)+Number(row.returned_qty)
    if(amount>remaining)throw new Error(`Do wydania pozostało ${remaining} szt.`)
    const changed=db.prepare('UPDATE inventory_parts SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?').run(amount,row.inventory_part_id,amount)
    if(changed.changes!==1)throw new Error('Stan magazynowy zmienił się. Odśwież dane i spróbuj ponownie.')
    const reservedReleased=Math.min(amount,Number(row.reserved_qty)||0)
    let orderItemId=row.order_item_id
    if(orderItemId)db.prepare('UPDATE order_items SET qty=qty+? WHERE id=?').run(amount,orderItemId)
    else{
      const item=db.prepare(`INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,oe_number,notes,customer_description,inventory_part_id,repair_operation_id)
        VALUES (?,'CZESC',?,?,?,?,?,?,?,?,?,?)`).run(row.order_id,row.name,amount,row.unit_cost,row.unit_price,row.part_no||'',row.oe_number||'',`Wydano z magazynu do naprawy #${row.repair_operation_id}`,row.name,row.inventory_part_id,row.repair_operation_id)
      orderItemId=Number(item.lastInsertRowid)
    }
    db.prepare(`UPDATE repair_parts SET reserved_qty=reserved_qty-?,issued_qty=issued_qty+?,order_item_id=?,status='ISSUED',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(reservedReleased,amount,orderItemId,row.id)
    db.prepare(`INSERT INTO repair_part_events(repair_part_id,event_key,event_type,qty) VALUES (?,?,?,?)`).run(row.id,key,'ISSUE',amount)
    return{repairPartId:row.id,orderItemId,issued:amount,existing:false}
  })()
}

function returnRepairPart(db,{repairPartId,qty,eventKey}){
  const amount=integer(qty),key=String(eventKey||'').trim()
  if(!key)throw new Error('Brakuje klucza zdarzenia zwrotu.')
  return db.transaction(()=>{
    const duplicate=db.prepare('SELECT * FROM repair_part_events WHERE event_key=?').get(key)
    if(duplicate)return{repairPartId:duplicate.repair_part_id,existing:true}
    const row=db.prepare('SELECT * FROM repair_parts WHERE id=?').get(Number(repairPartId))
    if(!row||!row.inventory_part_id)throw new Error('Ta pozycja nie jest częścią magazynową.')
    const returnable=Number(row.issued_qty)-Number(row.returned_qty)-Number(row.installed_qty)
    if(amount>returnable)throw new Error(`Do zwrotu pozostało ${returnable} szt.`)
    db.prepare('UPDATE inventory_parts SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(amount,row.inventory_part_id)
    if(row.order_item_id){
      const item=db.prepare('SELECT qty FROM order_items WHERE id=?').get(row.order_item_id)
      if(item&&Number(item.qty)<=amount)db.prepare('DELETE FROM order_items WHERE id=?').run(row.order_item_id)
      else if(item)db.prepare('UPDATE order_items SET qty=qty-? WHERE id=?').run(amount,row.order_item_id)
    }
    db.prepare(`UPDATE repair_parts SET returned_qty=returned_qty+?,status=CASE WHEN returned_qty+?>=issued_qty THEN 'RETURNED' ELSE status END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(amount,amount,row.id)
    db.prepare(`INSERT INTO repair_part_events(repair_part_id,event_key,event_type,qty) VALUES (?,?,?,?)`).run(row.id,key,'RETURN',amount)
    return{repairPartId:row.id,returned:amount,existing:false}
  })()
}

function cancelRepairPartReservation(db,{repairPartId,qty,eventKey}){
  const amount=integer(qty),key=String(eventKey||'').trim()
  if(!key)throw new Error('Brakuje klucza zdarzenia anulowania rezerwacji.')
  return db.transaction(()=>{
    const duplicate=db.prepare('SELECT * FROM repair_part_events WHERE event_key=?').get(key)
    if(duplicate)return{repairPartId:duplicate.repair_part_id,existing:true}
    const row=db.prepare('SELECT * FROM repair_parts WHERE id=?').get(Number(repairPartId))
    if(!row||!row.inventory_part_id)throw new Error('Ta pozycja nie jest częścią magazynową.')
    const reserved=Math.max(0,Number(row.reserved_qty)||0)
    if(amount>reserved)throw new Error(`Do anulowania pozostało ${reserved} szt.`)
    const remaining=reserved-amount,status=remaining>0?'RESERVED':Number(row.issued_qty)>Number(row.returned_qty)?'ISSUED':'CANCELLED'
    db.prepare('UPDATE repair_parts SET reserved_qty=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(remaining,status,row.id)
    if(row.job_part_order_id)db.prepare("UPDATE job_part_orders SET status=CASE WHEN ?=0 THEN 'ANULOWANE' ELSE status END WHERE id=?").run(remaining,row.job_part_order_id)
    db.prepare('INSERT INTO repair_part_events(repair_part_id,event_key,event_type,qty) VALUES (?,?,?,?)').run(row.id,key,'CANCEL_RESERVATION',amount)
    return{repairPartId:row.id,cancelled:amount,reserved:remaining,existing:false}
  })()
}

function installRepairPart(db,{repairPartId,qty,eventKey}){
  const amount=integer(qty),key=String(eventKey||'').trim()
  if(!key)throw new Error('Brakuje klucza zdarzenia montażu.')
  return db.transaction(()=>{
    const duplicate=db.prepare('SELECT * FROM repair_part_events WHERE event_key=?').get(key)
    if(duplicate)return{repairPartId:duplicate.repair_part_id,existing:true}
    const row=db.prepare('SELECT * FROM repair_parts WHERE id=?').get(Number(repairPartId))
    if(!row)throw new Error('Powiązanie części z naprawą nie istnieje.')
    const installable=Math.max(0,Number(row.issued_qty)-Number(row.returned_qty)-Number(row.installed_qty))
    if(amount>installable)throw new Error(`Do oznaczenia jako zamontowane pozostało ${installable} szt.`)
    const installed=Number(row.installed_qty)+amount,remaining=installable-amount,status=remaining>0?'ISSUED':'INSTALLED'
    db.prepare('UPDATE repair_parts SET installed_qty=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(installed,status,row.id)
    if(row.job_part_order_id)db.prepare("UPDATE job_part_orders SET status='ZAMONTOWANA' WHERE id=?").run(row.job_part_order_id)
    db.prepare('INSERT INTO repair_part_events(repair_part_id,event_key,event_type,qty) VALUES (?,?,?,?)').run(row.id,key,'INSTALL',amount)
    return{repairPartId:row.id,installed:amount,totalInstalled:installed,existing:false}
  })()
}

function updateRepairOperation(db,{operationId,data={}}){
  const operation=assertOperation(db,operationId),number=(value,fallback,min=0,max=Number.MAX_SAFE_INTEGER)=>{
    if(value===undefined)return fallback
    const parsed=Number(value)
    if(!Number.isFinite(parsed)||parsed<min||parsed>max)throw new Error('Nieprawidłowa wartość kosztorysu naprawy.')
    return parsed
  }
  const next={
    planned_hours:number(data.planned_hours,operation.planned_hours),
    labor_rate:number(data.labor_rate,operation.labor_rate),
    labor_cost_rate:number(data.labor_cost_rate,operation.labor_cost_rate),
    discount_percent:number(data.discount_percent,operation.discount_percent,0,100),
    vat_rate:number(data.vat_rate,operation.vat_rate,0,100),
    other_cost:number(data.other_cost,operation.other_cost),
    other_price:number(data.other_price,operation.other_price)
  }
  return db.transaction(()=>{
    db.prepare(`UPDATE order_repair_operations SET planned_hours=?,labor_rate=?,labor_cost_rate=?,discount_percent=?,vat_rate=?,other_cost=?,other_price=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(next.planned_hours,next.labor_rate,next.labor_cost_rate,next.discount_percent,next.vat_rate,next.other_cost,next.other_price,operation.id)
    if(operation.order_item_id)db.prepare('UPDATE order_items SET qty=?,unit_cost=?,unit_price=?,hours_snapshot=?,price_snapshot=? WHERE id=?').run(next.planned_hours,next.labor_cost_rate,next.labor_rate,next.planned_hours,money(next.planned_hours*next.labor_rate),operation.order_item_id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(operation.order_id,'REPAIR_ESTIMATE_UPDATED','Zmieniono kosztorys naprawy',`${operation.title} · ${next.planned_hours.toFixed(2)} h · ${money(next.labor_rate)} zł/h · VAT ${next.vat_rate}%`)
    return{operationId:operation.id,estimate:calculateRepairEstimate(db,operation.id)}
  })()
}

function calculateRepairEstimate(db,operationId){
  const operation=assertOperation(db,operationId),parts=db.prepare('SELECT * FROM repair_parts WHERE repair_operation_id=?').all(operation.id)
  const laborNet=money(operation.planned_hours*operation.labor_rate),laborCost=money(operation.planned_hours*operation.labor_cost_rate)
  const partsCost=money(parts.reduce((sum,row)=>sum+Number(row.qty)*Number(row.unit_cost),0)),partsSale=money(parts.reduce((sum,row)=>sum+Number(row.qty)*Number(row.unit_price),0))
  const beforeDiscount=money(laborNet+partsSale+Number(operation.other_price||0)),discount=money(beforeDiscount*percent(operation.discount_percent)/100),net=money(beforeDiscount-discount),vat=money(net*Number(operation.vat_rate||0)/100),gross=money(net+vat)
  const cost=money(laborCost+partsCost+Number(operation.other_cost||0)),margin=money(net-cost),marginPercent=net?money(margin/net*100):0,markupPercent=cost?money(margin/cost*100):0
  return{repairOperationId:operation.id,laborNet,laborCost,partsCost,partsSale,otherCost:money(operation.other_cost),otherPrice:money(operation.other_price),discount,discountPercent:percent(operation.discount_percent),net,vat,vatRate:Number(operation.vat_rate||0),gross,cost,margin,marginPercent,markupPercent}
}

function orderEstimate(db,orderId){
  const operations=db.prepare('SELECT id FROM order_repair_operations WHERE order_id=? ORDER BY id').all(Number(orderId)).map(row=>calculateRepairEstimate(db,row.id))
  const totals=operations.reduce((sum,row)=>{for(const key of ['laborNet','laborCost','partsCost','partsSale','otherCost','otherPrice','discount','net','vat','gross','cost','margin'])sum[key]=money((sum[key]||0)+row[key]);return sum},{})
  totals.marginPercent=totals.net?money(totals.margin/totals.net*100):0;totals.markupPercent=totals.cost?money(totals.margin/totals.cost*100):0
  return{orderId:Number(orderId),operations,totals}
}

function snapshotEstimate(db,{orderId,quoteId=null,status='SENT'}){
  return db.transaction(()=>{
    const estimate=orderEstimate(db,orderId),version=Number(db.prepare('SELECT COALESCE(MAX(version),0)+1 version FROM repair_estimate_snapshots WHERE order_id=?').get(Number(orderId)).version)
    const snap=db.prepare('INSERT INTO repair_estimate_snapshots(order_id,quote_id,version,status,totals_json) VALUES (?,?,?,?,?)').run(Number(orderId),quoteId||null,version,status,json(estimate.totals))
    const insert=db.prepare('INSERT INTO repair_estimate_snapshot_items(snapshot_id,repair_operation_id,snapshot_json) VALUES (?,?,?)')
    for(const item of estimate.operations)insert.run(snap.lastInsertRowid,item.repairOperationId,json(item))
    return{id:Number(snap.lastInsertRowid),version,...estimate}
  })()
}

function createDviInspection(db,{orderId,author=''}){
  const order=db.prepare('SELECT id,vehicle_id FROM orders WHERE id=?').get(Number(orderId));if(!order)throw new Error('Zlecenie nie istnieje.')
  const result=db.prepare('INSERT INTO dvi_inspections(order_id,vehicle_id,author) VALUES (?,?,?)').run(order.id,order.vehicle_id,String(author||''))
  return{id:Number(result.lastInsertRowid)}
}
function addDviItem(db,{inspectionId,data}){
  const status=String(data.status||'OBSERVATION').toUpperCase();if(!['OK','OBSERVATION','REPAIR'].includes(status))throw new Error('Nieprawidłowy status pozycji DVI.')
  const result=db.prepare(`INSERT INTO dvi_items(inspection_id,area,description,status,author,proposed_catalog_work_id,proposed_catalog_variant_id,proposed_amount) VALUES (?,?,?,?,?,?,?,?)`).run(Number(inspectionId),String(data.area||'Ogólne'),String(data.description||''),status,String(data.author||''),data.catalog_work_id||null,data.catalog_variant_id||null,Math.max(0,Number(data.amount)||0))
  return{id:Number(result.lastInsertRowid)}
}
function listDvi(db,orderId){
  return db.prepare('SELECT * FROM dvi_inspections WHERE order_id=? ORDER BY id DESC').all(Number(orderId)).map(inspection=>({...inspection,items:db.prepare(`SELECT i.*,(SELECT COUNT(*) FROM dvi_media m WHERE m.dvi_item_id=i.id) media_count FROM dvi_items i WHERE inspection_id=? ORDER BY id`).all(inspection.id)}))
}
function decideDviItem(db,{itemId,decision,decidedBy=''}){
  const value=String(decision||'').toUpperCase();if(!['APPROVED','DECLINED'].includes(value))throw new Error('Nieprawidłowa decyzja DVI.')
  return db.transaction(()=>{
    const item=db.prepare('SELECT * FROM dvi_items WHERE id=?').get(Number(itemId));if(!item)throw new Error('Pozycja DVI nie istnieje.')
    const version=Number(db.prepare('SELECT COALESCE(MAX(version),0)+1 version FROM dvi_decisions WHERE dvi_item_id=?').get(item.id).version)
    db.prepare('INSERT INTO dvi_decisions(dvi_item_id,decision,amount_snapshot,version,decided_by) VALUES (?,?,?,?,?)').run(item.id,value,item.proposed_amount,version,String(decidedBy||''))
    db.prepare('UPDATE dvi_items SET decision=?,decision_at=CURRENT_TIMESTAMP WHERE id=?').run(value,item.id)
    return{itemId:item.id,decision:value,version,amountSnapshot:item.proposed_amount}
  })()
}

function createDviToken(db,{inspectionId,ttlHours=72}){
  const token=crypto.randomBytes(24).toString('hex'),hash=crypto.createHash('sha256').update(token).digest('hex'),hours=Math.min(720,Math.max(1,Number(ttlHours)||72)),expiresAt=new Date(Date.now()+hours*3600000).toISOString()
  db.prepare('INSERT INTO dvi_access_tokens(inspection_id,token_hash,expires_at) VALUES (?,?,?)').run(Number(inspectionId),hash,expiresAt)
  return{token,expiresAt}
}

function convertDviItemToRepair(db,{itemId,data={}}){
  const item=db.prepare(`SELECT i.*,d.order_id FROM dvi_items i JOIN dvi_inspections d ON d.id=i.inspection_id WHERE i.id=?`).get(Number(itemId))
  if(!item)throw new Error('Pozycja DVI nie istnieje.')
  if(item.repair_operation_id)return{operationId:Number(item.repair_operation_id),existing:true}
  if(item.decision!=='APPROVED')throw new Error('Naprawę można utworzyć dopiero po akceptacji tej pozycji DVI.')
  const title=String(data.title||item.description||item.area||'Naprawa z inspekcji DVI').trim()
  const result=createSmartJob(db,{orderId:item.order_id,idempotencyKey:`dvi-item:${item.id}`,data:{
    name:title,title,variant:String(data.variant||'DVI'),scope:String(data.scope||item.description||''),
    technicalDescription:`Źródło: DVI #${item.id} · ${item.area||'Ogólne'}`,
    catalog_work_id:item.proposed_catalog_work_id||null,catalog_variant_id:item.proposed_catalog_variant_id||null,
    hours:Math.max(0.01,Number(data.hours)||1),rate:Math.max(0,Number(data.rate ?? item.proposed_amount)||0),
    labor_cost_rate:Math.max(0,Number(data.labor_cost_rate)||0),vat_rate:Number.isFinite(Number(data.vat_rate))?Number(data.vat_rate):23,
    parts:Array.isArray(data.parts)?data.parts:[],pre:[],steps:[],qc:['Zweryfikuj usunięcie usterki wskazanej w DVI'],recommendations:[],safety:[],materials:[],technical:[]
  }})
  const operationId=Number(result.operationId||result.id)
  db.prepare('UPDATE dvi_items SET repair_operation_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(operationId,item.id)
  return{operationId,existing:Boolean(result.existing)}
}

module.exports={money,listRepairOperations,createSmartJob,listRepairParts,reserveInventoryPart,issueRepairPart,returnRepairPart,cancelRepairPartReservation,installRepairPart,updateRepairOperation,calculateRepairEstimate,orderEstimate,snapshotEstimate,createDviInspection,addDviItem,listDvi,decideDviItem,convertDviItemToRepair,createDviToken}
