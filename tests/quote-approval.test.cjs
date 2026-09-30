const { test } = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const fs = require('node:fs')
const vm = require('node:vm')
const { findQuoteApproval, assertQuoteEditable, replaceQuoteWithOrderSnapshot, materializeApprovedQuote } = require('../electron/quote-approval.cjs')
const { requireEditableOrder } = require('../electron/inventory-usage.cjs')
const { wholePartQuantity } = require('../electron/part-quantity.cjs')

function setup(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  // Use the application's schema and IPC callbacks, without launching Electron.
  const schema = fs.readFileSync(require.resolve('../electron/db.cjs'), 'utf8')
  for (const table of ['vehicles', 'orders', 'quotes', 'quote_items', 'approvals', 'order_events', 'order_items', 'job_part_orders']) {
    db.exec(schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\);`))[0])
  }
  for(const [name,type] of [['oe_number','TEXT'],['inventory_part_id','INTEGER'],['vehicle_snapshot','TEXT'],['supplier_name','TEXT'],['barcode','TEXT'],['brand','TEXT'],['vehicle_fitment','TEXT'],['cross_numbers','TEXT'],['lookup_source','TEXT'],['lookup_url','TEXT']])db.exec(`ALTER TABLE job_part_orders ADD COLUMN ${name} ${type}`)
  db.exec('ALTER TABLE vehicles ADD COLUMN generation TEXT; ALTER TABLE vehicles ADD COLUMN engine_code TEXT')
  db.exec("ALTER TABLE orders ADD COLUMN wait_state TEXT DEFAULT 'BRAK'")
  db.exec("PRAGMA foreign_keys=OFF; INSERT INTO vehicles(id,customer_id,plate,make,model) VALUES (1,1,'PO 12345','Audi','A4'); INSERT INTO orders(id,vehicle_id,title) VALUES (1,1,'Test'); INSERT INTO quotes(id,order_id) VALUES (1,1),(10,1)")
  db.transaction = fn => (...args) => { db.exec('BEGIN'); try { const value=fn(...args); db.exec('COMMIT'); return value } catch(error) { db.exec('ROLLBACK'); throw error } }
  const handlers = {}
  const source = fs.readFileSync(require.resolve('../electron/main.cjs'), 'utf8')
  vm.runInNewContext(source.slice(source.indexOf("ipcMain.handle('quotes:get'"), source.indexOf("ipcMain.handle('attachments:list'")), {
    ipcMain: { handle: (name, callback) => { handlers[name] = callback } },
    getDb: () => db, findQuoteApproval, assertQuoteEditable, replaceQuoteWithOrderSnapshot, materializeApprovedQuote, requireEditableOrder, wholePartQuantity, partMarkup: () => 0.2, normalizeBarcode:value=>String(value||''), syncOrderItemTotals: () => {},
  })
  return { db, call: (name, arg) => handlers[`quotes:${name}`](null, arg) }
}

test('quote 1 does not use quote 10 approval or another order approval', t => {
  const { db } = setup(t)
  db.exec("INSERT INTO approvals(order_id,scope,status) VALUES (1,'Wycena #10 · Filtr','APPROVED'),(2,'Wycena #1 · Olej','APPROVED')")
  assert.equal(findQuoteApproval(db, 1, 1), undefined)
  db.exec("INSERT INTO approvals(order_id,scope) VALUES (1,'Wycena #1')")
  assert.equal(findQuoteApproval(db, 1, 1).scope, 'Wycena #1')
})

test('sending freezes additions and deletions and repeated requests are idempotent', t => {
  const { db, call } = setup(t)
  const item = call('addItem', { orderId: 1, data: { name: 'Filtr', qty: 2, unit_price: 50 } })
  const sent = call('requestApproval', 10)
  assert.equal(sent.total, 100)
  assert.equal(call('requestApproval', 10).approvalId, sent.approvalId)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM approvals').get().n, 1)
  for (const status of ['PENDING', 'APPROVED', 'DECLINED']) {
    db.prepare('UPDATE approvals SET status=?').run(status)
    assert.throws(() => call('updateItem', { id:item.id, data:{ name:'Zmieniony',qty:1,unit_price:10 } }))
    assert.throws(() => call('addItem', { orderId: 1, data: { name: 'Extra' } }), /zamrożony/)
    assert.throws(() => call('removeItem', item.id), /zamrożony/)
  }
  assert.equal(db.prepare('SELECT COUNT(*) n FROM quote_items').get().n, 1)
})

test('draft items can be removed and an empty quote cannot be sent', t => {
  const { db, call } = setup(t)
  const item = call('addItem', { orderId: 1, data: { name: 'Filtr' } })
  assert.equal(call('removeItem', item.id), true)
  assert.equal(call('requestApproval', 10).reason, 'EMPTY_QUOTE')
  assert.equal(db.prepare('SELECT COUNT(*) n FROM approvals').get().n, 0)
})

test('accepting quote 1 cannot use approval for quote 10', t => {
  const { db, call } = setup(t)
  db.exec("INSERT INTO approvals(order_id,scope,status) VALUES (1,'Wycena #10 · Filtr','APPROVED')")
  assert.equal(call('accept', 1).reason, 'APPROVAL_REQUIRED')
})

test('draft quote accepts parts only in whole pieces', t => {
  const { call } = setup(t)
  assert.throws(() => call('addItem', { orderId:1, data:{ kind:'CZESC', name:'Filtr', qty:1.97, unit_price:50 } }), /liczbą całkowitą/)
})

test('draft item can be edited and its totals and part identity are recalculated', t => {
  const { db, call } = setup(t)
  const item=call('addItem',{orderId:1,data:{kind:'CZESC',name:'Filtr',qty:1,unit_cost:20,unit_price:40,part_no:'OLD'}})
  const result=call('updateItem',{id:item.id,data:{name:'Filtr oleju',qty:2,unit_cost:25,unit_price:55,part_no:'W 712/95',oe_number:'11428507683',brand:'MANN-FILTER',barcode:'4006381333931'}})
  assert.equal(result.total,110)
  assert.deepEqual({...db.prepare('SELECT name,qty,unit_cost,unit_price,part_no,oe_number,brand,barcode,price_snapshot FROM quote_items WHERE id=?').get(item.id)},{name:'Filtr oleju',qty:2,unit_cost:25,unit_price:55,part_no:'W 712/95',oe_number:'11428507683',brand:'MANN-FILTER',barcode:'4006381333931',price_snapshot:110})
  assert.throws(()=>call('updateItem',{id:item.id,data:{name:'Filtr',qty:1,unit_cost:20,unit_price:-1}}))
})

test('accepted catalog labor keeps its snapshot in the order', t => {
  const { db, call } = setup(t)
  call('addItem', { orderId: 1, data: { kind:'ROBOCIZNA', name:'Wymiana klocków — tył EPB', labor_hours:1.2, labor_rate:300, catalog_work_id:'work_brakes', catalog_variant_id:'variant_rear_epb', work_name:'Wymiana klocków', variant_name:'tył EPB', customer_description:'Opis zapisany w kosztorysie.', hours_snapshot:1.2, price_snapshot:360 } })
  db.exec("INSERT INTO approvals(order_id,scope,status) VALUES (1,'Wycena #10 · Hamulce','APPROVED')")
  assert.equal(call('accept',10).ok,true)
  const item=db.prepare("SELECT * FROM order_items WHERE order_id=1 AND kind='ROBOCIZNA'").get()
  assert.equal(item.catalog_variant_id,'variant_rear_epb')
  assert.equal(item.customer_description,'Opis zapisany w kosztorysie.')
  assert.equal(item.hours_snapshot,1.2)
  assert.equal(item.price_snapshot,360)
})

test('cloud approval uses the same complete and idempotent quote materialization', t => {
  const { db, call } = setup(t)
  call('addItem', { orderId: 1, data: { kind:'ROBOCIZNA', name:'Diagnostyka czujnika', labor_hours:1.5, labor_rate:240, catalog_work_id:'sensors', catalog_variant_id:'pressure_diff', work_name:'Diagnostyka czujnika różnicy ciśnień', variant_name:'DPF', customer_description:'Pomiary instalacji i sygnału.', technical_description:'Sprawdź napięcie odniesienia.', hours_snapshot:1.5, price_snapshot:360 } })
  call('addItem', { orderId: 1, data: { kind:'CZESC', name:'Czujnik różnicy ciśnień', qty:1, unit_cost:180, unit_price:280, part_no:'6PP 009 409-021', oe_number:'03L 906 051B', brand:'HELLA', barcode:'4082300401123', vehicle_fitment:'Audi A4 B8 2.0 TDI', cross_numbers:'0281006005', lookup_source:'catalog', lookup_url:'https://example.test/part' } })
  call('addItem', { orderId: 1, data: { kind:'MATERIAL', name:'Przewód podciśnienia', qty:2, unit_cost:8, unit_price:15 } })

  const first = materializeApprovedQuote(db, { scope:'Wycena #10 · diagnostyka DPF' })
  const second = materializeApprovedQuote(db, { scope:'Wycena #10 · diagnostyka DPF' })
  assert.equal(first.prepared, true)
  assert.equal(first.partsPrepared, 1)
  assert.equal(second.already, true)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM order_items').get().n, 2)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM job_part_orders').get().n, 1)
  const part = db.prepare('SELECT * FROM job_part_orders').get()
  assert.equal(part.part_no,'6PP 009 409-021')
  assert.equal(part.oe_number,'03L 906 051B')
  assert.equal(part.brand,'HELLA')
  assert.equal(JSON.parse(part.vehicle_snapshot).plate,'PO 12345')
  const labor = db.prepare("SELECT * FROM order_items WHERE kind='ROBOCIZNA'").get()
  assert.equal(labor.catalog_variant_id, 'pressure_diff')
  assert.equal(labor.customer_description, 'Pomiary instalacji i sygnału.')
  assert.equal(labor.technical_description, 'Sprawdź napięcie odniesienia.')
  assert.equal(labor.qty, 1.5)
  assert.equal(labor.unit_price, 240)
  assert.equal(db.prepare("SELECT unit_price FROM order_items WHERE kind='MATERIAL'").get().unit_price, 15)
})

test('closed order rejects quote changes until it is reopened', t => {
  const { db, call } = setup(t)
  db.prepare("UPDATE orders SET status='WYDANE',archived_at=CURRENT_TIMESTAMP WHERE id=1").run()
  assert.throws(() => call('addItem', { orderId: 1, data: { name: 'Pozycja po wydaniu' } }), /zamknięte/)
  assert.throws(() => call('requestApproval', 10), /zamknięte/)
  assert.throws(() => call('accept', 10), /zamknięte/)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM quote_items').get().n, 0)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM approvals').get().n, 0)
})

test('quote imports the current order scope and cannot be edited independently', t => {
  const { db, call } = setup(t)
  db.exec(`
    INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,hours_snapshot,price_snapshot)
      VALUES (1,'ROBOCIZNA','Wymiana filtra',1.5,0,220,1.5,330),(1,'MATERIAL','Środek czyszczący',2,10,25,NULL,50);
    INSERT INTO job_part_orders(order_id,part_no,name,qty,unit_cost,unit_price,status)
      VALUES (1,'W 712/95','Filtr oleju',1,28,55,'DO_ZAMOWIENIA');
  `)
  const imported=call('importOrder',1)
  assert.equal(imported.itemCount,3)
  assert.equal(imported.total,435)
  const quote=db.prepare("SELECT * FROM quotes WHERE order_id=1 AND status='ROBOCZA' ORDER BY id DESC LIMIT 1").get()
  assert.equal(quote.source_type,'ORDER_SNAPSHOT')
  assert.equal(db.prepare('SELECT COUNT(*) n FROM quote_items WHERE quote_id=?').get(quote.id).n,3)
  assert.throws(()=>call('addItem',{orderId:1,data:{name:'Pozycja dodana bokiem'}}),/pochodzą ze zlecenia/)
})

test('accepting an imported scope does not duplicate order work or planned parts', t => {
  const { db, call } = setup(t)
  db.exec(`
    INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price) VALUES (1,'MATERIAL','Płyn',1,20,45);
    INSERT INTO job_part_orders(order_id,name,qty,unit_cost,unit_price,status) VALUES (1,'Filtr',1,25,60,'DO_ZAMOWIENIA');
  `)
  call('importOrder',1)
  const quote=db.prepare("SELECT * FROM quotes WHERE order_id=1 AND status='ROBOCZA' ORDER BY id DESC LIMIT 1").get()
  const sent=call('requestApproval',quote.id)
  db.prepare("UPDATE approvals SET status='APPROVED' WHERE id=?").run(sent.approvalId)
  assert.equal(call('accept',quote.id).sourceSnapshot,true)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM order_items WHERE order_id=1').get().n,1)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM job_part_orders WHERE order_id=1').get().n,1)
  assert.equal(db.prepare('SELECT status FROM quotes WHERE id=?').get(quote.id).status,'ZAAKCEPTOWANA')
})
