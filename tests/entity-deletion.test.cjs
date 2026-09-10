const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const os=require('node:os')
const path=require('node:path')
const {DatabaseSync}=require('node:sqlite')
const {deletionPreview,removeEntity}=require('../electron/entity-deletion.cjs')

function fixture(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  PRAGMA foreign_keys=ON;
  CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT);
  CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,make TEXT,model TEXT,FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT,FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE);
  CREATE TABLE attachments(id INTEGER PRIMARY KEY,order_id INTEGER,file_path TEXT,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE);
  CREATE TABLE appointments(id INTEGER PRIMARY KEY,order_id INTEGER,vehicle_id INTEGER,FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE SET NULL,FOREIGN KEY(vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL);
  INSERT INTO customers VALUES(1,'Jan Kowalski');
  INSERT INTO vehicles VALUES(1,1,'PO 1234A','Toyota','Corolla');
  INSERT INTO orders VALUES(1,1,'Serwis');
  INSERT INTO appointments VALUES(1,1,1);
 `)
 return db
}

test('customer deletion previews and removes the complete ownership tree',()=>{
 const db=fixture(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-delete-')),file=path.join(dir,'photo.jpg')
 fs.writeFileSync(file,'test')
 db.prepare('INSERT INTO attachments VALUES(1,1,?)').run(file)
 const preview=deletionPreview(db,'customer',1)
 assert.deepEqual(preview.counts,{customers:1,vehicles:1,orders:1,attachments:1,appointments:1})
 const result=removeEntity(db,'customer',1,{unlink:value=>fs.unlinkSync(value)})
 assert.equal(result.ok,true)
 assert.equal(result.filesRemoved,1)
 assert.equal(fs.existsSync(file),false)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM customers').get().n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM vehicles').get().n,0)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0)
 const appointment=db.prepare('SELECT order_id,vehicle_id FROM appointments').get()
 assert.equal(appointment.order_id,null)
 assert.equal(appointment.vehicle_id,null)
})

test('order deletion retains its customer and vehicle',()=>{
 const db=fixture(),preview=deletionPreview(db,'order',1)
 assert.equal(preview.counts.orders,1)
 assert.equal(preview.counts.appointments,1)
 removeEntity(db,'order',1)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM customers').get().n,1)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM vehicles').get().n,1)
 assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0)
 assert.equal(db.prepare('SELECT order_id FROM appointments').get().order_id,null)
})
