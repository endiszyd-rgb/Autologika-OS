const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {syncCloseoutAutomation,reconcileCloseoutAutomation}=require('../electron/closeout-automation.cjs')

function fixture(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE orders(id INTEGER PRIMARY KEY,final_price REAL,labor_hours REAL,labor_rate REAL,parts_sale REAL,other_sale REAL,diagnosis_fee REAL,discount REAL);
  CREATE TABLE approvals(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT,created_at TEXT,decided_at TEXT);
  CREATE TABLE diagnostics(order_id INTEGER,symptom_confirmed TEXT,conclusion TEXT,recommendation TEXT);
  CREATE TABLE job_part_orders(order_id INTEGER,status TEXT);
  CREATE TABLE work_logs(order_id INTEGER,ended_at TEXT);
  CREATE TABLE order_qc(order_id INTEGER,check_key TEXT,checked INTEGER,deleted_at TEXT);
  CREATE TABLE payments(order_id INTEGER,amount REAL);
  CREATE TABLE order_notes(order_id INTEGER,release_notes TEXT);
  CREATE TABLE closeout_checks(order_id INTEGER PRIMARY KEY,customer_approved INTEGER,diagnosis_documented INTEGER,parts_documented INTEGER,work_logged INTEGER,qc_done INTEGER,payment_checked INTEGER,release_notes_done INTEGER,updated_at TEXT);
 `)
 return db
}

test('closeout uses decision time instead of local insertion id after synchronization',()=>{
 const db=fixture()
 db.prepare('INSERT INTO orders(id,final_price) VALUES (?,?)').run(1,100)
 db.prepare('INSERT INTO diagnostics(order_id,conclusion) VALUES (?,?)').run(1,'Usterka potwierdzona')
 db.prepare('INSERT INTO approvals(id,order_id,status,created_at,decided_at) VALUES (?,?,?,?,?)').run(3,1,'APPROVED','2026-10-16 12:00:00','2026-10-16 12:05:00')
 db.prepare('INSERT INTO approvals(id,order_id,status,created_at,decided_at) VALUES (?,?,?,?,?)').run(40,1,'DECLINED','2026-10-15T12:00:00Z','2026-10-15T12:05:00Z')
 assert.equal(syncCloseoutAutomation(db,1).customer_approved,1)
 db.prepare('INSERT INTO approvals(id,order_id,status,created_at,decided_at) VALUES (?,?,?,?,?)').run(41,1,'DECLINED','2026-10-16T13:00:00Z','2026-10-16T13:05:00Z')
 assert.equal(syncCloseoutAutomation(db,1).customer_approved,0)
 db.close()
})

test('reconciliation refreshes every local order and handles nullable totals',()=>{
 const db=fixture()
 db.prepare('INSERT INTO orders(id,final_price,labor_hours,labor_rate,parts_sale,other_sale,diagnosis_fee,discount) VALUES (?,?,?,?,?,?,?,?)').run(1,null,1,100,null,null,null,null)
 db.prepare('INSERT INTO orders(id,final_price) VALUES (?,?)').run(2,0)
 db.prepare('INSERT INTO payments(order_id,amount) VALUES (?,?)').run(1,100)
 assert.equal(reconcileCloseoutAutomation(db),2)
 assert.equal(db.prepare('SELECT payment_checked FROM closeout_checks WHERE order_id=1').get().payment_checked,0)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM closeout_checks').get().count,2)
 db.close()
})

