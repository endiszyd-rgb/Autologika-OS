const test=require('node:test'),assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {payloadRepairLink,applyRepairLink,reconcileRepairLinks}=require('../electron/sync-repair-links.cjs')
function fixture(){const db=new DatabaseSync(':memory:');db.exec(`CREATE TABLE order_repair_operations(id INTEGER PRIMARY KEY,cloud_id TEXT);CREATE TABLE order_items(id INTEGER PRIMARY KEY,cloud_id TEXT,repair_operation_id INTEGER);INSERT INTO order_items VALUES(10,'labor-cloud',NULL)`);return db}
test('repair references cross devices through cloud IDs and resolve after the cyclic parent arrives',()=>{
 const db=fixture(),payload={repair_operation_cloud_id:'repair-cloud'},data={}
 applyRepairLink(db,'order_items',payload,data);assert.equal(data.repair_operation_id,null)
 db.exec("INSERT INTO order_repair_operations VALUES(73,'repair-cloud')")
 reconcileRepairLinks(db,[{entity_type:'order_items',cloud_id:'labor-cloud',payload}])
 assert.equal(db.prepare('SELECT repair_operation_id FROM order_items').get().repair_operation_id,73)
 const outgoing=payloadRepairLink(db,'order_items',{repair_operation_id:73},{repair_operation_id:73,qty:1})
 assert.deepEqual(outgoing,{qty:1,repair_operation_cloud_id:'repair-cloud'})
})
test('old iOS attachment fields map to required desktop metadata',()=>{
 const mapped=applyRepairLink(fixture(),'attachments',{original_name:'zdjecie.heic',mime_type:'image/heic',size:125},{})
 assert.deepEqual(mapped,{name:'zdjecie.heic',mime:'image/heic',size_bytes:125})
})
