const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {_testing:{buildPayload,applyPayload,applyRemoteDeletion,reconcileOrderTotals,queueState,fetchSyncPages,pullCursor}}=require('../electron/cloud-sync.cjs')

test('PC downloads every page including records sharing a timestamp at the page boundary',async()=>{
 const stamp='2026-09-15T10:00:00.000Z'
 const remote=Array.from({length:2201},(_,index)=>({entity_type:index%2?'vehicles':'customers',cloud_id:index<2?'shared-id':`record-${String(index).padStart(4,'0')}`,updated_at:stamp,payload:{name:'Próba',plate:`PO ${index}`,customer_cloud_id:null}})).sort((a,b)=>a.entity_type.localeCompare(b.entity_type)||a.cloud_id.localeCompare(b.cloud_id))
 const offsets=[]
 const rows=await fetchSyncPages('workshop-1',stamp,async route=>{
  const query=new URL(route,'https://example.test').searchParams
  assert.equal(query.get('updated_at'),`gte.${stamp}`)
  assert.equal(query.get('order'),'updated_at.asc,entity_type.asc,cloud_id.asc')
  const offset=Number(query.get('offset'))
  offsets.push(offset)
  return remote.slice(offset,offset+Number(query.get('limit')))
 })
 assert.deepEqual(offsets,[0,1000,2000])
 assert.equal(rows.length,2201)
 assert.deepEqual(new Set(rows.map(row=>`${row.entity_type}:${row.cloud_id}`)).size,2201)
 const db=new DatabaseSync(':memory:')
 db.exec('CREATE TABLE customers(id INTEGER PRIMARY KEY,cloud_id TEXT,name TEXT,updated_at TEXT); CREATE TABLE vehicles(id INTEGER PRIMARY KEY,cloud_id TEXT,customer_id INTEGER,plate TEXT,updated_at TEXT);')
 for(const type of ['customers','vehicles'])for(const row of rows.filter(x=>x.entity_type===type))applyPayload(db,type,row.cloud_id,row.payload,row.updated_at)
 assert.equal(db.prepare('SELECT COUNT(*) c FROM customers').get().c,1101)
 assert.equal(db.prepare('SELECT COUNT(*) c FROM vehicles').get().c,1100)
 assert.ok(db.prepare("SELECT id FROM customers WHERE cloud_id='shared-id'").get())
 assert.ok(db.prepare("SELECT id FROM vehicles WHERE cloud_id='shared-id'").get())
})

test('a failed later page aborts the pull instead of advancing the cursor',async()=>{
 await assert.rejects(fetchSyncPages('workshop-1','2026-09-15T10:00:00.000Z',async route=>{
  if(route.includes('offset=1000'))throw new Error('Cloud 503')
  return Array.from({length:1000},()=>({updated_at:'2026-09-15T10:00:00.000Z'}))
 }),/Cloud 503/)
})

test('existing PC installations replay old cloud rows once after their queue drains',()=>{
 const config={lastSync:'2026-09-15T10:00:00.000Z',syncCursorVersion:0}
 assert.equal(pullCursor(config,1).recover,false)
 assert.equal(pullCursor(config,1).since,config.lastSync)
 assert.equal(pullCursor(config,0).since,'1970-01-01T00:00:00.000Z')
 assert.equal(pullCursor({...config,syncCursorVersion:2,lastFullSyncAt:'2026-09-15T10:00:00.000Z'},0,Date.parse('2026-09-15T10:00:00.000Z')).since,config.lastSync)
})

test('PC periodically replays older cloud rows after queued changes are sent',()=>{
 const now=Date.parse('2026-09-15T10:00:00.000Z')
 const config={lastSync:'2026-09-15T09:00:00.000Z',syncCursorVersion:2,lastFullSyncAt:new Date(now-24*60*60*1000).toISOString()}
 assert.equal(pullCursor(config,1,now).recover,false)
 assert.equal(pullCursor(config,0,now).recover,true)
 assert.equal(pullCursor({...config,lastFullSyncAt:new Date(now-60*60*1000).toISOString()},0,now).recover,false)
})

