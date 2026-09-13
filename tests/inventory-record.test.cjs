const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {deleteInventoryPart}=require('../electron/inventory-record.cjs')

function database(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,barcode TEXT,name TEXT,stock REAL,cloud_id TEXT);
  CREATE TABLE barcode_lookup_cache(barcode TEXT PRIMARY KEY,payload_json TEXT);
  CREATE TABLE order_items(id INTEGER PRIMARY KEY,inventory_part_id INTEGER,name TEXT);
  CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,inventory_part_id INTEGER,name TEXT);
  CREATE TABLE purchase_order_items(id INTEGER PRIMARY KEY,inventory_part_id INTEGER,name TEXT);
  INSERT INTO inventory_parts VALUES(7,'5901947342091','Błędna część',3,'part-cloud-7');
  INSERT INTO barcode_lookup_cache VALUES('5901947342091','{}');
  INSERT INTO order_items VALUES(1,7,'Pozycja historyczna');
  INSERT INTO job_part_orders VALUES(2,7,'Zamówienie historyczne');
  INSERT INTO purchase_order_items VALUES(3,7,'Zakup historyczny');
 `)
 db.transaction=fn=>()=>{db.exec('BEGIN');try{const value=fn();db.exec('COMMIT');return value}catch(error){db.exec('ROLLBACK');throw error}}
 return db
}

test('deletes an inventory record, clears its barcode cache and preserves historical rows',()=>{
 const db=database(),result=deleteInventoryPart(db,7)
 assert.equal(result.removed,true)
 assert.equal(result.barcode,'5901947342091')
 assert.equal(result.discardedStock,3)
 assert.deepEqual(result.linked,{orderItems:1,jobParts:1,purchases:1})
 assert.equal(db.prepare('SELECT COUNT(*) count FROM inventory_parts').get().count,0)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM barcode_lookup_cache').get().count,0)
 assert.equal(db.prepare('SELECT inventory_part_id FROM order_items').get().inventory_part_id,null)
 assert.equal(db.prepare('SELECT inventory_part_id FROM job_part_orders').get().inventory_part_id,null)
 assert.equal(db.prepare('SELECT inventory_part_id FROM purchase_order_items').get().inventory_part_id,null)
})

test('returns a safe result when the inventory record no longer exists',()=>{
 const db=database()
 assert.deepEqual(deleteInventoryPart(db,999),{removed:false})
 assert.equal(db.prepare('SELECT COUNT(*) count FROM inventory_parts').get().count,1)
})
