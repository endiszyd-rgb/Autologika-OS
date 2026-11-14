import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {BAY_KINDS,RING_LENGTH,bayEquipment,bayView,buildActions,buildBays,buildPulse,closedOn,easeOutCubic,filterNews,greeting,initials,newsView,orderKind,orderProgress,pulsePaths,refreshedLabel,tickerItems,whenLabel} from '../src/hala/hala-model.mjs'

const now=new Date(2026,10,14,10,52)
const at=(hours,minutes=0,day=14)=>new Date(2026,10,day,hours,minutes).toISOString()
const orders=[
 {id:11,cloud_id:'c-11',make:'Volkswagen',model:'Passat B8',plate:'WE 4521K',title:'Wymiana DPF + adaptacja',status:'NAPRAWA',wait_state:'BRAK',complaint:'Kontrolka DPF.',due_at:at(15,30),phone:'500600700'},
 {id:12,cloud_id:'c-12',make:'BMW',model:'330d F30',plate:'WX 88210',title:'Stage 1',status:'QC_NAPRAWY',wait_state:'CZESCI',due_at:at(9,0)},
 {id:13,cloud_id:'c-13',make:'Audi',model:'A6 C7',plate:'PO 1A',title:'EGR',status:'PRZYJETE',wait_state:'BRAK'}
]
const settings={greetingName:'Endi',workshopName:'Nitropoint',assignments:{'Stanowisko 1':{orderCloudId:'c-11',orderId:'11'},'Diagnostyka':{orderCloudId:'c-12',orderId:'12'},'Plac / oczekuje':{orderCloudId:'c-wydane',orderId:'99'}}}
const appointments=[
 {id:1,order_id:11,bay:'Stanowisko 1',start_at:at(8),end_at:at(12,40)},
 {id:2,order_id:13,bay:'Stanowisko 1',make:'Fiat',model:'Ducato',title:'olej + filtry',start_at:at(13),end_at:at(14)},
 {id:3,order_id:13,bay:'Diagnostyka',make:'Audi',model:'A6',title:'EGR',start_at:at(9,0,16),end_at:at(11,0,16)}
]
const active=[{order_id:12,worker:'Endi Nowak',started_at:at(9)}]
const bayNames=['Stanowisko 1','Diagnostyka','Plac / oczekuje','Stanowisko 2']

test('bays combine assignment, order, appointment and active timer',()=>{
 const bays=buildBays({bayNames,settings,orders,appointments,active,labels:{NAPRAWA:'Naprawa',QC_NAPRAWY:'Kontrola naprawy'},now})
 assert.equal(bays.length,4)
 const [lift,diag,yard,free]=bays
 assert.equal(lift.car,'Volkswagen Passat B8')
 assert.equal(lift.kind,'work')
 assert.equal(lift.status,'Naprawa')
 assert.equal(lift.eta,'12:40','koniec z wizyty w terminarzu')
 assert.equal(lift.nextCar,'Fiat Ducato · olej + filtry')
 assert.equal(lift.nextAt,'13:00')
 assert.equal(lift.lift,true)
 assert.equal(lift.mech,'','bez timera nie zgadujemy mechanika')
 assert.equal(lift.orderId,11)
 assert.equal(diag.kind,'wait')
 assert.equal(diag.status,'Kontrola naprawy · czeka na części')
 assert.equal(diag.scan,true)
 assert.equal(diag.lift,false)
 assert.equal(diag.mech,'Endi Nowak')
 assert.equal(diag.ini,'EN')
 assert.equal(diag.nextAt,'pon. 09:00')
 assert.equal(yard.free,true,'zlecenie wydane/nieznane zwalnia stanowisko')
 assert.equal(yard.stale,true)
 assert.equal(free.free,true)
 assert.equal(free.stale,false)
 assert.equal(free.status,'Wolne')
})

test('assignment by cloud id is not confused with local ids from another computer',()=>{
 const bays=buildBays({bayNames:['A'],settings:{assignments:{A:{orderCloudId:'inny',orderId:'11'}}},orders,now})
 assert.equal(bays[0].free,true)
 const pwa=buildBays({bayNames:['A'],settings:{assignments:{A:{orderCloudId:'c-13',orderId:''}}},orders:[{...orders[2],id:'c-13',cloud_id:undefined}],now})
 assert.equal(pwa[0].free,false,'w PWA id zlecenia to cloud_id')
})

