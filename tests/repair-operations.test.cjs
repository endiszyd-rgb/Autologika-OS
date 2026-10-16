const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {installRepairPart}=require('../electron/repair-operations.cjs')

function database(){
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE repair_parts(
   id INTEGER PRIMARY KEY,
   job_part_order_id INTEGER,
   issued_qty INTEGER NOT NULL DEFAULT 0,
   returned_qty INTEGER NOT NULL DEFAULT 0,
   installed_qty INTEGER NOT NULL DEFAULT 0,
   status TEXT,
   updated_at TEXT
 );
 CREATE TABLE repair_part_events(
   id INTEGER PRIMARY KEY,
   repair_part_id INTEGER,
   event_key TEXT UNIQUE,
   event_type TEXT,
   qty INTEGER
 );
 CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,status TEXT,installed_at TEXT,updated_at TEXT);
 INSERT INTO job_part_orders(id,status) VALUES(12,'ODEBRANE');
 INSERT INTO repair_parts(id,job_part_order_id,issued_qty,status) VALUES(7,12,1,'ISSUED');`)
 db.transaction=fn=>()=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
 return db
}

test('montaż części kończy powiązane zamówienie poprawnym statusem',()=>{
 const db=database()
 const result=installRepairPart(db,{repairPartId:7,qty:1,eventKey:'install:7:1'})
 assert.equal(result.installed,1)
 assert.equal(db.prepare('SELECT status FROM repair_parts WHERE id=7').get().status,'INSTALLED')
 const linked=db.prepare('SELECT status,installed_at,updated_at FROM job_part_orders WHERE id=12').get()
 assert.equal(linked.status,'ZAMONTOWANE')
 assert.ok(linked.installed_at)
 assert.ok(linked.updated_at)
})

test('ponowienie montażu z tym samym kluczem nie nalicza części drugi raz',()=>{
 const db=database()
 installRepairPart(db,{repairPartId:7,qty:1,eventKey:'install:7:1'})
 const repeated=installRepairPart(db,{repairPartId:7,qty:1,eventKey:'install:7:1'})
 assert.equal(repeated.existing,true)
 assert.equal(db.prepare('SELECT installed_qty FROM repair_parts WHERE id=7').get().installed_qty,1)
 assert.equal(db.prepare("SELECT COUNT(*) count FROM repair_part_events WHERE event_type='INSTALL'").get().count,1)
})
