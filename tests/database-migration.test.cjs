const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {migrateSchemaV9,migrateSchemaV10,migrateSchemaV12,migrateSchemaV13}=require('../electron/db.cjs')

test('schema v9 preserves ordered parts and adds scanned catalog fields',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE job_part_orders (
  id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, supplier_id INTEGER,
  supplier_name TEXT, part_no TEXT, oe_number TEXT, inventory_part_id INTEGER,
  vehicle_snapshot TEXT, name TEXT NOT NULL, qty REAL, unit_cost REAL,
  unit_price REAL, status TEXT, notes TEXT
 ); INSERT INTO job_part_orders(id,order_id,part_no,oe_number,name,qty,status,notes)
 VALUES(4,9,'OLD-123','OE-456','Część sprzed aktualizacji',2,'ZAMOWIONE','Zachowaj mnie');`)

 migrateSchemaV9(db)
 migrateSchemaV9(db)

 const columns=db.prepare('PRAGMA table_info(job_part_orders)').all().map(row=>row.name)
 for(const column of ['barcode','brand','vehicle_fitment','cross_numbers','lookup_source','lookup_url'])assert.ok(columns.includes(column),column)
 const row=db.prepare('SELECT * FROM job_part_orders WHERE id=4').get()
 assert.equal(row.name,'Część sprzed aktualizacji')
 assert.equal(row.part_no,'OLD-123')
 assert.equal(row.oe_number,'OE-456')
 assert.equal(row.status,'ZAMOWIONE')
 assert.equal(row.notes,'Zachowaj mnie')
 assert.equal(row.barcode,null)
 db.close()
})

test('schema v10 adds an auditable final price without changing existing orders',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,title TEXT); INSERT INTO orders VALUES(7,'Naprawa');`)
 migrateSchemaV10(db)
 migrateSchemaV10(db)
 const columns=db.prepare('PRAGMA table_info(orders)').all().map(row=>row.name)
 assert.deepEqual(columns.slice(-3),['final_price','final_price_note','final_price_updated_at'])
 const row=db.prepare('SELECT * FROM orders WHERE id=7').get()
 assert.equal(row.title,'Naprawa')
 assert.equal(row.final_price,null)
 db.close()
})

test('schema v12 adds immutable remote approval evidence and stable vehicle archive mapping',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE vehicles(id INTEGER PRIMARY KEY,vin TEXT);CREATE TABLE approvals(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT,amount REAL,scope TEXT);INSERT INTO approvals VALUES(4,9,'APPROVED',1200,'Wycena #3');`)
 migrateSchemaV12(db);migrateSchemaV12(db)
 const columns=db.prepare('PRAGMA table_info(approvals)').all().map(row=>row.name)
 for(const column of ['remote_id','snapshot_json','snapshot_hash','signature_storage_path','signature_hash','pdf_storage_path','pdf_hash','local_pdf_path','approval_sequence','previously_approved_total'])assert.ok(columns.includes(column),column)
 assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='approval_archive_vehicles'").get())
 assert.equal(db.prepare('SELECT status,amount FROM approvals WHERE id=4').get().amount,1200)
 db.close()
})

test('schema v13 preserves complete part identity in quote items',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE quote_items(id INTEGER PRIMARY KEY,quote_id INTEGER,kind TEXT,name TEXT,qty REAL,unit_price REAL);INSERT INTO quote_items VALUES(2,7,'CZESC','Czujnik',1,280);`)
 migrateSchemaV13(db);migrateSchemaV13(db)
 const columns=db.prepare('PRAGMA table_info(quote_items)').all().map(row=>row.name)
 for(const column of ['part_no','oe_number','inventory_part_id','supplier_name','barcode','brand','vehicle_fitment','cross_numbers','lookup_source','lookup_url'])assert.ok(columns.includes(column),column)
 const row=db.prepare('SELECT * FROM quote_items WHERE id=2').get()
 assert.equal(row.name,'Czujnik')
 assert.equal(row.part_no,null)
 db.close()
})
