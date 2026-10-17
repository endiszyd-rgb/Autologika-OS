const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {criticalSchemaStatus,relationshipStatus,CRITICAL_COLUMNS}=require('../electron/database-health.cjs')

test('database health reports an exact missing critical column',()=>{
 const db=new DatabaseSync(':memory:')
 for(const [table,columns] of Object.entries(CRITICAL_COLUMNS))db.exec(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY,${columns.filter(column=>!(table==='job_part_orders'&&column==='vehicle_snapshot')).map(column=>`${column} TEXT`).join(',')})`)
 assert.deepEqual(criticalSchemaStatus(db),{ok:false,missing:['job_part_orders.vehicle_snapshot']})
 db.exec('ALTER TABLE job_part_orders ADD COLUMN vehicle_snapshot TEXT')
 assert.deepEqual(criticalSchemaStatus(db),{ok:true,missing:[]})
})

test('database health detects cross-order repair links and DVI vehicle mismatch',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER);
  CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER);
  CREATE TABLE order_repair_operations(id INTEGER PRIMARY KEY,order_id INTEGER,order_item_id INTEGER);
  CREATE TABLE repair_parts(id INTEGER PRIMARY KEY,repair_operation_id INTEGER,order_id INTEGER,order_item_id INTEGER);
  CREATE TABLE dvi_inspections(id INTEGER PRIMARY KEY,order_id INTEGER,vehicle_id INTEGER);
  INSERT INTO orders VALUES(1,10),(2,20);
  INSERT INTO order_items VALUES(1,2),(2,1);
  INSERT INTO order_repair_operations VALUES(1,1,1);
  INSERT INTO repair_parts VALUES(1,1,2,2);
  INSERT INTO dvi_inspections VALUES(1,1,20);
 `)
 const broken=relationshipStatus(db)
 assert.equal(broken.ok,false)
 assert.equal(broken.count,4)
 db.exec('UPDATE order_repair_operations SET order_item_id=2;UPDATE repair_parts SET order_id=1,order_item_id=2;UPDATE dvi_inspections SET vehicle_id=10;')
 assert.deepEqual(relationshipStatus(db),{ok:true,count:0,issues:[]})
})