test('progress, kinds, equipment and time labels',()=>{
 assert.equal(orderProgress('PRZYJETE'),0)
 assert.equal(orderProgress('GOTOWE'),100)
 assert.equal(orderProgress('NAPRAWA'),50)
 assert.equal(orderProgress('???'),0)
 assert.equal(orderKind({status:'GOTOWE',wait_state:'BRAK'}),'done')
 assert.equal(orderKind(null),'free')
 assert.deepEqual(bayEquipment('Plac / oczekuje'),{scan:false,lift:false})
 assert.deepEqual(bayEquipment('Stanowisko 2'),{scan:false,lift:true})
 assert.equal(whenLabel(at(9,0,15),now),'jutro 09:00')
 assert.equal(whenLabel(at(9,0,30),now),'30.11')
 assert.equal(whenLabel('',now),'—')
})

test('bay view counts up progress and ring like the mockup renderVals()',()=>{
 const [bay]=buildBays({bayNames:['Stanowisko 1'],settings,orders,now})
 const start=bayView(bay,{t:0}),end=bayView(bay,{t:1,picked:true})
 assert.equal(start.pctLabel,'0%')
 assert.equal(start.dash,RING_LENGTH)
 assert.equal(end.pctLabel,'50%')
 assert.equal(end.picked,true)
 assert.equal(end.carClass,'halaCarLift')
 assert.equal(bayView({kind:'nieznany',pct:'abc'}).glow,BAY_KINDS.work.glow)
 assert.equal(bayView({kind:'free',free:true}).carClass,'')
 assert.equal(easeOutCubic(1),1)
})

test('greeting uses settings, occupancy, next pickup and revenue of orders closed today',()=>{
 const bays=buildBays({bayNames,settings,orders,now})
 const closed=closedOn([{id:1,closed_at:at(9),total:1200},{id:1,closed_at:at(9),total:1200},{id:2,closed_at:at(9,0,13),total:999},{id:3,closed_at:at(10),final_price:3660,total:1}],now)
 const hello=greeting({settings,bays,orders,closedToday:closed,now})
 assert.equal(hello.title,'Dzień dobry, Endi')
 assert.equal(hello.workshop,'NITROPOINT')
 assert.equal(hello.occupancy,'Zajęte 2 z 4 stanowisk')
 assert.equal(hello.nextPickup,'15:30','odbiór 9:00 już minął')
 assert.equal(hello.revenue,4860,'duplikaty i wczorajsze pomijamy, final_price ma pierwszeństwo')
 assert.equal(greeting({now:new Date(2026,10,14,19)}).title,'Dobry wieczór')
 assert.equal(initials('Paweł Kowalski'),'PK')
})

test('actions come from the attention list, most urgent first',()=>{
 const rows=[
  {kind:'WAIT',order_id:5,make:'Audi',model:'A6',plate:'PO 1A',text:'CZESCI',customer:'Jan',created_at:'2026-11-12T08:00:00Z'},
  {kind:'PART_LATE',order_id:6,make:'VW',model:'Golf',text:'Zawór EGR',created_at:'2026-11-13T08:00:00Z'},
  {kind:'APPROVAL',order_id:7,make:'Mercedes',model:'Vito',text:'APPROVED',created_at:'2026-11-14T08:00:00Z'},
  {kind:'REPLY',order_id:8,make:'Fiat',model:'Panda',created_at:'2026-11-14T09:00:00Z'}
 ]
 const actions=buildActions(rows,{now:now.getTime()})
 assert.equal(actions.length,3)
 assert.equal(actions[0].title,'VW Golf — Spóźniona część: Zawór EGR')
 assert.equal(actions[0].tone,'rose')
 assert.ok(actions.some(action=>action.title==='Mercedes Vito — Klient zaakceptował kosztorys'&&action.tone==='green'))
 assert.ok(actions.every(action=>action.orderId))
 assert.deepEqual(buildActions([]),[])
})

