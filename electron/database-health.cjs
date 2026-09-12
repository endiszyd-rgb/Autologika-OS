const fs=require('node:fs')
const path=require('node:path')

const CRITICAL_COLUMNS={
 orders:['wait_state','archived_at','cloud_id','updated_at'],
 vehicles:['customer_id','generation','engine_code','cloud_id'],
 inventory_parts:['barcode','vehicle_fitment','cross_numbers','cloud_id'],
 job_part_orders:['oe_number','inventory_part_id','vehicle_snapshot','supplier_name','cloud_id'],
 order_items:['oe_number','inventory_part_id','cloud_id'],
 attachments:['storage_path','size_bytes','sha256','category','cloud_id']
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
function databaseHealth(db,{dbPath,backupDir,schemaVersion}){
 const quick=db.pragma('quick_check').map(row=>Object.values(row)[0]),foreignKeys=db.pragma('foreign_key_check'),schema=criticalSchemaStatus(db)
 const version=Number(db.pragma('user_version',{simple:true})||0),database=fileInfo(dbPath),wal=fileInfo(`${dbPath}-wal`)
 const backups=fs.existsSync(backupDir)?fs.readdirSync(backupDir).filter(name=>name.endsWith('.db')).map(name=>({name,...fileInfo(path.join(backupDir,name))})).sort((a,b)=>String(b.modifiedAt).localeCompare(String(a.modifiedAt))).slice(0,12):[]
 const lastBackup=backups[0]||null,lastBackupAgeHours=lastBackup?.modifiedAt?Math.round((Date.now()-Date.parse(lastBackup.modifiedAt))/360000)/10:null
 const counts={}
 for(const table of ['customers','vehicles','orders','inventory_parts','job_part_orders','attachments'])try{counts[table]=Number(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE deleted_at IS NULL`).get().count||0)}catch{try{counts[table]=Number(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get().count||0)}catch{counts[table]=null}}
 const integrityOk=quick.length===1&&String(quick[0]).toLowerCase()==='ok',schemaOk=version===Number(schemaVersion)&&schema.ok
 const status=!integrityOk||foreignKeys.length||!schemaOk?'ERROR':!lastBackup||lastBackupAgeHours>48?'WARN':'OK'
 return {status,checkedAt:new Date().toISOString(),integrityOk,integrityDetails:quick.slice(0,10),foreignKeyErrors:foreignKeys.length,schemaOk,schemaVersion:version,expectedSchemaVersion:Number(schemaVersion),missingColumns:schema.missing,databaseBytes:database.bytes,walBytes:wal.bytes,lastBackup,lastBackupAgeHours,backupCount:backups.length,backups,counts}
}

module.exports={databaseHealth,criticalSchemaStatus,CRITICAL_COLUMNS}
