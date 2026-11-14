import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {CAPTURE_STEPS,STOCK_FILTERS,captureStep,deliveryLineTotal,deliveryPreview,deliveryReviewSummary,deliveryStats,filterCounts,filterDeliveries,filterStock,isLowStock,partStatusTone,stepQuantity,stockLevel,stockSummary,stockValue} from '../src/parts-model.mjs'

const parts=[
 {id:1,name:'Filtr oleju',stock:4,min_stock:2,unit_cost:24.5,location:'A-03'},
 {id:2,name:'Klocki hamulcowe',stock:1,min_stock:2,unit_cost:120,location:''},
 {id:3,name:'Amortyzator',stock:0,min_stock:1,unit_cost:300,location:'B-01'},
 {id:4,name:'Żarówka H7',stock:'10',min_stock:null,unit_cost:'8.5',location:null}
]

test('stock level keeps the existing low-stock rule (stock <= minimum) and separates empty shelves',()=>{
 assert.equal(stockLevel(parts[0]).state,'ok')
 assert.equal(stockLevel(parts[1]).state,'low')
 assert.equal(stockLevel(parts[2]).state,'out')
 assert.equal(stockLevel({stock:0,min_stock:0}).state,'out','zero sztuk to brak, nawet bez minimum')
 assert.equal(isLowStock({stock:0,min_stock:0}),true,'zgodnie z dotychczasowym licznikiem „Niski stan”')
 assert.equal(stockLevel({stock:2,min_stock:2}).state,'low','stan równy minimum wymaga uzupełnienia')
 const meter=stockLevel(parts[0])
 assert.equal(meter.percent,100)
 assert.equal(meter.minMark,50)
 assert.equal(stockLevel(parts[2]).percent,0)
 assert.equal(stockLevel({stock:'abc'}).percent,0,'niepoprawna liczba nie wysypuje karty')
 assert.equal(isLowStock({stock:undefined,min_stock:2}),false,'brak wartości nie jest niskim stanem — jak w dotychczasowym liczniku')
})

test('summary counts value, units, shortages and missing locations',()=>{
 const summary=stockSummary(parts)
 assert.deepEqual(summary,{positions:4,units:15,value:4*24.5+120+0+85,low:2,out:1,noLocation:2})
 assert.equal(stockValue(parts[3]),85)
 assert.deepEqual(stockSummary(),{positions:0,units:0,value:0,low:0,out:0,noLocation:0})
})

test('filters and sorting are presentation-only and do not mutate the loaded rows',()=>{
 const before=parts.map(row=>row.id)
 assert.deepEqual(filterStock(parts,{filter:'LOW'}).map(row=>row.id),[3,2])
 assert.deepEqual(filterStock(parts,{filter:'OUT'}).map(row=>row.id),[3])
 assert.deepEqual(filterStock(parts,{filter:'NO_LOCATION'}).map(row=>row.id),[2,4])
 assert.deepEqual(filterStock(parts,{sort:'stock'}).map(row=>row.id),[3,2,1,4])
 assert.deepEqual(filterStock(parts,{sort:'value'}).map(row=>row.id),[2,1,4,3])
 assert.deepEqual(filterStock(parts,{sort:'location'}).map(row=>row.id),[1,3,2,4],'puste lokalizacje na końcu')
 assert.deepEqual(filterStock(parts,{filter:'nieznany',sort:'nieznany'}).length,4)
 assert.deepEqual(parts.map(row=>row.id),before)
 assert.deepEqual(filterCounts(parts),{ALL:4,LOW:2,OUT:1,NO_LOCATION:2})
 assert.deepEqual(STOCK_FILTERS.map(([key])=>key),Object.keys(filterCounts([])))
})

const deliveries=[
 {id:1,supplier_name:'XENO-ŚWIST',document_no:'3/WZ/2026/124',document_date:'2026-09-29',gross_total:180,items_gross_total:180,item_count:2,quantity:3,items:[{part_no:'M2H-254',name:'Drążek kierowniczy',qty:2,gross_total:61.99},{part_no:'K2-K156',name:'Płyn do opon',qty:1,gross_total:118.01}],file_path:'C:/scan.jpg'},
 {id:2,supplier_name:'Inter Cars',document_no:'FV 77/2026',gross_total:250,items_gross_total:0,items:[{part_no:'W 712/95',name:'Filtr oleju',qty:4,unit_cost:20}]},
 {id:3,supplier_name:'',document_no:'',items:[]}
]

test('delivery search keeps the previous fields and adds a supplier filter',()=>{
 assert.deepEqual(filterDeliveries(deliveries,{query:'m2h'}).map(row=>row.id),[1],'numer części z pozycji')
 assert.deepEqual(filterDeliveries(deliveries,{query:'świst'}).map(row=>row.id),[1],'polskie znaki bez względu na wielkość liter')
 assert.deepEqual(filterDeliveries(deliveries,{query:'filtr'}).map(row=>row.id),[2])
 assert.deepEqual(filterDeliveries(deliveries,{supplier:'Inter Cars'}).map(row=>row.id),[2])
 assert.equal(filterDeliveries(deliveries).length,3)
 const stats=deliveryStats(deliveries)
 assert.equal(stats.documents,3)
 assert.equal(stats.gross,430)
 assert.equal(stats.quantity,3)
 assert.deepEqual(stats.suppliers,['Inter Cars','XENO-ŚWIST'])
})

