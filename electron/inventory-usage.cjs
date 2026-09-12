function number(value){
  const parsed=Number(value)
  return Number.isFinite(parsed)?parsed:0
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
    const order=db.prepare('SELECT id,status,archived_at FROM orders WHERE id=?').get(targetOrderId)
    if(!order)throw new Error('Zlecenie nie istnieje.')
    if(order.archived_at||order.status==='WYDANE')throw new Error('Nie można wydać części do zamkniętego zlecenia.')
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
    let restored=0
    if(row.inventory_part_id){
      const changed=db.prepare('UPDATE inventory_parts SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(number(row.qty),row.inventory_part_id)
      if(changed.changes===1)restored=number(row.qty)
    }
    db.prepare('DELETE FROM order_items WHERE id=?').run(itemId)
    syncOrderTotals(db,row.order_id)
    db.prepare(`INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)`).run(
      row.order_id,'ORDER_ITEM_REMOVED',restored?'Usunięto pozycję i zwrócono część na magazyn':'Usunięto pozycję zlecenia',
      `${row.name} · ${number(row.qty).toLocaleString('pl-PL')} szt.`
    )
    return{removed:true,orderId:row.order_id,restored,inventoryPartId:row.inventory_part_id||null}
  })()
}

module.exports={issueInventoryPart,removeOrderItem,syncOrderTotals}
