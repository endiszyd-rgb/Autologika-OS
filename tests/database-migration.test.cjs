const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {migrateSchemaV9}=require('../electron/db.cjs')

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
