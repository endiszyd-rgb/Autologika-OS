const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {listAppointments,createAppointment,updateAppointment,removeAppointment}=require('../electron/appointments.cjs')

function fixture(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT);
  CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,make TEXT,model TEXT);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER);
  CREATE TABLE appointments(id INTEGER PRIMARY KEY,order_id INTEGER,vehicle_id INTEGER,title TEXT,start_at TEXT,end_at TEXT,bay TEXT,status TEXT,notes TEXT);
  INSERT INTO customers VALUES(1,'Jan Kowalski');
  INSERT INTO vehicles VALUES(1,1,'PO 1234A','Toyota','Corolla'),(2,1,'PO 5678B','Ford','Focus');
  INSERT INTO orders VALUES(1,1);
 `)
 return db
}

test('appointment linked to an order inherits its vehicle and legacy status',()=>{
 const db=fixture()
 const created=createAppointment(db,{order_id:1,title:'Diagnostyka',start_at:'2026-09-09T22:30:00Z',end_at:'2026-09-10T00:30:00Z',bay:'Diagnostyka',status:'PROGRESS'})
 const rows=listAppointments(db,'2026-09-10T00:00:00Z','2026-09-11T00:00:00Z')
 assert.equal(rows.length,1)
 assert.equal(rows[0].id,created.id)
 assert.equal(rows[0].vehicle_id,1)
 assert.equal(rows[0].customer,'Jan Kowalski')
 assert.equal(rows[0].status,'W_TRAKCIE')
})

test('appointment validation protects order linkage, status and deletion',()=>{
 const db=fixture()
 const {id}=createAppointment(db,{vehicle_id:1,title:'Serwis',start_at:'2026-09-09T08:00:00Z',end_at:'2026-09-09T09:00:00Z'})
 assert.throws(()=>updateAppointment(db,id,{order_id:1,vehicle_id:2}),/innego pojazdu/)
 assert.throws(()=>updateAppointment(db,id,{status:'UNKNOWN'}),/status wizyty/)
 assert.equal(removeAppointment(db,id),true)
 assert.throws(()=>removeAppointment(db,id),/nie istnieje/)
})