test('delivery preview reconciles item totals with the document value',()=>{
 const balanced=deliveryPreview(deliveries[0])
 assert.equal(balanced.balanced,true)
 assert.equal(balanced.hasScan,true)
 assert.equal(balanced.itemCount,2)
 const computed=deliveryPreview(deliveries[1])
 assert.equal(computed.itemsTotal,80,'brak sumy pozycji = ilość × cena zakupu')
 assert.equal(computed.difference,170)
 assert.equal(computed.balanced,false)
 assert.equal(computed.hasScan,false)
 assert.equal(computed.quantity,4)
 assert.equal(deliveryLineTotal({qty:2,unit_cost:5}),10)
 const empty=deliveryPreview()
 assert.deepEqual([empty.itemCount,empty.quantity,empty.balanced],[0,0,true])
})

test('mobile capture steps and review summary follow the scan flow',()=>{
 assert.equal(CAPTURE_STEPS.length,4)
 assert.equal(captureStep({}),0)
 assert.equal(captureStep({file:{},ocrBusy:true}),1)
 assert.equal(captureStep({file:{},ocrBusy:false,ocr:null}),1,'nieudany odczyt zostaje na etapie odczytu')
 assert.equal(captureStep({file:{},ocr:{items:[]}}),2)
 assert.equal(captureStep({file:{},ocr:{},saved:true}),4)
 assert.equal(captureStep({file:{},ocr:{},busy:true}),3,'zapis w toku = etap przyjęcia')
 const summary=deliveryReviewSummary({items:[{qty:2,unit_cost:10,confidence:'CHECK'},{qty:'1.5',unit_cost:4},{qty:3,unit_cost:1,enabled:false}]})
 assert.deepEqual(summary,{total:3,selected:2,quantity:3.5,net:26,toCheck:1,invalid:1})
 assert.deepEqual(deliveryReviewSummary(null),{total:0,selected:0,quantity:0,net:0,toCheck:0,invalid:0})
 assert.equal(stepQuantity(1,-1),1,'ilość nie spada poniżej 1')
 assert.equal(stepQuantity('3',1),4)
 assert.equal(stepQuantity('',1),1)
})

test('job part statuses map to design-system tones',()=>{
 assert.equal(partStatusTone('DO_ZAMOWIENIA'),'warning')
 assert.equal(partStatusTone('W_DRODZE'),'violet')
 assert.equal(partStatusTone('DO_ZWROTU'),'danger')
 assert.equal(partStatusTone('???'),'neutral')
})

test('parts workspace keeps smoke-test hooks and existing actions',async()=>{
 const source=await readFile(new URL('../src/parts-workspace.jsx',import.meta.url),'utf8')
 const tabs=source.match(/PARTS_TABS=\[(.*)\]/)[1]
 assert.deepEqual([...tabs.matchAll(/\['(\w+)'/g)].map(match=>match[1]),['STOCK','ORDERS','DELIVERIES'],'kolejność zakładek używana przez test UI')
 assert.doesNotMatch(source,/className=\{'stockCard [^>]*role="button"/,'karta nie zagnieżdża przycisków w role=button')
 for(const hook of ['className="stockCardSelect"','className="stockScan"','className="stockScan partNumberScan"','className="issueAction"','>Usuń</button>','>−1</button>','>+1 przyjęta</button>','className="deliveryHistoryCard"','stockLookupMessage'])assert.ok(source.includes(hook),hook)
 for(const call of ['api.inventory.adjust(row.id,delta)','api.inventory.issue(part.id,Number(orderId),amount,oeNumber)','api.inventory.remove(row.id)','api.deliveryDocuments.open(row.id)','api.inventory.lookupBarcode(code,{force})'])assert.ok(source.includes(call),call)
 const hero=source.indexOf('className="stockHero'),search=source.indexOf('className="stockSearch"')
 assert.ok(hero>0&&hero<search,'pole kodu EAN pozostaje pierwszym polem strony (globalny skaner)')
})

test('mobile capture keeps camera/gallery inputs and exact action labels used by the PWA audit',async()=>{
 const source=await readFile(new URL('../src/platform/pwa-document-capture.jsx',import.meta.url),'utf8')
 const camera=source.indexOf('capture="environment"'),gallery=source.indexOf('aria-label="Wybierz dokument z galerii"')
 assert.ok(camera>0&&gallery>camera,'aparat przed galerią')
 for(const label of ["'Przyjmij części do magazynu'","'Zapisz dokument'","'Przejdź do magazynu'","'Gotowe'","'Dostawa przyjęta do magazynu'","'Dokument zapisany w chmurze'"])assert.ok(source.includes(label),label)
 const review=await readFile(new URL('../src/platform/pwa-delivery-review.jsx',import.meta.url),'utf8')
 assert.ok(review.includes("'pwaDeliveryItem'"))
 assert.doesNotMatch(review,/role="alert"/,'ostrzeżenia odczytu nie są traktowane jak błąd OCR')
})
