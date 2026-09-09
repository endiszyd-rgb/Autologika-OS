const { test } = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const fs = require('node:fs')
const vm = require('node:vm')
const { findQuoteApproval, assertQuoteEditable } = require('../electron/quote-approval.cjs')

function setup(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  // Use the application's schema and IPC callbacks, without launching Electron.
  const schema = fs.readFileSync(require.resolve('../electron/db.cjs'), 'utf8')
  for (const table of ['orders', 'quotes', 'quote_items', 'approvals', 'order_events']) {
    db.exec(schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\);`))[0])
  }
  db.exec("ALTER TABLE orders ADD COLUMN wait_state TEXT DEFAULT 'BRAK'")
  db.exec('PRAGMA foreign_keys=OFF; INSERT INTO orders(id,vehicle_id,title) VALUES (1,1,\'Test\'); INSERT INTO quotes(id,order_id) VALUES (1,1),(10,1)')
  const handlers = {}
  const source = fs.readFileSync(require.resolve('../electron/main.cjs'), 'utf8')
  vm.runInNewContext(source.slice(source.indexOf("ipcMain.handle('quotes:get'"), source.indexOf("ipcMain.handle('attachments:list'")), {
    ipcMain: { handle: (name, callback) => { handlers[name] = callback } },
    getDb: () => db, findQuoteApproval, assertQuoteEditable, partMarkup: () => 0.2,
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
