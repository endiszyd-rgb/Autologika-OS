const {app}=require('electron')
const path=require('node:path')
const os=require('node:os')
const fs=require('node:fs')

app.whenReady().then(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-migration-'))
 app.setPath('userData',dir)
 const Database=require('better-sqlite3')
 const legacy=new Database(path.join(dir,'autologika.db'))
 legacy.exec('CREATE TABLE legacy_marker(value TEXT); INSERT INTO legacy_marker(value) VALUES (\'DANE-ZACHOWANE\');')
 legacy.close()
 const {getDb,createVersionBackup,SCHEMA_VERSION,migrateSchemaV8}=require('../electron/db.cjs')
 const v7=new Database(':memory:')
 v7.exec(`
   CREATE TABLE order_items(id INTEGER PRIMARY KEY);
   CREATE TABLE suppliers(id INTEGER PRIMARY KEY,name TEXT);
   CREATE TABLE vehicles(id INTEGER PRIMARY KEY,plate TEXT,vin TEXT,make TEXT,model TEXT,generation TEXT,year INTEGER,engine TEXT,engine_code TEXT);
   CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER);
   CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,order_id INTEGER,supplier_id INTEGER);
   INSERT INTO suppliers VALUES(2,'Hurtownia testowa');
   INSERT INTO vehicles VALUES(3,'TEST 007','TESTVIN','Skoda','Octavia','III',2018,'2.0 TDI','CRMB');
   INSERT INTO orders VALUES(4,3);
   INSERT INTO job_part_orders VALUES(5,4,2);
   PRAGMA user_version=7;
 `)
 migrateSchemaV8(v7)
 const migratedV7=v7.prepare('SELECT * FROM job_part_orders WHERE id=5').get()
 if(migratedV7.supplier_name!=='Hurtownia testowa')throw new Error('v7 supplier snapshot not migrated')
 if(JSON.parse(migratedV7.vehicle_snapshot).engine_code!=='CRMB')throw new Error('v7 vehicle snapshot not migrated')
 if(!v7.prepare('PRAGMA table_info(order_items)').all().some(column=>column.name==='oe_number'))throw new Error('v7 order_items.oe_number not migrated')
 v7.close()
 const db=getDb()
 const columns=table=>new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name))
 const required=['catalog_work_id','catalog_variant_id','work_name','variant_name','customer_description','hours_snapshot','price_snapshot']
 for(const table of ['order_items','quote_items'])for(const column of required)if(!columns(table).has(column))throw new Error(`${table}.${column} missing`)
 if(!columns('order_items').has('inventory_part_id'))throw new Error('order_items.inventory_part_id missing')
 if(!columns('order_items').has('oe_number'))throw new Error('order_items.oe_number missing')
 for(const column of ['oe_number','inventory_part_id','vehicle_snapshot','supplier_name'])if(!columns('job_part_orders').has(column))throw new Error(`job_part_orders.${column} missing`)
 for(const table of ['work_procedure_runs','technical_data_entries','vehicle_findings','order_qc','work_templates','technical_manual_pages','technical_manual_hotspots','technical_manual_steps'])db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).get()
 const inventoryColumns=['barcode','brand','category','description','vehicle_fitment','cross_numbers','image_url','lookup_source','lookup_url','cloud_id','version']
 for(const column of inventoryColumns)if(!columns('inventory_parts').has(column))throw new Error(`inventory_parts.${column} missing`)
 if(db.pragma('user_version',{simple:true})!==SCHEMA_VERSION)throw new Error('schema version not saved')
 const customerColumn=db.prepare("PRAGMA table_info(vehicles)").all().find(column=>column.name==='customer_id')
 if(!customerColumn||customerColumn.notnull!==0)throw new Error('vehicles.customer_id is still required')
 const standalone=db.prepare("INSERT INTO vehicles(customer_id,plate,make) VALUES (NULL,'TEST 001','Test')").run()
 if(db.prepare('SELECT customer_id FROM vehicles WHERE id=?').get(standalone.lastInsertRowid).customer_id!==null)throw new Error('standalone vehicle not saved')
 const inventory=db.prepare("INSERT INTO inventory_parts(barcode,name,stock) VALUES ('4006381333931','Filtr testowy',1)").run()
 if(!db.prepare("SELECT 1 FROM sync_queue WHERE entity_type='inventory_parts' AND row_id=?").get(inventory.lastInsertRowid))throw new Error('inventory part not queued for cloud sync')
 if(db.prepare('SELECT value FROM legacy_marker').get().value!=='DANE-ZACHOWANE')throw new Error('legacy data lost')
 const migrationBackups=fs.readdirSync(path.join(dir,'backups')).filter(name=>name.includes('before-schema')&&name.endsWith('.db'))
 if(migrationBackups.length!==1)throw new Error(`expected one pre-migration backup, found ${migrationBackups.length}`)
 getDb()
 if(fs.readdirSync(path.join(dir,'backups')).filter(name=>name.includes('before-schema')&&name.endsWith('.db')).length!==1)throw new Error('migration repeated')
 const updateBackup=await createVersionBackup({currentVersion:'1.0.0',targetVersion:'1.0.1'})
 if(!fs.existsSync(updateBackup.file)||!fs.existsSync(updateBackup.manifestPath))throw new Error('update backup or manifest missing')
 console.log(JSON.stringify({ok:true,db:path.join(dir,'autologika.db'),schemaVersion:SCHEMA_VERSION,migrationBackup:migrationBackups[0],updateBackup:path.basename(updateBackup.file),snapshotColumns:required.length,extendedTables:8,inventoryColumns:inventoryColumns.length}))
 app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
