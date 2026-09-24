const { jobPartTechnicalDescription, syncOrderTotals } = require('./inventory-usage.cjs')

function ensureInstalledJobPart(db,part){
  if(!part?.id||!part.order_id)throw new Error('Nie znaleziono części przypisanej do zlecenia.')
  const marker=jobPartTechnicalDescription(part.cloud_id)
  let item=db.prepare('SELECT id FROM order_items WHERE order_id=? AND technical_description=? ORDER BY id DESC LIMIT 1').get(part.order_id,marker)
  if(!item){
    item=db.prepare("SELECT id FROM order_items WHERE order_id=? AND kind='CZESC' AND name=? AND ABS(qty-?)<0.0001 AND ABS(unit_cost-?)<0.0001 ORDER BY id DESC LIMIT 1").get(part.order_id,part.name,part.qty,part.unit_cost)
    if(item)db.prepare('UPDATE order_items SET technical_description=? WHERE id=?').run(marker,item.id)
  }
  if(item)return{created:false,itemId:Number(item.id),orderId:Number(part.order_id)}

  const supplier=(part.supplier_id?db.prepare('SELECT name FROM suppliers WHERE id=?').get(part.supplier_id)?.name:'')||part.supplier_name||''
  const notes=[part.external_order_no&&`Zamówienie ${part.external_order_no}`,part.brand&&`Producent: ${part.brand}`,part.barcode&&`EAN: ${part.barcode}`].filter(Boolean).join(' · ')
  const result=db.prepare("INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no,oe_number,supplier,notes,technical_description) VALUES (?,'CZESC',?,?,?,?,?,?,?,?,?)")
    .run(part.order_id,part.name,part.qty,part.unit_cost,part.unit_price,part.part_no||'',part.oe_number||'',supplier,notes,marker)
  syncOrderTotals(db,part.order_id)
  return{created:true,itemId:Number(result.lastInsertRowid),orderId:Number(part.order_id)}
}

module.exports={ensureInstalledJobPart}
