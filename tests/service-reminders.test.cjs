const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {reminderUrgency,listServiceReminders,createServiceReminder,setServiceReminderStatus,migrateLegacyServiceReminders}=require('../electron/service-reminders.cjs')

function fixture(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT);
  CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,make TEXT,model TEXT,mileage INTEGER);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT);
  CREATE TABLE service_reminders_v2(id INTEGER PRIMARY KEY,vehicle_id INTEGER,order_id INTEGER,title TEXT,due_date TEXT,due_mileage INTEGER,note TEXT,status TEXT DEFAULT 'OPEN',created_at TEXT DEFAULT CURRENT_TIMESTAMP,deleted_at TEXT);
  INSERT INTO customers VALUES(1,'Jan Kowalski');
  INSERT INTO vehicles VALUES(1,1,'PO 1234A','Škoda','Octavia',150500);
  INSERT INTO orders VALUES(7,1,'Serwis okresowy');
  INSERT INTO service_reminders_v2(id,vehicle_id,order_id,title,due_date,due_mileage,note,status) VALUES
   (1,1,7,'Olej','2026-09-10',NULL,'Telefon rano','OPEN'),
   (2,1,NULL,'Rozrząd','2026-10-01',151000,'','OPEN'),
   (3,1,NULL,'Klimatyzacja','2027-01-10',180000,'','OPEN');
 `)
 return db
}

test('service reminders share vehicle, customer and order context and rank urgency',()=>{
 const rows=listServiceReminders(fixture(),{today:new Date('2026-09-12T10:00:00Z')})
 assert.deepEqual(rows.map(row=>row.urgency),['OVERDUE','SOON','PLANNED'])
 assert.equal(rows[0].customer,'Jan Kowalski')
 assert.equal(rows[0].order_title,'Serwis okresowy')
 assert.equal(rows[1].mileage_remaining,500)
})

test('service reminder urgency reacts to date and current mileage',()=>{
 assert.equal(reminderUrgency({status:'OPEN',due_date:'2026-09-11',current_mileage:10},new Date('2026-09-12T10:00:00Z')).urgency,'OVERDUE')
 assert.equal(reminderUrgency({status:'OPEN',due_mileage:100,current_mileage:100},new Date('2026-09-12T10:00:00Z')).urgency,'OVERDUE')
 assert.equal(reminderUrgency({status:'DONE',due_date:'2020-01-01'},new Date('2026-09-12T10:00:00Z')).urgency,'DONE')
})

test('service reminders validate linkage and can be completed',()=>{
 const db=fixture()
 const created=createServiceReminder(db,{vehicleId:1,orderId:7,data:{title:'  Płyn hamulcowy ',due_date:'2026-12-01',due_mileage:160000,note:' sprawdzić testerem '}})
 assert.deepEqual({...db.prepare('SELECT vehicle_id,order_id,title,due_date,due_mileage,note,status FROM service_reminders_v2 WHERE id=?').get(created.id)},{vehicle_id:1,order_id:7,title:'Płyn hamulcowy',due_date:'2026-12-01',due_mileage:160000,note:'sprawdzić testerem',status:'OPEN'})
 assert.equal(setServiceReminderStatus(db,created.id,'DONE'),true)
 assert.equal(db.prepare('SELECT status FROM service_reminders_v2 WHERE id=?').get(created.id).status,'DONE')
 assert.throws(()=>createServiceReminder(db,{vehicleId:99,data:{title:'Test'}}),/nie istnieje/)
  assert.throws(()=>setServiceReminderStatus(db,created.id,'BAD'),/status/)
})

test('legacy reminders migrate once into the synchronized register',()=>{
 const db=fixture()
 db.exec(`CREATE TABLE reminders(id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT,due_date TEXT,due_mileage INTEGER,done INTEGER);
  INSERT INTO reminders VALUES(1,1,'Olej','2026-09-10',NULL,0),(2,1,'Geometria','2026-11-01',170000,1);`)
 const first=migrateLegacyServiceReminders(db)
 const second=migrateLegacyServiceReminders(db)
 assert.equal(first.changes,1)
 assert.equal(second.changes,0)
 assert.equal(db.prepare("SELECT status FROM service_reminders_v2 WHERE title='Geometria'").get().status,'DONE')
})
