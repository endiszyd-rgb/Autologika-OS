const RELATED=new Set(['order_items','job_part_orders','work_procedure_runs','order_qc'])
const column=(db,table,name)=>db.prepare(`PRAGMA table_info(${table})`).all().some(row=>row.name===name)
function payloadRepairLink(db,table,row,payload){
 if(RELATED.has(table)&&column(db,table,'repair_operation_id')){
  payload.repair_operation_cloud_id=row.repair_operation_id?db.prepare('SELECT cloud_id FROM order_repair_operations WHERE id=?').get(row.repair_operation_id)?.cloud_id||null:null
  delete payload.repair_operation_id
 }
 return payload
}
function applyRepairLink(db,table,payload,data){
 if(RELATED.has(table)&&column(db,table,'repair_operation_id')&&'repair_operation_cloud_id' in payload)data.repair_operation_id=payload.repair_operation_cloud_id?db.prepare('SELECT id FROM order_repair_operations WHERE cloud_id=?').get(payload.repair_operation_cloud_id)?.id||null:null
 if(table==='attachments'){
  data.name=payload.name||payload.original_name||payload.file_name||'dokument'
  data.mime=payload.mime||payload.mime_type||'application/octet-stream'
  data.size_bytes=payload.size_bytes??payload.size??0
 }
 return data
}
function reconcileRepairLinks(db,records){
 // Labor/procedure/QC can arrive before their repair because the links form a cycle.
 for(const row of records){
  const table=row.entity_type,payload=row.payload||{}
  if(row.deleted_at||!RELATED.has(table)||!('repair_operation_cloud_id' in payload)||!column(db,table,'repair_operation_id'))continue
  const id=payload.repair_operation_cloud_id?db.prepare('SELECT id FROM order_repair_operations WHERE cloud_id=?').get(payload.repair_operation_cloud_id)?.id||null:null
  db.prepare(`UPDATE ${table} SET repair_operation_id=? WHERE cloud_id=?`).run(id,row.cloud_id)
 }
}
module.exports={payloadRepairLink,applyRepairLink,reconcileRepairLinks}