test('pulse shows bay load per working hour and the current time',()=>{
 const pulse=buildPulse({appointments,bayCount:2,openingHour:8,closingHour:18,now})
 assert.equal(pulse.points.length,11)
 assert.equal(pulse.points[0],.5,'8:00–9:00: jedna wizyta na dwa stanowiska')
 assert.equal(pulse.points[5],.5,'13:00–14:00')
 assert.equal(pulse.points[7],0)
 assert.ok(pulse.now>.25&&pulse.now<.3)
 assert.deepEqual(pulse.axis,['08','13','18'])
 assert.equal(buildPulse({now:new Date(2026,10,14,22)}).now,null)
 const paths=pulsePaths(pulse.points)
 assert.match(paths.line,/^M0 39 /)
 assert.match(paths.area,/L400 90 L0 90Z$/)
 assert.deepEqual(pulsePaths([1]),{line:'',area:''})
})

test('news view, ticker and refresh label',()=>{
 const feed={items:[{id:'a',title:'Nowy taryfikator',category:'PRZEPISY',label:'PRZEPISY',publishedAt:now.toISOString()},{id:'b',title:'Remap',category:'TUNING',label:'TUNING',publishedAt:'2026-11-10T10:00:00Z'}],rates:[{code:'EUR',mid:4.407,date:'2026-11-13'}]}
 assert.equal(newsView(feed.items[0],now).date,'dziś')
 assert.equal(newsView(feed.items[0],now).icon,'lines')
 assert.equal(filterNews(feed.items,'TUNING').length,1)
 const ticker=tickerItems(feed)
 assert.equal(ticker[0].label,'EUR/PLN')
 assert.equal(ticker[0].value,'4,4070')
 assert.equal(ticker[0].note,'NBP 13 XI')
 assert.equal(ticker.length,3)
 assert.deepEqual(tickerItems({}),[])
 assert.equal(refreshedLabel(new Date(2026,10,14,14,30)),'odświeżono 14.11 · 14:30')
 assert.equal(refreshedLabel('zła data'),'brak danych')
})

test('Hala screen keeps the brief constraints and is wired to real data',async()=>{
 const source=await readFile(new URL('../src/hala/HalaPage.jsx',import.meta.url),'utf8')
 const css=await readFile(new URL('../src/hala/hala.css',import.meta.url),'utf8')
 for(const part of ['function BayMap','function BayDetails','function NewsFeed','function ActionList','function OrderPicker','useHala({','useNewsFeed(api)'])assert.ok(source.includes(part),part)
 assert.doesNotMatch(source,/MOCK_/,'brak danych z makiety')
 assert.doesNotMatch(source,/Droga zlecenia/,'sekcja „Droga zlecenia” jest świadomie usunięta')
 assert.doesNotMatch(source,/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,'bez emoji jako ikon')
 assert.doesNotMatch(source,/<aside|<header /,'globalne style aside/header aplikacji psują układ')
 assert.match(css,/--hala-accent:#F43F5E/)
 assert.match(css,/@container \(max-width:900px\)[^}]*grid-template-columns:minmax\(0,1fr\)/)
 const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8')
 assert.ok(main.includes("(page==='dashboard'||page==='hala')&&<Deferred><HalaPage"),'Pulpit pokazuje ekran Hali')
 assert.doesNotMatch(main,/WorkshopDashboard/,'stary pulpit usunięty z menu')
 const preload=await readFile(new URL('../electron/preload.cjs',import.meta.url),'utf8'),pwa=await readFile(new URL('../src/platform/pwa-api.js',import.meta.url),'utf8')
 for(const method of ["hala:()=>","setHala:","news: { feed:"])assert.ok(preload.includes(method),`preload ${method}`)
 for(const method of ['hala:async','setHala:async','news:{feed:'])assert.ok(pwa.includes(method),`PWA ${method}`)
})

test('bay labels follow the names from settings',async()=>{
 const {bayLabel}=await import('../src/hala/hala-model.mjs')
 assert.equal(bayLabel('Stanowisko 2',3),'STANOWISKO 02','numer z nazwy, nie z kolejności')
 assert.equal(bayLabel('Diagnostyka',2),'03 · DIAGNOSTYKA')
})

test('SQLite UTC timestamps count toward the right local day',()=>{
 const utcNow=new Date('2026-11-14T10:00:00Z')
 const rows=closedOn([{id:1,closed_at:'2026-11-14 09:00:00'},{id:2,closed_at:'2026-11-13 09:00:00'}],utcNow)
 assert.deepEqual(rows.map(row=>row.id),[1])
})
