const fs=require('node:fs')
const path=require('node:path')

const CRITICAL_COLUMNS={
 orders:['vehicle_id','wait_state','archived_at','cloud_id','updated_at'],
 vehicles:['customer_id','generation','engine_code','cloud_id'],
 inventory_parts:['barcode','vehicle_fitment','cross_numbers','cloud_id'],
 job_part_orders:['oe_number','inventory_part_id','vehicle_snapshot','supplier_name','barcode','brand','vehicle_fitment','cross_numbers','cloud_id'],
 order_items:['order_id','oe_number','inventory_part_id','repair_operation_id','cloud_id'],
 attachments:['storage_path','size_bytes','sha256','category','dvi_item_id','cloud_id'],
 order_repair_operations:['order_id','idempotency_key','order_item_id','title','status','planned_hours','cloud_id'],
 repair_parts:['repair_operation_id','order_id','inventory_part_id','order_item_id','qty','status','cloud_id'],
 dvi_inspections:['order_id','vehicle_id','status','cloud_id'],
 dvi_items:['inspection_id','repair_operation_id','status','decision','cloud_id'],
 work_resources:['resource_type','name','capacity','active','cloud_id'],
 appointment_resources:['appointment_id','resource_id','cloud_id'],
 delivery_document_imports:['document_no','gross_total','items_json','storage_path','cloud_id']
}

function criticalSchemaStatus(db){
 const missing=[]
 for(const [table,required] of Object.entries(CRITICAL_COLUMNS)){
  let columns=[]
  try{columns=db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name)}catch{missing.push(`${table}.*`);continue}
  for(const column of required)if(!columns.includes(column))missing.push(`${table}.${column}`)
 }
 return {ok:missing.length===0,missing}
}

function fileInfo(file){try{const stat=fs.statSync(file);return{bytes:stat.size,modifiedAt:stat.mtime.toISOString()}}catch{return{bytes:0,modifiedAt:''}}}
function relationshipStatus(db){
 const checks=[
  ['Część naprawy wskazuje inne zlecenie niż naprawa',`SELECT COUNT(*) count FROM repair_parts part JOIN order_repair_operations repair ON repair.id=part.repair_operation_id WHERE part.order_id!=repair.order_id`],
  ['Naprawa wskazuje pozycję z innego zlecenia',`SELECT COUNT(*) count FROM order_repair_operations repair JOIN order_items item ON item.id=repair.order_item_id WHERE repair.order_item_id IS NOT NULL AND item.order_id!=repair.order_id`],
  ['Część naprawy wskazuje pozycję z innego zlecenia',`SELECT COUNT(*) count FROM repair_parts part JOIN order_items item ON item.id=part.order_item_id WHERE part.order_item_id IS NOT NULL AND item.order_id!=part.order_id`],
  ['Inspekcja DVI wskazuje pojazd inny niż zlecenie',`SELECT COUNT(*) count FROM dvi_inspections inspection JOIN orders job ON job.id=inspection.order_id WHERE inspection.vehicle_id!=job.vehicle_id`]
 ]
 const issues=[]
 for(const [label,sql] of checks)try{const count=Number(db.prepare(sql).get()?.count||0);if(count)issues.push({label,count})}catch(error){issues.push({label:`Nie można sprawdzić: ${label}`,count:1,error:String(error.message||error)})}
 return {ok:issues.length===0,count:issues.reduce((sum,item)=>sum+item.count,0),issues}
}
function databaseHealth(db,{dbPath,backupDir,schemaVersion}){
 const quick=db.pragma('quick_check').map(row=>Object.values(row)[0]),foreignKeys=db.pragma('foreign_key_check'),schema=criticalSchemaStatus(db),relations=relationshipStatus(db)
 const version=Number(db.pragma('user_version',{simple:true})||0),database=fileInfo(dbPath),wal=fileInfo(`${dbPath}-wal`)
 const backups=fs.existsSync(backupDir)?fs.readdirSync(backupDir).filter(name=>name.endsWith('.db')).map(name=>({name,...fileInfo(path.join(backupDir,name))})).sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt))).slice(0,12):[]
 const lastBackup=backups[0]||null,lastBackupAgeHours=lastBackup?.modifiedAt?Math.round((Date.now()-Date.parse(lastBackup.modifiedAt))/360000)/10:null
 const counts={}
 for(const table of ['customers','vehicles','orders','inventory_parts','job_part_orders','order_repair_operations','repair_parts','dvi_inspections','delivery_document_imports','attachments'])try{counts[table]=Number(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE deleted_at IS NULL`).get().count||0)}catch{try{counts[table]=Number(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count||0)}catch{counts[table]=null}}
 const integrityOk=quick.length===1&&String(quick[0]).toLowerCase()==='ok',schemaOk=version===Number(schemaVersion)&&schema.ok
 const status=!integrityOk||foreignKeys.length||!schemaOk||!relations.ok?'ERROR':!lastBackup||lastBackupAgeHours>48?'WARN':'OK'
 return {status,checkedAt:new Date().toISOString(),integrityOk,integrityDetails:quick.slice(0,10),foreignKeyErrors:foreignKeys.length,relationshipErrors:relations.count,relationshipIssues:relations.issues,schemaOk,schemaVersion:version,expectedSchemaVersion:Number(schemaVersion),missingColumns:schema.missing,databaseBytes:database.bytes,walBytes:wal.bytes,lastBackup,lastBackupAgeHours,backupCount:backups.length,backups,counts}
}

module.exports={databaseHealth,criticalSchemaStatus,relationshipStatus,CRITICAL_COLUMNS}
