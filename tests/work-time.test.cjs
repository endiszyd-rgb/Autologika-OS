const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {elapsedWorkMinutes,stopActiveWorkLogs,stopWorkLog,timestampMilliseconds}=require('../electron/work-time.cjs')

test('czas SQLite bez strefy jest interpretowany jako UTC',()=>{
 assert.equal(timestampMilliseconds('2026-10-15 10:00:00'),Date.parse('2026-10-15T10:00:00Z'))
 assert.equal(elapsedWorkMinutes('2026-10-15 10:00:00','2026-10-15T10:35:00Z'),35)
})

test('zatrzymanie timera jest idempotentne i nie zapisuje ujemnego czasu',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec("CREATE TABLE work_logs(id INTEGER PRIMARY KEY,order_id INTEGER,started_at TEXT,ended_at TEXT,duration_minutes INTEGER);INSERT INTO work_logs VALUES(1,4,'2026-10-15 10:00:00',NULL,NULL)")
 assert.deepEqual(stopWorkLog(db,1,Date.parse('2026-10-15T09:59:30Z')),{stopped:true,minutes:1})
 assert.deepEqual(stopWorkLog(db,1,Date.parse('2026-10-15T11:00:00Z')),{stopped:false,minutes:1})
 db.close()
})

test('grupowe zatrzymanie dotyczy tylko aktywnych timerów wybranego zlecenia',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec("CREATE TABLE work_logs(id INTEGER PRIMARY KEY,order_id INTEGER,started_at TEXT,ended_at TEXT,duration_minutes INTEGER);INSERT INTO work_logs VALUES(1,4,'2026-10-15 10:00:00',NULL,NULL),(2,4,'2026-10-15 10:10:00','2026-10-15 10:20:00',10),(3,5,'2026-10-15 10:00:00',NULL,NULL)")
 assert.deepEqual(stopActiveWorkLogs(db,4,Date.parse('2026-10-15T10:30:00Z')),{count:1,minutes:30})
 assert.equal(db.prepare('SELECT ended_at FROM work_logs WHERE id=3').get().ended_at,null)
 db.close()
})
