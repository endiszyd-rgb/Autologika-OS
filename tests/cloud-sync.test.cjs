const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {_testing:{buildPayload,applyPayload}}=require('../electron/cloud-sync.cjs')

test('standalone vehicle keeps a null customer through cloud synchronization',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE customers(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,make TEXT,cloud_id TEXT,updated_at TEXT);`)
 applyPayload(db,'vehicles','vehicle-solo',{customer_cloud_id:null,plate:'PO SOLO1',make:'Toyota'},'2026-09-10T12:00:00.000Z')
 const row=db.prepare("SELECT * FROM vehicles WHERE cloud_id='vehicle-solo'").get()
 assert.equal(row.customer_id,null)
 assert.equal(buildPayload(db,'vehicles',row).customer_cloud_id,null)
})
