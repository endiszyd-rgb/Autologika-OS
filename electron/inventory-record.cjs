function deleteInventoryPart(db,id){
  const part=db.prepare('SELECT id,barcode,name,stock,cloud_id FROM inventory_parts WHERE id=?').get(Number(id))
  if(!part)return{removed:false}
  const linked={
    orderItems:db.prepare('SELECT COUNT(*) count FROM order_items WHERE inventory_part_id=?').get(part.id)?.count||0,
    jobParts:db.prepare('SELECT COUNT(*) count FROM job_part_orders WHERE inventory_part_id=?').get(part.id)?.count||0,
    purchases:db.prepare('SELECT COUNT(*) count FROM purchase_order_items WHERE inventory_part_id=?').get(part.id)?.count||0
  }
  const remove=db.transaction(()=>{
    db.prepare('UPDATE order_items SET inventory_part_id=NULL WHERE inventory_part_id=?').run(part.id)
    db.prepare('UPDATE job_part_orders SET inventory_part_id=NULL WHERE inventory_part_id=?').run(part.id)
    db.prepare('UPDATE purchase_order_items SET inventory_part_id=NULL WHERE inventory_part_id=?').run(part.id)
    if(part.barcode)db.prepare('DELETE FROM barcode_lookup_cache WHERE barcode=?').run(part.barcode)
    db.prepare('DELETE FROM inventory_parts WHERE id=?').run(part.id)
  })
  remove()
  return{removed:true,id:part.id,name:part.name,barcode:part.barcode||'',discardedStock:Number(part.stock||0),linked}
}

module.exports={deleteInventoryPart}
