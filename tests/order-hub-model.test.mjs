import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {ORDER_FLOW,ORDER_MILESTONES,docCategory,documentationStats,isImageFile,itemCategory,newestFirst,orderFinance,orderProgress,orderSections,partStats,percentShares,vehicleSpecs,vehicleTitle} from '../src/order-hub-model.mjs'

test('progress maps every workflow status to a milestone and marks earlier ones done',()=>{
  for(const status of ORDER_FLOW)assert.ok(ORDER_MILESTONES.some(step=>step.statuses.includes(status)),`status ${status} bez etapu`)
  const repair=orderProgress('NAPRAWA','CZESCI')
  assert.deepEqual(repair.steps.map(step=>step.state),['done','done','done','current','todo','todo','todo'])
  assert.equal(repair.waiting,true)
  assert.equal(repair.waitLabel,'Czeka na części')
  assert.equal(orderProgress('AKCEPTACJA').steps[2].state,'current','akceptacja należy do etapu wyceny')
  const released=orderProgress('WYDANE')
  assert.equal(released.percent,100)
  assert.ok(released.steps.every(step=>step.state==='done'))
  assert.equal(orderProgress('PRZYJETE').percent,0)
  assert.equal(orderProgress('nieznany').steps[0].state,'current','nieznany status nie wysypuje widoku')
  assert.equal(orderProgress('DIAGNOZA','BRAK').waiting,false)
})

test('finance falls back to splitting items by kind for rows without order components',()=>{
  const finance=orderFinance({
    order:{total:1000},
    items:[{kind:'ROBOCIZNA',qty:2,unit_price:150},{kind:'CZESC',qty:1,unit_price:420.5},{kind:'MATERIAL',qty:2,unit_price:10},{kind:'USLUGA_ZEW',qty:1,unit_price:99.5}],
    payments:[{amount:300},{amount:'200.25'}]
  })
  assert.equal(finance.total,1000)
  assert.equal(finance.paid,500.25)
  assert.equal(finance.balance,499.75)
  assert.equal(finance.settled,false)
  assert.equal(finance.paidPercent,50)
  assert.deepEqual(finance.split,{labor:300,parts:440.5,other:99.5})
  assert.equal(finance.itemized,840)
  assert.equal(finance.exact,false)
  assert.equal(finance.adjustments,160,'różnica względem pozycji jest jawna, a nie ukryta')
  assert.equal(finance.shares.labor+finance.shares.parts+finance.shares.other,100)
})

test('finance on a desktop-shaped row: labor items live in other_sale and are shown as labor',()=>{
  // syncOrderItemTotals: parts_sale = CZESC, other_sale = wszystko poza CZESC; labor_hours zostaje 0.
  const items=[{kind:'ROBOCIZNA',qty:2,unit_price:250},{kind:'CZESC',qty:1,unit_price:400},{kind:'USLUGA_ZEW',qty:1,unit_price:120}]
  const order={labor_hours:0,labor_rate:220,parts_sale:400,other_sale:620,diagnosis_fee:150,discount:20,final_price:null,total:400+620+150-20}
  const finance=orderFinance({order,items})
  assert.equal(finance.exact,true)
  assert.deepEqual(finance.split,{labor:500,parts:400,other:120},'robocizna z pozycji nie ląduje w „innych”')
  assert.equal(finance.diagnosis,150)
  assert.equal(finance.discount,20)
  assert.equal(finance.calculated,finance.total,'odtwarza ORDER_BASE_SQL')
  assert.equal(finance.adjustments,0)
  const manual=orderFinance({order:{...order,final_price:1000,total:1000},items})
  assert.equal(manual.finalPriceSet,true)
  assert.equal(manual.adjustments,1000-1150)
})

