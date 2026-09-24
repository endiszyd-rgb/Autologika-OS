function number(value){
  const parsed=Number(value)
  return Number.isFinite(parsed)?parsed:0
}

const JOB_PART_LINK_PREFIX='AUTOLOGIKA_JOB_PART:'
function jobPartTechnicalDescription(cloudId){
  const value=String(cloudId||'').trim()
  if(!value)throw new Error('Część zamówienia nie ma identyfikatora synchronizacji.')
  return `${JOB_PART_LINK_PREFIX}${value}`
}
function linkedJobPartCloudId(value){
  const match=String(value||'').match(/^AUTOLOGIKA_JOB_PART:([a-zA-Z0-9-]+)$/)
  return match?match[1]:null
}

function requireEditableOrder(db,orderId){
  const id=Number(orderId)
  if(!Number.isInteger(id)||id<=0)throw new Error('Nie wybrano zlecenia.')
  const order=db.prepare('SELECT id,status,archived_at FROM orders WHERE id=?').get(id)
  if(!order)throw new Error('Zlecenie nie istnieje.')
  if(order.archived_at||order.status==='WYDANE')throw new Error('Zlecenie jest zamknięte. Najpierw przywróć je do aktywnych, aby zmienić zakres lub rozliczenie.')
  return order
}

