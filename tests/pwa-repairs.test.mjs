import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createPwaRepairs,hydrateProcedure,repairEstimate} from '../src/platform/pwa-repairs.mjs'

// Exercise the real cloud hydration and batch writer with an in-memory HTTP transport.
const source=(await readFile(new URL('../src/platform/pwa-client.js',import.meta.url),'utf8')).replace("'./pwa-identifiers.mjs'",JSON.stringify(new URL('../src/platform/pwa-identifiers.mjs',import.meta.url).href)).replaceAll('import.meta.env','({})')
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
const {PwaCloudClient}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
async function fixture(){
 const cloud=new PwaCloudClient(),remote=new Map();let fail=false
 cloud.session={user:{id:'workshop'},access_token:'test'};cloud.loaded=true
 cloud.request=async(path,options)=>{
  if(options.method==='GET')return []
  if(fail)throw new Error('Connection lost')
  const records=JSON.parse(options.body)
  for(const record of records)remote.set(`${record.entity_type}:${record.cloud_id}`,record)
  return records
 }
 const order=await cloud.upsert('orders',{status:'PRZYJETE'},'order-1')
 return {cloud,remote,order,api:createPwaRepairs(cloud),fail:()=>{fail=true},recover:()=>{fail=false}}
}
const bundle=()=>({idempotency_key:'test-job',title:'Wymiana klocków',name:'Wymiana klocków — przód',variant:'przód',hours:1.5,rate:220,scope:'Wymiana i kontrola',qc:['Sprawdź hamulce'],pre:['Podnieś auto'],steps:['Wymień klocki'],parts:[{name:'Klocki',qty:1,unit_cost:90,unit_price:120},{name:'Opcjonalne',qty:1,selected:false}]})

test('catalog repair writes priced labor, repair, procedure, parts and QC with cloud relations',async()=>{
 const {cloud,order,api}=await fixture()
 const result=await api.createBundle(order.id,bundle())
 const repairs=await api.list(order.id),items=await cloud.list('order_items'),procedures=await cloud.list('work_procedure_runs')
 assert.equal(repairs.length,1);assert.equal(repairs[0].id,result.operationId)
 assert.equal(repairs[0].order_item_id,items[0].id)
 assert.equal(repairs[0].procedure_run_id,procedures[0].id)
 assert.equal(items[0].repair_operation_id,repairs[0].id)
 assert.equal(items[0].qty*items[0].unit_price,330)
 assert.equal(items[0].labor_hours*items[0].labor_rate,330)
 assert.equal(repairs[0].estimate.net,450);assert.equal(repairs[0].estimate.gross,553.5)
 assert.equal(repairs[0].part_count,1);assert.equal(repairs[0].qc_total,1)
 assert.deepEqual(hydrateProcedure(procedures[0]).steps,['Wymień klocki'])
 const estimate=await api.estimate(order.id)
 assert.equal(estimate.totals.net,450);assert.equal(estimate.totals.gross,553.5)
 assert.ok(procedures[0].steps_json);assert.deepEqual(procedures[0].steps,['Wymień klocki'])
})

test('retrying a catalog bundle does not duplicate labor or parts',async()=>{
 const {cloud,order,api}=await fixture()
 await api.createBundle(order.id,bundle());await api.createBundle(order.id,bundle())
 assert.equal((await cloud.list('order_items')).length,1)
 assert.equal((await cloud.list('repair_parts')).length,1)
 assert.equal((await cloud.list('order_repair_operations')).length,1)
})

test('failed atomic write exposes no partial repair or price and can be retried',async()=>{
 const f=await fixture();f.fail()
 await assert.rejects(f.api.createBundle(f.order.id,bundle()),/Connection lost/)
 assert.equal((await f.cloud.list('order_items')).length,0)
 assert.equal((await f.cloud.list('order_repair_operations')).length,0)
 f.recover();await f.api.createBundle(f.order.id,bundle())
 assert.equal((await f.api.list(f.order.id)).length,1)
})

test('editing repair updates quote labor and procedure together, including explicit zero price',async()=>{
 const {cloud,order,api}=await fixture();const job=await api.createBundle(order.id,bundle())
 await api.update(job.operationId,{title:'Nowa nazwa',planned_hours:2,labor_rate:150,vat_rate:0})
 const [item]=await cloud.list('order_items'),[procedure]=await cloud.list('work_procedure_runs')
 assert.equal(item.qty*item.unit_price,300);assert.equal(item.labor_hours*item.labor_rate,300)
 assert.equal(item.name,'Nowa nazwa');assert.equal(procedure.title,'Nowa nazwa')
 assert.equal((await api.estimate(order.id)).totals.gross,420)
 await api.update(job.operationId,{labor_rate:0})
 assert.equal((await cloud.list('order_items'))[0].unit_price,0)
})

