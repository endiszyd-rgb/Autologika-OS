const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {installRepairPart,updateRepairOperation}=require('../electron/repair-operations.cjs')

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

function repairDatabase(){
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE order_repair_operations(
   id INTEGER PRIMARY KEY,order_id INTEGER,idempotency_key TEXT,order_item_id INTEGER,procedure_run_id INTEGER,
   title TEXT,variant TEXT,customer_description TEXT,technical_description TEXT,planned_hours REAL,labor_rate REAL,
   labor_cost_rate REAL,discount_percent REAL,vat_rate REAL,other_cost REAL,other_price REAL,updated_at TEXT
 );
 CREATE TABLE order_items(id INTEGER PRIMARY KEY,name TEXT,work_name TEXT,variant_name TEXT,customer_description TEXT,technical_description TEXT,notes TEXT,qty REAL,unit_cost REAL,unit_price REAL,hours_snapshot REAL,price_snapshot REAL);
 CREATE TABLE work_procedure_runs(id INTEGER PRIMARY KEY,title TEXT,variant TEXT,technical_description TEXT);
 CREATE TABLE repair_parts(id INTEGER PRIMARY KEY,repair_operation_id INTEGER,qty INTEGER,unit_cost REAL,unit_price REAL);
 CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);
 INSERT INTO order_items(id,name,work_name) VALUES(10,'Stara nazwa','Stara nazwa');
 INSERT INTO work_procedure_runs(id,title) VALUES(20,'Stara nazwa');
 INSERT INTO order_repair_operations(id,order_id,idempotency_key,order_item_id,procedure_run_id,title,variant,customer_description,technical_description,planned_hours,labor_rate,labor_cost_rate,discount_percent,vat_rate,other_cost,other_price)
 VALUES(1,7,'job:1',10,20,'Stara nazwa','Standard','Opis stary','Techniczny stary',1.5,150,70,0,23,0,0);`)
 db.transaction=fn=>()=>{db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}}
 return db
}

test('edycja naprawy aktualizuje nazwę i opisy we wszystkich powiązanych rekordach',()=>{
 const db=repairDatabase()
 updateRepairOperation(db,{operationId:1,data:{title:'Wymiana klocków przód',variant:'Oś przednia',customer_description:'Wymiana kompletu klocków',technical_description:'Oczyścić jarzma',planned_hours:2,labor_rate:180}})
 assert.deepEqual({...db.prepare('SELECT title,variant,customer_description,technical_description,planned_hours,labor_rate FROM order_repair_operations WHERE id=1').get()},{title:'Wymiana klocków przód',variant:'Oś przednia',customer_description:'Wymiana kompletu klocków',technical_description:'Oczyścić jarzma',planned_hours:2,labor_rate:180})
 assert.deepEqual({...db.prepare('SELECT name,work_name,variant_name,customer_description,technical_description,qty,unit_price FROM order_items WHERE id=10').get()},{name:'Wymiana klocków przód',work_name:'Wymiana klocków przód',variant_name:'Oś przednia',customer_description:'Wymiana kompletu klocków',technical_description:'Oczyścić jarzma',qty:2,unit_price:180})
 assert.deepEqual({...db.prepare('SELECT title,variant,technical_description FROM work_procedure_runs WHERE id=20').get()},{title:'Wymiana klocków przód',variant:'Oś przednia',technical_description:'Oczyścić jarzma'})
 assert.equal(db.prepare('SELECT event_type FROM order_events').get().event_type,'REPAIR_UPDATED')
})

test('nazwa naprawy nie może zostać wyczyszczona',()=>{
 const db=repairDatabase()
 assert.throws(()=>updateRepairOperation(db,{operationId:1,data:{title:'   '}}),/Nazwa naprawy jest wymagana/)
 assert.equal(db.prepare('SELECT title FROM order_repair_operations WHERE id=1').get().title,'Stara nazwa')
})