test('finance keeps legacy order-level labor and honours the PWA legacy_labor rule',()=>{
  const legacy=orderFinance({order:{labor_hours:1.5,labor_rate:200,parts_sale:0,other_sale:0,diagnosis_fee:0,discount:0,total:300}})
  assert.equal(legacy.split.labor,300)
  assert.equal(legacy.adjustments,0)
  // PWA (pwa-data.mjs orderMoney): legacy_labor = 0, gdy istnieją pozycje robocizny.
  const pwa=orderFinance({order:{labor_hours:3,labor_rate:200,legacy_labor:0,parts_sale:0,other_sale:250,diagnosis_fee:0,discount:0,total:250},items:[{kind:'ROBOCIZNA',qty:1,unit_price:250}]})
  assert.equal(pwa.split.labor,250)
  assert.equal(pwa.adjustments,0,'brak fantomowej korekty w PWA')
})

test('free orders are settled and shares always sum to 100',()=>{
  const free=orderFinance({order:{total:0,final_price:0,labor_hours:0,parts_sale:0,other_sale:0,diagnosis_fee:0,discount:0}})
  assert.equal(free.settled,true)
  assert.equal(free.paidPercent,100)
  assert.deepEqual(percentShares([50.5,49.5,0]),{labor:51,parts:49,other:0})
  assert.deepEqual(percentShares([1,1,1]),{labor:34,parts:33,other:33})
  assert.deepEqual(percentShares([0,0,0]),{labor:0,parts:0,other:0})
  for(const values of [[10,20,30],[333,333,334],[0.01,99.99,0]]){const shares=percentShares(values);assert.equal(shares.labor+shares.parts+shares.other,100)}
})

test('one item classifier and newest-first documentation helpers',()=>{
  assert.deepEqual(['ROBOCIZNA','CZESC','MATERIAL','USLUGA_ZEW','',undefined].map(kind=>itemCategory({kind})),['labor','parts','parts','other','other','other'])
  assert.equal(docCategory({category:'naprawa'}),'NAPRAWA')
  assert.equal(docCategory({category:'NIEZNANA'}),'PRZYJECIE')
  assert.deepEqual(newestFirst([{id:1,created_at:'2026-11-01 10:00:00'},{id:2,created_at:'2026-11-03 09:00:00'},{id:3}]).map(file=>file.id),[2,1,3])
})

test('finance handles settled, overpaid, empty and manual final-price orders',()=>{
  const settled=orderFinance({order:{total:500},payments:[{amount:500}]})
  assert.equal(orderFinance({order:{total:500}}).settled,false)
  assert.equal(settled.settled,true)
  assert.equal(settled.balance,0)
  const overpaid=orderFinance({order:{total:100},payments:[{amount:130}]})
  assert.equal(overpaid.overpaid,30)
  assert.equal(overpaid.balance,0)
  assert.equal(overpaid.paidPercent,100)
  const empty=orderFinance()
  assert.deepEqual([empty.total,empty.paid,empty.balance,empty.settled,empty.itemized],[0,0,0,true,0],'brak należności = rozliczone, jak w nagłówku zlecenia')
  assert.deepEqual(empty.shares,{labor:0,parts:0,other:0})
  assert.equal(orderFinance({order:{total:900,final_price:900}}).finalPriceSet,true)
  assert.equal(orderFinance({order:{total:900,final_price:null}}).finalPriceSet,false)
})

test('part stats separate pending orders, mounted parts and closed rows',()=>{
  assert.deepEqual(partStats([{status:'DO_ZAMOWIENIA'},{status:'ZAMOWIONE'},{status:'W_DRODZE'},{status:'ODEBRANE'},{status:'ZAMONTOWANE'},{status:'ANULOWANE'},{status:'ZWROT_ZAKONCZONY'}]),{total:7,open:4,pending:3,mounted:1})
})