function syncOrderTotals(db,orderId){
  const sums=db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN kind='CZESC' THEN qty*unit_cost ELSE 0 END),0) parts_cost,
    COALESCE(SUM(CASE WHEN kind='CZESC' THEN qty*unit_price ELSE 0 END),0) parts_sale,
    COALESCE(SUM(CASE WHEN kind!='CZESC' THEN qty*unit_cost ELSE 0 END),0) other_cost,
    COALESCE(SUM(CASE WHEN kind!='CZESC' THEN qty*unit_price ELSE 0 END),0) other_sale
    FROM order_items WHERE order_id=?`).get(orderId)
  db.prepare('UPDATE orders SET parts_cost=?,parts_sale=?,other_cost=?,other_sale=? WHERE id=?')
    .run(sums.parts_cost,sums.parts_sale,sums.other_cost,sums.other_sale,orderId)
}

function issueInventoryPart(db,{inventoryPartId,orderId,qty,oeNumber=''}){
  const partId=Number(inventoryPartId),targetOrderId=Number(orderId),amount=number(qty)
  const oe=String(oeNumber||'').trim()
  if(!Number.isInteger(partId)||partId<=0)throw new Error('Nie wybrano części z magazynu.')
  if(!Number.isInteger(targetOrderId)||targetOrderId<=0)throw new Error('Nie wybrano zlecenia.')
  if(amount<=0)throw new Error('Ilość wydawanej części musi być większa od zera.')

  return db.transaction(()=>{
    const part=db.prepare(`SELECT p.*,s.name supplier FROM inventory_parts p LEFT JOIN suppliers s ON s.id=p.supplier_id WHERE p.id=?`).get(partId)
    if(!part)throw new Error('Część nie istnieje w magazynie.')
    requireEditableOrder(db,targetOrderId)
    if(number(part.stock)+1e-9<amount)throw new Error(`Za mało części na stanie. Dostępne: ${number(part.stock).toLocaleString('pl-PL')}.`)

    const changed=db.prepare('UPDATE inventory_parts SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?').run(amount,partId,amount)
    if(changed.changes!==1)throw new Error('Stan magazynowy zmienił się w trakcie operacji. Spróbuj ponownie.')
    const result=db.prepare(`INSERT INTO order_items(
      order_id,kind,name,qty,unit_cost,unit_price,part_no,oe_number,supplier,notes,customer_description,inventory_part_id
    ) VALUES (?,'CZESC',?,?,?,?,?,?,?,?,?,?)`).run(
      targetOrderId,part.name,amount,number(part.unit_cost),number(part.sell_price),part.part_no||'',oe,part.supplier||'',
      `Wydano z magazynu${part.location?` · ${part.location}`:''}`,
      `${part.name}${part.part_no?` (${part.part_no})`:''}`,
      partId
    )
    syncOrderTotals(db,targetOrderId)
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(
      targetOrderId,'INVENTORY_ISSUE','Część wydana z magazynu',`${part.name} · ${amount.toLocaleString('pl-PL')} szt.`
    )
    return{id:Number(result.lastInsertRowid),orderId:targetOrderId,inventoryPartId:partId,qty:amount,remaining:number(part.stock)-amount}
  })()
}

function removeOrderItem(db,id){
  const itemId=Number(id)
  if(!Number.isInteger(itemId)||itemId<=0)return{removed:false,restored:0}
  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM order_items WHERE id=?').get(itemId)
    if(!row)return{removed:false,restored:0}
    requireEditableOrder(db,row.order_id)
    let restored=0
    if(row.inventory_part_id){
      const changed=db.prepare('UPDATE inventory_parts SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(number(row.qty),row.inventory_part_id)
      if(changed.changes===1)restored=number(row.qty)
    }
    const linkedCloudId=linkedJobPartCloudId(row.technical_description)
    if(linkedCloudId)db.prepare("UPDATE job_part_orders SET status='ODEBRANE',installed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE cloud_id=? AND order_id=?").run(linkedCloudId,row.order_id)
    db.prepare('DELETE FROM order_items WHERE id=?').run(itemId)
    syncOrderTotals(db,row.order_id)
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(
      row.order_id,'ORDER_ITEM_REMOVED',restored?'Usunięto pozycję i zwrócono część na magazyn':'Usunięto pozycję zlecenia',
      `${row.name} · ${number(row.qty).toLocaleString('pl-PL')} szt.`
    )
    return{removed:true,orderId:row.order_id,restored,inventoryPartId:row.inventory_part_id||null,linkedJobPartCloudId:linkedCloudId}
  })()
}

function updateOrderItem(db,id,input={}){
  const itemId=Number(id),qty=number(input.qty),unitCost=number(input.unit_cost),unitPrice=number(input.unit_price)
  if(!Number.isInteger(itemId)||itemId<=0)throw new Error('Nie wybrano pozycji zlecenia.')
  if(qty<=0)throw new Error('Ilość lub czas muszą być większe od zera.')
  if(unitCost<0||unitPrice<0)throw new Error('Cena nie może być ujemna.')
  const name=String(input.name||'').trim()
  if(!name)throw new Error('Nazwa pozycji jest wymagana.')

  return db.transaction(()=>{
    const row=db.prepare('SELECT * FROM order_items WHERE id=?').get(itemId)
    if(!row)throw new Error('Pozycja zlecenia już nie istnieje.')
    requireEditableOrder(db,row.order_id)

    if(row.inventory_part_id){
      const delta=qty-number(row.qty)
      if(delta>0){
        const changed=db.prepare('UPDATE inventory_parts SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?').run(delta,row.inventory_part_id,delta)
        if(changed.changes!==1)throw new Error('Za mało części w magazynie, aby zwiększyć ilość w zleceniu.')
      }else if(delta<0){
        db.prepare('UPDATE inventory_parts SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(-delta,row.inventory_part_id)
      }
    }

    const description=String(input.customer_description??input.notes??row.customer_description??row.notes??'').trim()
    const isLabor=row.kind==='ROBOCIZNA',hours=isLabor?qty:Number(row.hours_snapshot??qty),price=isLabor?Math.round(qty*unitPrice*100)/100:Number(row.price_snapshot??qty*unitPrice)
    db.prepare(`UPDATE order_items SET name=?,qty=?,unit_cost=?,unit_price=?,part_no=?,oe_number=?,supplier=?,notes=?,customer_description=?,hours_snapshot=?,price_snapshot=? WHERE id=?`)
      .run(name,qty,unitCost,unitPrice,String(input.part_no||'').trim(),String(input.oe_number||'').trim(),String(input.supplier||'').trim(),description,description,hours,price,itemId)
    const linkedCloudId=linkedJobPartCloudId(row.technical_description)
    if(linkedCloudId)db.prepare(`UPDATE job_part_orders SET name=?,qty=?,unit_cost=?,unit_price=?,part_no=?,oe_number=?,supplier_name=?,updated_at=CURRENT_TIMESTAMP WHERE cloud_id=? AND order_id=?`)
      .run(name,qty,unitCost,unitPrice,String(input.part_no||'').trim(),String(input.oe_number||'').trim(),String(input.supplier||'').trim(),linkedCloudId,row.order_id)
    syncOrderTotals(db,row.order_id)
    const before=`${row.name} · ${number(row.qty).toLocaleString('pl-PL')} × ${number(row.unit_price).toFixed(2)} zł`
    const after=`${name} · ${qty.toLocaleString('pl-PL')} × ${unitPrice.toFixed(2)} zł`
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(row.order_id,'ORDER_ITEM_UPDATED','Zmieniono pozycję zlecenia',`${before} → ${after}`)
    return{updated:true,orderId:row.order_id,inventoryPartId:row.inventory_part_id||null,stockDelta:row.inventory_part_id?number(row.qty)-qty:0,linkedJobPartCloudId:linkedCloudId}
  })()
}

function createOrderItem(db,orderId,input={}){
  const targetOrderId=Number(orderId),name=String(input.name||'').trim()
  const qty=number(input.qty),unitCost=number(input.unit_cost),unitPrice=number(input.unit_price)
  if(!name)throw new Error('Nazwa pozycji jest wymagana.')
  if(qty<=0)throw new Error('Ilość lub czas muszą być większe od zera.')
  if(unitCost<0||unitPrice<0)throw new Error('Cena nie może być ujemna.')
  const kind=String(input.kind||'CZESC').trim().toUpperCase()
  if(!['CZESC','MATERIAL','USLUGA_ZEW','ROBOCIZNA'].includes(kind))throw new Error('Nieprawidłowy typ pozycji zlecenia.')
  return db.transaction(()=>{
    requireEditableOrder(db,targetOrderId)
    const description=String(input.customer_description??input.notes??'').trim()
    const hours=input.hours_snapshot??qty,price=input.price_snapshot??(qty*unitPrice)
    const result=db.prepare(`INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,oe_number,supplier,notes,catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      targetOrderId,kind,name,qty,unitCost,unitPrice,String(input.part_no||'').trim(),String(input.oe_number||'').trim(),String(input.supplier||'').trim(),description,input.catalog_work_id||null,input.catalog_variant_id||null,input.work_name||null,input.variant_name||null,description,String(input.technical_description||''),number(hours),number(price)
    )
    syncOrderTotals(db,targetOrderId)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(targetOrderId,'ORDER_ITEM_ADDED','Dodano pozycję zlecenia',`${name} · ${qty.toLocaleString('pl-PL')} × ${unitPrice.toFixed(2)} zł`)
    return{id:Number(result.lastInsertRowid),orderId:targetOrderId}
  })()
}

function updateOrderItemDescription(db,id,description=''){
  const itemId=Number(id)
  if(!Number.isInteger(itemId)||itemId<=0)throw new Error('Nie wybrano pozycji zlecenia.')
  return db.transaction(()=>{
    const row=db.prepare('SELECT order_id,customer_description,notes FROM order_items WHERE id=?').get(itemId)
    if(!row)throw new Error('Pozycja zlecenia już nie istnieje.')
    requireEditableOrder(db,row.order_id)
    const value=String(description||'').trim()
    db.prepare('UPDATE order_items SET customer_description=?,notes=? WHERE id=?').run(value,value,itemId)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(row.order_id,'ORDER_ITEM_UPDATED','Zmieniono opis pozycji zlecenia',value||'Usunięto opis dla klienta')
    return true
  })()
}

module.exports={createOrderItem,issueInventoryPart,jobPartTechnicalDescription,linkedJobPartCloudId,removeOrderItem,requireEditableOrder,updateOrderItem,updateOrderItemDescription,syncOrderTotals}