test('historical remote deletion cannot remove a newer local record during replay',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec("CREATE TABLE customers(id INTEGER PRIMARY KEY,cloud_id TEXT,name TEXT,updated_at TEXT); INSERT INTO customers VALUES(1,'customer-1','Nowsza wersja','2026-09-15T12:00:00.000Z');")
 assert.equal(applyRemoteDeletion(db,'customers',{cloud_id:'customer-1',updated_at:'2026-09-14T12:00:00.000Z'}),false)
 assert.equal(db.prepare('SELECT name FROM customers WHERE id=1').get().name,'Nowsza wersja')
 assert.equal(applyRemoteDeletion(db,'customers',{cloud_id:'customer-1',updated_at:'2026-09-16T12:00:00.000Z'}),true)
 assert.equal(db.prepare('SELECT COUNT(*) c FROM customers').get().c,0)
})

test('standalone vehicle keeps a null customer through cloud synchronization',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE customers(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,make TEXT,cloud_id TEXT,updated_at TEXT);`)
 applyPayload(db,'vehicles','vehicle-solo',{customer_cloud_id:null,plate:'PO SOLO1',make:'Toyota'},'2026-09-10T12:00:00.000Z')
 const row=db.prepare("SELECT * FROM vehicles WHERE cloud_id='vehicle-solo'").get()
 assert.equal(row.customer_id,null)
 assert.equal(buildPayload(db,'vehicles',row).customer_cloud_id,null)
})

test('inventory part preserves barcode and supplier through cloud synchronization',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE suppliers(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,barcode TEXT,name TEXT,vehicle_fitment TEXT,cross_numbers TEXT,supplier_id INTEGER,cloud_id TEXT,updated_at TEXT); INSERT INTO suppliers VALUES(1,'supplier-cloud'); INSERT INTO inventory_parts VALUES(1,'4006381333931','Filtr oleju','BMW Seria 3 E90','11427508969',1,'part-cloud','2026-09-10T12:00:00.000Z');`)
 const payload=buildPayload(db,'inventory_parts',db.prepare('SELECT * FROM inventory_parts WHERE id=1').get())
 assert.equal(payload.barcode,'4006381333931')
 assert.equal(payload.vehicle_fitment,'BMW Seria 3 E90')
 assert.equal(payload.cross_numbers,'11427508969')
 assert.equal(payload.supplier_cloud_id,'supplier-cloud')
 applyPayload(db,'inventory_parts','remote-part',{barcode:'0049000006346',name:'Filtr kabinowy',vehicle_fitment:'Audi A4 B8',cross_numbers:'8K0819439',supplier_cloud_id:'supplier-cloud'},'2026-09-10T13:00:00.000Z')
 const remote=db.prepare("SELECT * FROM inventory_parts WHERE cloud_id='remote-part'").get()
 assert.equal(remote.barcode,'0049000006346')
 assert.equal(remote.vehicle_fitment,'Audi A4 B8')
 assert.equal(remote.cross_numbers,'8K0819439')
 assert.equal(remote.supplier_id,1)
})

