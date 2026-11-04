import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {startPwaSync} from '../src/platform/pwa-sync.mjs'
const source=(await readFile(new URL('../src/platform/pwa-client.js',import.meta.url),'utf8')).replace("'./pwa-identifiers.mjs'",JSON.stringify(new URL('../src/platform/pwa-identifiers.mjs',import.meta.url).href)).replaceAll('import.meta.env','({})')
globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}}
const {PwaCloudClient}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}}
const fixture=()=>{const cloud=new PwaCloudClient();cloud.session={user:{id:'workshop'},access_token:'test',refresh_token:'refresh'};cloud.loaded=true;cloud.request=async(_path,options)=>options.method==='GET'?[]:JSON.parse(options.body);return cloud}

test('cloud relations override numeric IDs left by another device and payload cannot replace record identity',()=>{
 const cloud=fixture(),row=cloud.hydrate('vehicles',{cloud_id:'vehicle-cloud',payload:{id:15,cloud_id:'wrong',customer_id:3,customer_cloud_id:'customer-cloud'}})
 assert.equal(row.id,cloud.indexLocalId('vehicles','vehicle-cloud'));assert.equal(row.cloud_id,'vehicle-cloud');assert.equal(row.customer_id,cloud.indexLocalId('customers','customer-cloud'))
})
test('write strips local relation IDs and updates owner using a cloud ID',async()=>{
 const cloud=fixture(),id=cloud.indexLocalId('customers','new-owner');let written
 cloud.request=async(_path,options)=>options.method==='GET'?[]:(written=JSON.parse(options.body))
 await cloud.upsert('vehicles',{customer_id:id,plate:'ZPL'},'vehicle')
 assert.equal(written[0].payload.customer_cloud_id,'new-owner');assert.equal(written[0].payload.customer_id,undefined)
})
test('concurrent sync requests share one fetch even with force=true',async()=>{
 const cloud=fixture(),gate=deferred();let calls=0
 cloud.request=async()=>{calls++;return gate.promise}
 const first=cloud.sync(),second=cloud.sync(true);gate.resolve([]);await Promise.all([first,second]);assert.equal(calls,1)
})
test('a slow snapshot cannot erase a write completed during synchronization',async()=>{
 const cloud=fixture(),gate=deferred()
 cloud.request=async(path,options)=>path.includes('select=entity_type')?gate.promise:options.method==='GET'?[]:JSON.parse(options.body)
 const syncing=cloud.sync();await cloud.upsert('customers',{name:'Nowy klient'},'new-customer');gate.resolve([]);await syncing
 assert.equal((await cloud.list('customers'))[0].name,'Nowy klient')
})
test('a slow snapshot cannot restore a locally deleted record',async()=>{
 const cloud=fixture();await cloud.upsert('customers',{name:'Klient'},'old')
 const old=cloud.records.get(cloud.key('customers','old')),gate=deferred()
 cloud.request=async path=>path.includes('select=entity_type')?gate.promise:[]
 const syncing=cloud.sync();await cloud.remove('customers','old');gate.resolve([old]);await syncing
 assert.equal((await cloud.list('customers')).length,0)
})
test('logging out while sync is running cannot repopulate the previous workshop data',async()=>{
 const cloud=fixture(),gate=deferred();cloud.request=async()=>gate.promise
 const syncing=cloud.sync();cloud.logout();gate.resolve([{entity_type:'customers',cloud_id:'private',payload:{name:'Poprzedni warsztat'}}])
 await assert.rejects(syncing,/Sesja/);assert.equal(cloud.records.size,0);assert.equal(cloud.authenticated,false)
})
test('parallel token refresh is single-flight and transient failure preserves the session',async()=>{
 const cloud=fixture(),gate=deferred();let calls=0;cloud.auth=async()=>{calls++;return gate.promise}
 const first=cloud.refresh(),second=cloud.refresh();gate.resolve({access_token:'new',refresh_token:'new-refresh',expires_in:3600});await Promise.all([first,second]);assert.equal(calls,1)
 cloud.auth=async()=>{throw new Error('Brak sieci')};await assert.rejects(cloud.refresh(),/Brak sieci/);assert.equal(cloud.authenticated,true)
 cloud.auth=async()=>{throw Object.assign(new Error('Invalid refresh token'),{status:400})};await assert.rejects(cloud.refresh());assert.equal(cloud.authenticated,false)
})
test('parallel writes to one row serialize without losing either edited field',async()=>{
 const cloud=fixture();await cloud.upsert('customers',{name:'Jan',phone:'123'},'customer')
 await Promise.all([cloud.upsert('customers',{name:'Adam'},'customer'),cloud.upsert('customers',{phone:'456'},'customer')])
 assert.equal((await cloud.get('customers','customer')).name,'Adam');assert.equal((await cloud.get('customers','customer')).phone,'456')
})
test('desktop JSON arrays, labor and attachment fields hydrate into renderer contracts',()=>{
 const cloud=fixture(),hydrate=(entity,payload)=>cloud.hydrate(entity,{cloud_id:'test',payload})
 assert.deepEqual(hydrate('work_templates',{pre_json:'["Kontrola"]'}).pre,['Kontrola'])
 assert.equal(hydrate('order_items',{kind:'ROBOCIZNA',qty:1.5,unit_price:0,labor_rate:999}).labor_rate,0)
 assert.equal(hydrate('attachments',{name:'a.jpg',mime:'image/jpeg',size_bytes:10}).original_name,'a.jpg')
 assert.equal(hydrate('order_qc',{checked:'0'}).checked,false)
 assert.deepEqual(hydrate('work_resources',{work_calendar_json:'{"weekdays":[1,2]}' }).calendar.weekdays,[1,2])
})
test('service-role JWT and secret Supabase keys are refused in browser config',()=>{
 const cloud=fixture();cloud.url='https://test.supabase.co'
 const jwt=role=>`eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`
 cloud.apiKey=jwt('service_role');assert.equal(cloud.configured,false)
 cloud.apiKey='sb_secret_very_long_secret_123456';assert.equal(cloud.configured,false)
 cloud.apiKey=jwt('anon');assert.equal(cloud.configured,true)
})
test('resume refreshes cloud and teardown removes timers and listeners',async()=>{
 const win=new EventTarget(),doc=new EventTarget();doc.hidden=false;let tick,calls=0,cleared=false
 win.setInterval=callback=>{tick=callback;return 1};win.clearInterval=()=>{cleared=true}
 const cloud={authenticated:true,online:true,sync:async()=>{calls++}},stop=startPwaSync(cloud,{window:win,document:doc})
 assert.equal(calls,1);win.dispatchEvent(new Event('pageshow'));doc.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,3)
 doc.hidden=true;tick();assert.equal(calls,3);stop();doc.hidden=false;win.dispatchEvent(new Event('pageshow'));assert.equal(calls,3);assert.equal(cleared,true)
})

test('queued write indicator counts pending work and clears after a failure',async()=>{
 const cloud=fixture(),gate=deferred(),events=[];cloud.subscribe(event=>events.push(event.type))
 const first=cloud.mutate(()=>gate.promise),second=cloud.mutate(()=>{throw new Error('Offline')})
 assert.equal(cloud.pendingWrites,2);gate.resolve('saved');assert.equal(await first,'saved');await assert.rejects(second,/Offline/);assert.equal(cloud.pendingWrites,0);assert.equal(events.filter(type=>type==='write-activity').length,4)
})
