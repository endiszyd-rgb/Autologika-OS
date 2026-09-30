const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {parseDeliveryDocument,importDeliveryDocument,mergeDocumentRows}=require('../electron/delivery-document.cjs')

const sample=`
XENO-ŚWIST Danuta Świst
Wydanie zewnętrzne nr: 3/WZ/2025/16969
Data dostawy/wykonania usługi 10/12/2025
Lp. Kod towaru Nazwa towaru/usługi Ilość J.M Cena jedn Netto Wartość Netto VAT Kwota Wartość Brutto
1 KTCZETR1345 USZCZELNIACZ PÓŁOSI FORD 2.00 SZT 17.89 35.78 23 8.23 44.01
2 KTMANHU726/2X FILTR OLEJU 1.00 SZT 16.27 16.27 23 3.74 20.01
3 KTFEB21622 FILTR PALIWA AUDI FIAT SKODA VW 1.00 SZT 30.08 30.08 23 6.92 37.00
Razem: 82.13 18.89 101.02
Wartość dokumentu:101.02
10/12/2025 Zapłacono gotówką 101.02 PLN
`

test('parses a Polish delivery note into inventory rows',()=>{
 const parsed=parseDeliveryDocument(sample)
 assert.equal(parsed.supplier_name,'XENO-ŚWIST Danuta Świst')
 assert.equal(parsed.document_no,'3/WZ/2025/16969')
 assert.equal(parsed.document_date,'2025-12-10')
 assert.equal(parsed.gross_total,101.02)
 assert.deepEqual(parsed.items.map(row=>[row.part_no,row.name,row.qty,row.unit_cost,row.gross_total]),[
  ['KTCZETR1345','USZCZELNIACZ PÓŁOSI FORD',2,17.89,44.01],
  ['KTMANHU726/2X','FILTR OLEJU',1,16.27,20.01],
  ['KTFEB21622','FILTR PALIWA AUDI FIAT SKODA VW',1,30.08,37]
 ])
 assert.deepEqual(parsed.warnings,[])
})

test('flags an incomplete OCR table when row totals do not match the document',()=>{
 const parsed=parseDeliveryDocument(sample.replace('2 KTMANHU726/2X FILTR OLEJU 1.00 SZT 16.27 16.27 23 3.74 20.01\n',''))
 assert.match(parsed.warnings.join(' '),/pominął wiersza/)
})

test('second OCR pass adds a missed row without merging different filters at the same price',()=>{
 const primary={items:[{part_no:'S11-1002',name:'FILTR KABINOWY Z WĘGLEM',qty:1,gross_total:23,confidence:'GOOD'}]}
 const detail={items:[{part_no:'S11-4001',name:'FILTR POWIETRZA',qty:1,gross_total:23,confidence:'GOOD'}]}
 assert.deepEqual(mergeDocumentRows(primary,detail).map(row=>row.part_no),['S11-1002','S11-4001'])
})

test('imports new rows, increments an existing part and blocks a duplicate document',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,notes TEXT);
  CREATE TABLE purchase_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,supplier_id INTEGER,status TEXT,ordered_at TEXT,notes TEXT,external_document_no TEXT,document_date TEXT,source_file TEXT,source_hash TEXT,gross_total REAL);
  CREATE UNIQUE INDEX idx_purchase_orders_source_hash ON purchase_orders(source_hash) WHERE source_hash IS NOT NULL AND source_hash!='';
  CREATE TABLE purchase_order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,purchase_order_id INTEGER,inventory_part_id INTEGER,part_no TEXT,name TEXT,qty REAL,unit_cost REAL,received_qty REAL);
  CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY AUTOINCREMENT,part_no TEXT,name TEXT,category TEXT,lookup_source TEXT,stock REAL,min_stock REAL,unit_cost REAL,sell_price REAL,supplier_id INTEGER,notes TEXT,updated_at TEXT);
  INSERT INTO inventory_parts(part_no,name,stock,unit_cost,sell_price) VALUES ('KTCZETR1345','Uszczelniacz półosi',3,15,22);
 `)
 db.transaction=fn=>()=>fn()
 const document=parseDeliveryDocument(sample)
 const payload={source_hash:'abc123',source_file:'C:/scan.jpg',document}
 const result=importDeliveryDocument(db,payload)
 assert.equal(result.created,2)
 assert.equal(result.updated,1)
 assert.equal(result.item_count,3)
 assert.equal(db.prepare("SELECT stock FROM inventory_parts WHERE part_no='KTCZETR1345'").get().stock,5)
 assert.equal(db.prepare('SELECT COUNT(*) count FROM purchase_order_items').get().count,3)
 assert.throws(()=>importDeliveryDocument(db,payload),/już przyjęty/)
 assert.throws(()=>importDeliveryDocument(db,{...payload,source_hash:'different-photo'}),/tego dostawcy został już przyjęty/)
 db.close()
})

test('delivery import rejects fractional quantities of parts',()=>{
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE suppliers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,notes TEXT);
  CREATE TABLE purchase_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,supplier_id INTEGER,status TEXT,ordered_at TEXT,notes TEXT,external_document_no TEXT,document_date TEXT,source_file TEXT,source_hash TEXT,gross_total REAL);
  CREATE TABLE purchase_order_items(id INTEGER PRIMARY KEY AUTOINCREMENT,purchase_order_id INTEGER,inventory_part_id INTEGER,part_no TEXT,name TEXT,qty REAL,unit_cost REAL,received_qty REAL);
  CREATE TABLE inventory_parts(id INTEGER PRIMARY KEY AUTOINCREMENT,part_no TEXT,name TEXT,category TEXT,lookup_source TEXT,stock REAL,min_stock REAL,unit_cost REAL,sell_price REAL,supplier_id INTEGER,notes TEXT,updated_at TEXT);
 `)
 db.transaction=fn=>()=>fn()
 const document=parseDeliveryDocument(sample)
 document.items[0].qty=1.97
 assert.throws(()=>importDeliveryDocument(db,{source_hash:'fractional',source_file:'C:/scan.jpg',document}),/liczbą całkowitą/)
 db.close()
})