test('desktop synced operations show tax, discounts, cost and linked part totals',()=>{
 const estimate=repairEstimate({id:1,planned_hours:2,labor_rate:200,labor_cost_rate:70,discount_percent:10,vat_rate:23,other_price:50,other_cost:20},[{qty:2,unit_cost:30,unit_price:50}])
 assert.equal(estimate.net,495);assert.equal(estimate.vat,113.85);assert.equal(estimate.gross,608.85)
 assert.equal(estimate.cost,220);assert.equal(estimate.margin,275)
})

test('closed orders and invalid prices cannot create catalog records',async()=>{
 const {cloud,order,api}=await fixture()
 await assert.rejects(api.createBundle(order.id,{...bundle(),rate:Infinity}),/Nieprawidłowa/)
 await cloud.upsert('orders',{status:'WYDANE'},order.cloud_id)
 await assert.rejects(api.createBundle(order.id,bundle()),/tylko do odczytu/)
 assert.equal((await cloud.list('order_items')).length,0)
})

test('conflicting record blocks the whole related update before POST',async()=>{
 const {cloud,order,api}=await fixture();const job=await api.createBundle(order.id,bundle())
 let posted=false
 cloud.request=async(path,options)=>{if(options.method==='GET')return [{updated_at:'changed',device_id:'other'}];posted=true;return []}
 cloud.sync=async()=>[]
 await assert.rejects(api.update(job.operationId,{labor_rate:999}),/innym urządzeniu/)
 assert.equal(posted,false)
 assert.equal((await cloud.list('order_items'))[0].unit_price,220)
})

async function fullApi(cloud){
 globalThis.__pwaApiTestCloud=cloud
 const stub=`data:text/javascript;base64,${Buffer.from('export const pwaCloud=globalThis.__pwaApiTestCloud\n//'+Math.random()).toString('base64')}`
 let apiSource=(await readFile(new URL('../src/platform/pwa-api.js',import.meta.url),'utf8')).replace("'./pwa-client.js'",JSON.stringify(stub)).replace("'./pwa-repairs.mjs'",JSON.stringify(new URL('../src/platform/pwa-repairs.mjs',import.meta.url).href))
 apiSource=apiSource.replace(/from '(\.[^']+)'/g,(_match,path)=>`from ${JSON.stringify(new URL(path,new URL('../src/platform/pwa-api.js',import.meta.url)).href)}`)
 return (await import(`data:text/javascript;base64,${Buffer.from(apiSource).toString('base64')}`)).createPwaApi()
}

test('quick intake accepts decoded flat form and links customer, vehicle and order',async()=>{
 const {cloud}=await fixture(),api=await fullApi(cloud)
 const created=await api.intake.create({customer_name:'Jan Kowalski',plate:'ZPL 123',vin:'TESTVIN',make:'Toyota',title:'Przyjęcie AZTEC',complaint:'Nie odpala',intake_notes:'Skan dowodu'})
 const order=await api.orders.get(created.order_id)
 assert.equal(order.plate,'ZPL 123');assert.equal(order.vin,'TESTVIN');assert.equal(order.customer,'Jan Kowalski')
 assert.equal(order.title,'Przyjęcie AZTEC')
 assert.equal((await api.orders.notesGet(order.id)).intake_notes,'Skan dowodu')
 assert.equal((await api.orders.list('ACTIVE')).length,2)
 const counts=[(await cloud.list('vehicles')).length,(await cloud.list('customers')).length]
 await assert.rejects(api.intake.create({vehicle_id:order.vehicle_id,customer_id:order.customer_id,customer_name:'Jan Kowalski',plate:'ZPL 123',title:'Duplikat'}),/aktywne/)
 assert.deepEqual([(await cloud.list('vehicles')).length,(await cloud.list('customers')).length],counts)
})

test('PWA loads workshop catalog prices and saves overrides as desktop-compatible settings',async()=>{
 const {cloud}=await fixture(),api=await fullApi(cloud)
 await cloud.upsert('app_settings',{setting_key:'work_catalog_prices_v1',value:JSON.stringify({'hamulce::klocki::przód':350})},'work-catalog-prices-v1')
 assert.equal((await api.settings.catalogPrices())['hamulce::klocki::przód'],350)
 await api.settings.setCatalogOverride('variant-1',{price:390,hours:1.5})
 assert.equal((await api.settings.catalogOverrides())['variant-1'].price,390)
 const row=(await cloud.list('app_settings')).find(row=>row.setting_key==='work_catalog_overrides_v2')
 assert.equal(JSON.parse(row.value)['variant-1'].hours,1.5)
})