test('documentation stats count photos per stage and list missing stages',()=>{
  assert.equal(isImageFile({mime:'image/jpeg',name:'x'}),true)
  assert.equal(isImageFile({name:'IMG_2041.HEIC'}),true)
  assert.equal(isImageFile({name:'faktura.pdf',mime:'application/pdf'}),false)
  const stats=documentationStats([{name:'a.jpg',category:'PRZYJECIE',storage_path:'x'},{name:'b.png',category:'NAPRAWA'},{name:'c.pdf',category:'NAPRAWA'},{name:'d.jpg'}])
  assert.equal(stats.total,4)
  assert.equal(stats.photos,3)
  assert.equal(stats.documents,1)
  assert.equal(stats.cloud,1)
  assert.deepEqual(stats.byCategory.PRZYJECIE,{photos:2,files:0},'brak kategorii = przyjęcie, jak w zakładce Dokumentacja')
  assert.deepEqual(stats.byCategory.NAPRAWA,{photos:1,files:1})
  assert.deepEqual(stats.missing,['DIAGNOZA','WYDANIE'])
})

test('vehicle card data stays readable with partial records',()=>{
  assert.equal(vehicleTitle({make:'Škoda',model:'Octavia'}),'Škoda Octavia')
  assert.equal(vehicleTitle({}),'Pojazd bez opisu')
  assert.deepEqual(vehicleSpecs({generation:'III',year:2016,engine:'2.0 TDI',power_hp:150,engine_code:'CRMB',mileage:201500}).map(([label])=>label),['Generacja','Rocznik','Silnik','Kod silnika','Przebieg'])
  assert.equal(vehicleSpecs({engine:'1.6',power_hp:0}).find(([label])=>label==='Silnik')[1],'1.6')
  assert.deepEqual(vehicleSpecs({mileage:0}),[])
})

test('section tiles route to existing Order Center tabs',()=>{
  const sections=orderSections({repairs:[{id:1}],items:[{kind:'ROBOCIZNA'}],parts:[{status:'ZAMOWIONE'}],files:[],finance:orderFinance({order:{total:200},payments:[{amount:200}]}),procedures:{remaining:2}})
  assert.deepEqual(sections.map(section=>[section.key,section.tab]),[['works','works'],['parts','parts'],['costs','settlement'],['docs','docs']])
  assert.equal(sections[0].tone,'warning','niedokończona procedura jest sygnalizowana')
  assert.equal(sections[1].value,1)
  assert.equal(sections[2].tone,'success')
  assert.equal(sections[3].tone,'warning','brak zdjęć z przyjęcia jest sygnalizowany')
})

test('Order Center keeps smoke-test hooks and wires the new presentational blocks',async()=>{
  const main=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8')
  const center=main.slice(main.indexOf('function OrderCenter('),main.indexOf('function RepairWorkspaceIntro('))
  assert.match(center,/<div className="centerHero orderHero">/)
  assert.match(center,/<h2><span className="orderHeroVehicle">\{o\.make\} \{o\.model\}<\/span> <PlateBadge plate=\{o\.plate\}\/><\/h2>/,'nagłówek nadal zawiera numer rejestracyjny')
  assert.match(center,/<div className="orderTitleRow">/)
  assert.match(center,/<OrderProgress status=\{o\.status\}/)
  assert.match(center,/<OrderSectionTiles sections=\{sections\} activeTab=\{tab\} setTab=\{setTab\}\/>/)
  assert.match(center,/<OrderPhotoDocs files=\{files\} addFiles=\{addOrderFiles\}/,'zdjęcia dodawane istniejącą ścieżką (PC i PWA)')
  assert.match(center,/exportPdf=\{kind=>api\.orders\.exportPdf\(o\.id,kind\)\}/)
  const quickGrid=center.match(/<div className="quickGrid compact">([\s\S]*?)<\/div><\/Panel>/)[1]
  assert.equal((quickGrid.match(/<button/g)||[]).length,4,'szybkie akcje bez zmian (test UI liczy aktywne przyciski)')
})

test('quick intake renders a single vehicle card instead of the duplicated preview',async()=>{
  const intake=await readFile(new URL('../src/quick-intake-screen.jsx',import.meta.url),'utf8')
  assert.equal((intake.match(/IntakeVehicleCard vehicle=/g)||[]).length,1)
  assert.doesNotMatch(intake,/intakeVehiclePhotoPreview/)
})
