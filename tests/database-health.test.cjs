const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {criticalSchemaStatus,CRITICAL_COLUMNS}=require('../electron/database-health.cjs')

test('database health reports an exact missing critical column',()=>{
 const db=new DatabaseSync(':memory:')
 for(const [table,columns] of Object.entries(CRITICAL_COLUMNS))db.exec(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY,${columns.filter(column=>!(table==='job_part_orders'&&column==='vehicle_snapshot')).map(column=>`${column} TEXT`).join(',')})`)
 assert.deepEqual(criticalSchemaStatus(db),{ok:false,missing:['job_part_orders.vehicle_snapshot']})
 db.exec('ALTER TABLE job_part_orders ADD COLUMN vehicle_snapshot TEXT')
 assert.deepEqual(criticalSchemaStatus(db),{ok:true,missing:[]})
})