test('order item preserves its inventory source through cloud synchronization',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE orders(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,inventory_part_id INTEGER,name TEXT,cloud_id TEXT,updated_at TEXT); INSERT INTO inventory_parts VALUES(7,'inventory-cloud'); INSERT INTO orders VALUES(3,'order-cloud'); INSERT INTO order_items VALUES(11,3,7,'Filtr oleju','item-cloud','2026-09-11T10:00:00.000Z');`)
 const payload=buildPayload(db,'order_items',db.prepare('SELECT * FROM order_items WHERE id=11').get())
 assert.equal(payload.order_cloud_id,'order-cloud')
 assert.equal(payload.inventory_part_cloud_id,'inventory-cloud')
 assert.equal(payload.inventory_part_id,undefined)
 applyPayload(db,'order_items','remote-item',{order_cloud_id:'order-cloud',inventory_part_cloud_id:'inventory-cloud',name:'Filtr kabinowy'},'2026-09-11T11:00:00.000Z')
 const remote=db.prepare("SELECT * FROM order_items WHERE cloud_id='remote-item'").get()
 assert.equal(remote.order_id,3)
 assert.equal(remote.inventory_part_id,7)
})

test('ordered part maps its inventory source and OE data between devices',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE suppliers(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE orders(id INTEGER PRIMARY KEY,cloud_id TEXT); CREATE TABLE job_part_orders(id INTEGER PRIMARY KEY,order_id INTEGER,supplier_id INTEGER,inventory_part_id INTEGER,name TEXT,oe_number TEXT,barcode TEXT,brand TEXT,vehicle_fitment TEXT,cross_numbers TEXT,lookup_source TEXT,lookup_url TEXT,vehicle_snapshot TEXT,cloud_id TEXT,updated_at TEXT); INSERT INTO suppliers VALUES(2,'supplier-cloud'); INSERT INTO inventory_parts VALUES(7,'inventory-cloud'); INSERT INTO orders VALUES(3,'order-cloud'); INSERT INTO job_part_orders VALUES(12,3,2,7,'Filtr oleju','11428507683','4006381333931','MANN-FILTER','BMW 320d','11428507683','Katalog producenta','https://example.test/filter','{"make":"BMW"}','job-part-cloud','2026-09-12T10:00:00.000Z');`)
 const payload=buildPayload(db,'job_part_orders',db.prepare('SELECT * FROM job_part_orders WHERE id=12').get())
 assert.equal(payload.order_cloud_id,'order-cloud')
 assert.equal(payload.supplier_cloud_id,'supplier-cloud')
 assert.equal(payload.inventory_part_cloud_id,'inventory-cloud')
 assert.equal(payload.inventory_part_id,undefined)
 assert.equal(payload.oe_number,'11428507683')
 assert.equal(payload.barcode,'4006381333931')
 assert.equal(payload.brand,'MANN-FILTER')
 assert.equal(payload.vehicle_fitment,'BMW 320d')
 applyPayload(db,'job_part_orders','remote-job-part',{order_cloud_id:'order-cloud',supplier_cloud_id:'supplier-cloud',inventory_part_cloud_id:'inventory-cloud',name:'Filtr kabinowy',oe_number:'64319313519',barcode:'5901234123457',brand:'MAHLE',vehicle_fitment:'BMW Seria 3',cross_numbers:'64319313519',lookup_source:'Katalog części',lookup_url:'https://example.test/cabin',vehicle_snapshot:'{"make":"BMW"}'},'2026-09-12T11:00:00.000Z')
 const remote=db.prepare("SELECT * FROM job_part_orders WHERE cloud_id='remote-job-part'").get()
 assert.equal(remote.order_id,3)
 assert.equal(remote.supplier_id,2)
 assert.equal(remote.inventory_part_id,7)
 assert.equal(remote.oe_number,'64319313519')
 assert.equal(remote.barcode,'5901234123457')
 assert.equal(remote.brand,'MAHLE')
 assert.equal(remote.cross_numbers,'64319313519')
})

test('recalculates order profitability after remote item changes',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE orders(id INTEGER PRIMARY KEY,parts_cost REAL,parts_sale REAL,other_cost REAL,other_sale REAL); CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,kind TEXT,qty REAL,unit_cost REAL,unit_price REAL); INSERT INTO orders VALUES(3,999,999,999,999); INSERT INTO order_items VALUES(1,3,'CZESC',2,40,85); INSERT INTO order_items VALUES(2,3,'USLUGA_ZEW',1,60,100);`)
 reconcileOrderTotals(db)
 assert.deepEqual({...db.prepare('SELECT parts_cost,parts_sale,other_cost,other_sale FROM orders WHERE id=3').get()},{parts_cost:80,parts_sale:170,other_cost:60,other_sale:100})
})

test('sync queue status groups pending changes and exposes failed records',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`CREATE TABLE sync_queue(id INTEGER PRIMARY KEY,entity_type TEXT,row_id INTEGER,operation TEXT,queued_at TEXT,attempts INTEGER,last_error TEXT); INSERT INTO sync_queue VALUES(1,'orders',8,'UPSERT','2026-09-12T10:00:00Z',0,NULL),(2,'job_part_orders',12,'UPSERT','2026-09-12T10:01:00Z',2,'Cloud 400: invalid payload'),(3,'orders',9,'DELETE','2026-09-12T10:02:00Z',0,NULL);`)
 const state=queueState(db)
 assert.equal(state.pending,3)
 assert.equal(state.failed,1)
 assert.equal(state.oldestPending,'2026-09-12T10:00:00Z')
 assert.deepEqual(state.groups.map(row=>[row.entity_type,row.total,row.failed]),[['orders',2,0],['job_part_orders',1,1]])
 assert.equal(state.queue[0].id,2)
})
