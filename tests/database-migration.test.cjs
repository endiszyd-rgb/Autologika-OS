const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {migrateSchemaV9,migrateSchemaV10,migrateSchemaV12,migrateSchemaV13,migrateSchemaV14,migrateSchemaV15,migrateSchemaV16}=require('../electron/db.cjs')

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

test('schema v14 links an imported quote snapshot to its order sources',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE quotes(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT);CREATE TABLE quote_items(id INTEGER PRIMARY KEY,quote_id INTEGER,name TEXT);INSERT INTO quotes VALUES(3,7,'ROBOCZA');INSERT INTO quote_items VALUES(4,3,'Filtr');`)
 migrateSchemaV14(db);migrateSchemaV14(db)
 const quoteColumns=db.prepare('PRAGMA table_info(quotes)').all().map(row=>row.name)
 const itemColumns=db.prepare('PRAGMA table_info(quote_items)').all().map(row=>row.name)
 for(const column of ['source_type','source_imported_at'])assert.ok(quoteColumns.includes(column),column)
 for(const column of ['source_order_item_id','source_job_part_id'])assert.ok(itemColumns.includes(column),column)
 assert.equal(db.prepare('SELECT source_type FROM quotes WHERE id=3').get().source_type,'LEGACY')
 assert.equal(db.prepare('SELECT name FROM quote_items WHERE id=4').get().name,'Filtr')
 db.close()
})

test('schema v15 adds delivery document identity to purchase orders',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE purchase_orders(id INTEGER PRIMARY KEY,status TEXT);INSERT INTO purchase_orders VALUES(1,'ODEBRANE');`)
 migrateSchemaV15(db);migrateSchemaV15(db)
 const columns=db.prepare('PRAGMA table_info(purchase_orders)').all().map(row=>row.name)
 for(const column of ['external_document_no','document_date','source_file','source_hash','gross_total'])assert.ok(columns.includes(column),column)
 db.prepare("UPDATE purchase_orders SET source_hash='hash-1' WHERE id=1").run()
 assert.throws(()=>db.exec("INSERT INTO purchase_orders(id,status,source_hash) VALUES(2,'ODEBRANE','hash-1')"),/UNIQUE/)
 db.close()
})

test('schema v16 converts fractional part counts into whole pieces and recalculates totals',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,stock REAL,min_stock REAL);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,parts_cost REAL,parts_sale REAL,other_cost REAL,other_sale REAL);
  CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,kind TEXT,qty REAL,unit_cost REAL,unit_price REAL,price_snapshot REAL);
  CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,qty REAL);
  CREATE TABLE purchase_order_items(id INTEGER PRIMARY KEY,qty REAL,received_qty REAL);
  CREATE TABLE quote_items(id INTEGER PRIMARY KEY,kind TEXT,qty REAL,unit_price REAL,price_snapshot REAL);
  INSERT INTO inventory_parts VALUES(1,1.97,0.6);
  INSERT INTO orders VALUES(3,0,0,0,0);
  INSERT INTO order_items VALUES(4,3,'CZESC',1.97,20,35,68.95),(5,3,'MATERIAL',0.5,10,18,9);
  INSERT INTO job_part_orders VALUES(6,2.4);
  INSERT INTO purchase_order_items VALUES(7,3.1,2.8);
  INSERT INTO quote_items VALUES(8,'CZESC',1.97,35,68.95);
 `)
 migrateSchemaV16(db);migrateSchemaV16(db)
 assert.deepEqual({...db.prepare('SELECT stock,min_stock FROM inventory_parts WHERE id=1').get()},{stock:2,min_stock:1})
 assert.equal(db.prepare('SELECT qty FROM order_items WHERE id=4').get().qty,2)
 assert.equal(db.prepare('SELECT qty FROM order_items WHERE id=5').get().qty,0.5)
 assert.deepEqual({...db.prepare('SELECT parts_cost,parts_sale,other_cost,other_sale FROM orders WHERE id=3').get()},{parts_cost:40,parts_sale:70,other_cost:5,other_sale:9})
 assert.equal(db.prepare('SELECT qty FROM job_part_orders WHERE id=6').get().qty,2)
 assert.deepEqual({...db.prepare('SELECT qty,received_qty FROM purchase_order_items WHERE id=7').get()},{qty:3,received_qty:3})
 assert.deepEqual({...db.prepare('SELECT qty,price_snapshot FROM quote_items WHERE id=8').get()},{qty:2,price_snapshot:70})
 db.close()
})
