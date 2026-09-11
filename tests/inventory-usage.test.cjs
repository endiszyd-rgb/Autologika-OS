const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {issueInventoryPart,removeOrderItem}=require('../electron/inventory-usage.cjs')

function database(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE suppliers(id INTEGER PRIMARY KEY,name TEXT);
  CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,supplier_id INTEGER,name TEXT,part_no TEXT,location TEXT,stock REAL,unit_cost REAL,sell_price REAL,updated_at TEXT);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,status TEXT,archived_at TEXT,parts_cost REAL DEFAULT 0,parts_sale REAL DEFAULT 0,other_cost REAL DEFAULT 0,other_sale REAL DEFAULT 0);
  CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,kind TEXT,name TEXT,qty REAL,unit_cost REAL,unit_price REAL,part_no TEXT,supplier TEXT,notes TEXT,customer_description TEXT,inventory_part_id INTEGER);
  CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);
  INSERT INTO suppliers VALUES(1,'Moto Dostawca');
  INSERT INTO inventory_parts VALUES(7,1,'Filtr oleju','W 712/95','A-03',4,24.5,49,NULL);
  INSERT INTO orders(id,status) VALUES(3,'NAPRAWA');
 `)
 db.transaction=fn=>()=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
 return db
}

test('wydanie części zmniejsza stan i dodaje wycenioną pozycję do zlecenia',()=>{
 const db=database()
 const result=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:2})
 assert.equal(result.remaining,2)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,2)
 const item=db.prepare('SELECT * FROM order_items WHERE id=?').get(result.id)
 assert.equal(item.inventory_part_id,7)
 assert.equal(item.name,'Filtr oleju')
 assert.equal(item.qty,2)
 assert.equal(item.unit_cost,24.5)
 assert.equal(item.unit_price,49)
 const order=db.prepare('SELECT parts_cost,parts_sale FROM orders WHERE id=3').get()
 assert.equal(order.parts_cost,49)
 assert.equal(order.parts_sale,98)
})

test('brak stanu cofa całą operację',()=>{
 const db=database()
 assert.throws(()=>issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:5}),/Za mało części/)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,4)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_items').get().count,0)
})

test('usunięcie pozycji magazynowej zwraca ilość na stan i przelicza zlecenie',()=>{
 const db=database()
 const issued=issueInventoryPart(db,{inventoryPartId:7,orderId:3,qty:1.5})
 const result=removeOrderItem(db,issued.id)
 assert.equal(result.removed,true)
 assert.equal(result.restored,1.5)
 assert.equal(db.prepare('SELECT stock FROM inventory_parts WHERE id=7').get().stock,4)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM order_items').get().count,0)
 const order=db.prepare('SELECT parts_cost,parts_sale FROM orders WHERE id=3').get()
 assert.equal(order.parts_cost,0)
 assert.equal(order.parts_sale,0)
})
