const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {blockingPartCount,reconcileOrderPartWait}=require('../electron/job-part-workflow.cjs')

function setup(t,waitState='BRAK'){
 const db=new DatabaseSync(':memory:');t.after(()=>db.close())
 db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,wait_state TEXT);CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT);CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);INSERT INTO orders(id,wait_state) VALUES(1,'${waitState}')`)
 return db
}

test('parts waiting for an order set and clear the parts blocker',t=>{
 const db=setup(t)
 db.exec("INSERT INTO job_part_orders(order_id,status) VALUES(1,'DO_ZAMOWIENIA'),(1,'ODEBRANE')")
 assert.equal(blockingPartCount(db,1),1)
 assert.deepEqual(reconcileOrderPartWait(db,1),{changed:true,blocking:1,waitState:'CZESCI'})
 db.exec("UPDATE job_part_orders SET status='ODEBRANE'")
 assert.deepEqual(reconcileOrderPartWait(db,1),{changed:true,blocking:0,waitState:'BRAK'})
 assert.equal(db.prepare("SELECT COUNT(*) count FROM order_events WHERE event_type='PARTS_WAIT'").get().count,2)
})

test('parts reconciliation preserves a client decision blocker',t=>{
 const db=setup(t,'DECYZJA')
 db.exec("INSERT INTO job_part_orders(order_id,status) VALUES(1,'ZAMOWIONE')")
 assert.deepEqual(reconcileOrderPartWait(db,1),{changed:false,blocking:1,waitState:'DECYZJA'})
})
