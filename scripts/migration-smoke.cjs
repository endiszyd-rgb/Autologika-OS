const {app}=require('electron')
const path=require('node:path')
const os=require('node:os')
const fs=require('node:fs')

app.whenReady().then(()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-migration-'))
 app.setPath('userData',dir)
 const {getDb}=require('../electron/db.cjs')
 const db=getDb()
 const columns=table=>new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name))
 const required=['catalog_work_id','catalog_variant_id','work_name','variant_name','customer_description','hours_snapshot','price_snapshot']
 for(const table of ['order_items','quote_items'])for(const column of required)if(!columns(table).has(column))throw new Error(`${table}.${column} missing`)
 for(const table of ['work_procedure_runs','technical_data_entries','vehicle_findings','order_qc','work_templates','technical_manual_pages','technical_manual_hotspots','technical_manual_steps'])db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()
 console.log(JSON.stringify({ok:true,db:path.join(dir,'autologika.db'),snapshotColumns:required.length,extendedTables:8}))
 app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