test('iOS balances and finance derive totals from synchronized labor and payments with a zero final price',async()=>{
 const {cloud,order}=await fixture(),api=await fullApi(cloud)
 await cloud.upsert('orders',{opened_at:new Date().toISOString(),status:'GOTOWE'},order.cloud_id)
 await api.items.create(order.id,{kind:'ROBOCIZNA',name:'Diagnoza',qty:1.5,unit_price:200})
 await api.payments.add(order.id,{amount:100})
 assert.equal((await api.orders.get(order.id)).total,300)
 assert.equal((await api.debtors.list())[0].balance,200)
 const analytics=await api.finance.analytics();assert.equal(analytics.current.revenue,300);assert.equal(analytics.current.paid,100)
 await cloud.upsert('orders',{final_price:0},order.cloud_id)
 assert.equal((await api.orders.get(order.id)).total,0)
 assert.equal((await api.debtors.list()).length,0)
})

test('labor editing allows fractional hours and zero hourly price without falling back to old price',async()=>{
 const {cloud,order}=await fixture(),api=await fullApi(cloud)
 const item=await api.items.create(order.id,{kind:'ROBOCIZNA',name:'Test',labor_hours:1.25,labor_rate:220})
 await api.quotes.updateItem(item.id,{...item,labor_hours:1.75,labor_rate:0})
 const quote=await api.quotes.get(order.id)
 assert.equal(quote.items[0].qty,1.75);assert.equal(quote.total,0)
})

test('intake atomic failure leaves no orphan customer or vehicle and retry does not duplicate order',async()=>{
 const f=await fixture(),api=await fullApi(f.cloud),data={customer_name:'Jan',plate:'NEW',title:'Naprawa'}
 f.fail();await assert.rejects(api.intake.create(data));assert.equal((await f.cloud.list('customers')).length,0);assert.equal((await f.cloud.list('vehicles')).length,0)
 f.recover();const first=await api.intake.create(data),second=await api.intake.create(data)
 assert.equal(first.order_id,second.order_id);assert.equal((await f.cloud.list('customers')).length,1)
})

test('technical data uses vehicle scope and Care completion uses desktop DONE status',async()=>{
 const {cloud,order}=await fixture(),api=await fullApi(cloud)
 const vehicle=await api.vehicles.create({plate:'ZPL',make:'Toyota',model:'Corolla'})
 await cloud.upsert('orders',{vehicle_cloud_id:vehicle.cloud_id},order.cloud_id)
 await api.technicalData.create(order.id,{parameter:'Moment',value:'100',scope:'VEHICLE'})
 assert.equal((await api.technicalData.forOrder(order.id))[0].parameter,'Moment')
 const reminder=await api.reminders.create({vehicle_id:vehicle.id,title:'Olej',due_mileage:1})
 assert.equal((await api.reminders.list())[0].urgency,'SOON')
 await api.reminders.done(reminder.id);assert.equal((await api.reminders.list()).length,0)
 assert.equal((await api.serviceReminders.listForVehicle(vehicle.id))[0].status,'DONE')
})

test('DVI returns its nested observations and decision and health uses a complete renderer contract',async()=>{
 const {cloud,order}=await fixture(),api=await fullApi(cloud)
 const vehicle=await api.vehicles.create({plate:'ZPL',make:'Toyota'});await cloud.upsert('orders',{vehicle_cloud_id:vehicle.cloud_id},order.cloud_id)
 const inspection=await api.dvi.create(order.id)
 const item=await api.dvi.addItem(inspection.id,{status:'REPAIR',description:'Klocki',area:'Hamulce',amount:500})
 await api.dvi.decide(item.id,'APPROVED','Klient')
 const nested=(await api.dvi.list(order.id))[0].items[0]
 assert.equal(nested.proposed_amount,500);assert.equal(nested.decision,'APPROVED')
 const health=await api.vehicleHealth.get(vehicle.id)
 assert.ok(Array.isArray(health.subsystems));assert.ok(Array.isArray(health.actions))
})

test('release and timer return success contracts expected by the UI and stop saves elapsed minutes',async()=>{
 const {cloud,order}=await fixture(),api=await fullApi(cloud)
 const timer=await api.worklog.startAs(order.id,0);assert.equal(timer.ok,true)
 assert.equal((await api.worklog.startAs(order.id,0)).ok,false)
 await api.worklog.stop(timer.id);assert.ok(Number.isFinite((await api.worklog.list(order.id))[0].duration_minutes))
 assert.equal((await api.closeout.complete(order.id)).ok,true)
 assert.equal((await api.orders.get(order.id)).status,'WYDANE')
 await assert.rejects(api.quotes.accept(`pwa-${order.id}`),/Windows/)
})
