const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const { scanRemoteApprovals } = require('../electron/cloud-sync.cjs')

function setup(t) {
  const db = new DatabaseSync(':memory:')
  t.after(() => db.close())
  db.exec(`
    CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT);
    CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,vin TEXT,make TEXT,model TEXT,generation TEXT,year INTEGER,engine TEXT,engine_code TEXT);
    CREATE TABLE orders(
      id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT,status TEXT DEFAULT 'WYCENA',wait_state TEXT DEFAULT 'DECYZJA',
      labor_rate REAL DEFAULT 220,parts_cost REAL DEFAULT 0,parts_sale REAL DEFAULT 0,other_cost REAL DEFAULT 0,other_sale REAL DEFAULT 0
    );
    CREATE TABLE quotes(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT DEFAULT 'ROBOCZA',source_type TEXT DEFAULT 'LEGACY',accepted_at TEXT);
    CREATE TABLE quote_items(
      id INTEGER PRIMARY KEY,quote_id INTEGER,kind TEXT,name TEXT,qty REAL DEFAULT 1,unit_cost REAL DEFAULT 0,unit_price REAL DEFAULT 0,
      labor_hours REAL DEFAULT 0,labor_rate REAL DEFAULT 0,notes TEXT,catalog_work_id TEXT,catalog_variant_id TEXT,work_name TEXT,
      variant_name TEXT,customer_description TEXT,technical_description TEXT,hours_snapshot REAL,price_snapshot REAL,part_no TEXT,
      oe_number TEXT,inventory_part_id INTEGER,supplier_name TEXT,barcode TEXT,brand TEXT,vehicle_fitment TEXT,cross_numbers TEXT,
      lookup_source TEXT,lookup_url TEXT
    );
    CREATE TABLE approvals(
      id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT DEFAULT 'PENDING',amount REAL DEFAULT 0,scope TEXT DEFAULT '',note TEXT,decided_at TEXT,
      remote_id TEXT,snapshot_json TEXT,snapshot_hash TEXT,hash_algorithm TEXT,terms_version TEXT,terms_text TEXT,
      signature_storage_path TEXT,signature_hash TEXT,pdf_storage_path TEXT,pdf_hash TEXT,local_pdf_path TEXT,
      remote_expires_at TEXT,remote_synced_at TEXT,client_user_agent TEXT,document_no TEXT,approval_sequence INTEGER,
      previously_approved_total REAL DEFAULT 0
    );
    CREATE TABLE order_events(id INTEGER PRIMARY KEY,order_id INTEGER,event_type TEXT,title TEXT,details TEXT);
    CREATE TABLE order_items(
      id INTEGER PRIMARY KEY,order_id INTEGER,kind TEXT,name TEXT,qty REAL,unit_cost REAL,unit_price REAL,notes TEXT,
      catalog_work_id TEXT,catalog_variant_id TEXT,work_name TEXT,variant_name TEXT,customer_description TEXT,
      technical_description TEXT,hours_snapshot REAL,price_snapshot REAL
    );
    CREATE TABLE job_part_orders(
      id INTEGER PRIMARY KEY,order_id INTEGER,supplier_name TEXT,part_no TEXT,oe_number TEXT,inventory_part_id INTEGER,
      vehicle_snapshot TEXT,barcode TEXT,brand TEXT,vehicle_fitment TEXT,cross_numbers TEXT,lookup_source TEXT,lookup_url TEXT,
      name TEXT,qty REAL,unit_cost REAL,unit_price REAL,status TEXT,notes TEXT
    );
    INSERT INTO customers VALUES(1,'Jan Kowalski');
    INSERT INTO vehicles VALUES(1,1,'ZPL 12345','WVWZZZ1KZBW000001','Volkswagen','Touran','1T3',2011,'2.0 TDI','CFHC');
    INSERT INTO orders(id,vehicle_id,title) VALUES(1,1,'Serwis hamulców');
    INSERT INTO quotes(id,order_id) VALUES(7,1);
    INSERT INTO quote_items(id,quote_id,kind,name,qty,unit_cost,unit_price,labor_hours,labor_rate,work_name,hours_snapshot,price_snapshot)
      VALUES(1,7,'ROBOCIZNA','Wymiana klocków',1,0,0,1.5,220,'Wymiana klocków',1.5,330);
    INSERT INTO quote_items(id,quote_id,kind,name,qty,unit_cost,unit_price,part_no,oe_number,brand)
      VALUES(2,7,'CZESC','Klocki hamulcowe',1,120,190,'13.0460-7184.2','5Q0698451','ATE');
    INSERT INTO approvals(id,order_id,status,amount,scope) VALUES(12,1,'PENDING',520,'Wycena #7 · hamulce');
  `)
  db.transaction = fn => (...args) => {
    db.exec('BEGIN')
    try { const result = fn(...args); db.exec('COMMIT'); return result }
    catch (error) { db.exec('ROLLBACK'); throw error }
  }
  return db
}

function remoteRow(status, overrides = {}) {
  return {
    id: 'remote-12', approval_local_id: 12, status, customer_note: '', decided_at: '2026-10-03T10:00:00.000Z',
    created_at: '2026-10-03T09:00:00.000Z', expires_at: '2026-10-10T09:00:00.000Z', snapshot: { documentNo: 'AL-12' },
    snapshot_hash: 'a'.repeat(64), hash_algorithm: 'SHA-256', terms_version: '2026-09', terms_text: 'Warunki',
    signature_storage_path: 'workshop/signature.png', signature_hash: 'b'.repeat(64),
    pdf_storage_path: status === 'APPROVED' ? 'workshop/approval.pdf' : '', pdf_hash: status === 'APPROVED' ? 'c'.repeat(64) : '',
    client_user_agent: 'test', document_no: 'AL-12', approval_sequence: 1, previously_approved_total: 0,
    ...overrides
  }
}

test('remote approval updates the order, prepares accepted scope and starts PDF archiving', async t => {
  const db = setup(t), archived = [], emitted = []
  const result = await scanRemoteApprovals(
    { workshopId: 'workshop-1' }, db,
    {
      requestRows: async () => [remoteRow('APPROVED', { customer_note: 'Akceptuję zakres' })],
      archivePdf: async (id, options) => { archived.push([id, options.db === db]); return { ok: true } },
      emitApproval: item => emitted.push(item)
    }
  )

  assert.equal(result.length, 1)
  assert.equal(result[0].status, 'APPROVED')
  assert.equal(result[0].prepared, true)
  assert.equal(result[0].partsPrepared, 1)
  assert.deepEqual(archived, [[12, true]])
  assert.equal(emitted.length, 1)
  assert.deepEqual({ ...db.prepare('SELECT status,note,remote_id,pdf_storage_path FROM approvals WHERE id=12').get() }, {
    status: 'APPROVED', note: 'Akceptuję zakres', remote_id: 'remote-12', pdf_storage_path: 'workshop/approval.pdf'
  })
  assert.deepEqual({ ...db.prepare('SELECT status,wait_state,parts_cost,parts_sale,other_sale FROM orders WHERE id=1').get() }, {
    status: 'NAPRAWA', wait_state: 'CZESCI', parts_cost: 0, parts_sale: 0, other_sale: 330
  })
  assert.equal(db.prepare("SELECT COUNT(*) count FROM job_part_orders WHERE status='DO_ZAMOWIENIA'").get().count, 1)
  assert.equal(db.prepare("SELECT COUNT(*) count FROM order_items WHERE kind='ROBOCIZNA'").get().count, 1)
  assert.equal(db.prepare("SELECT COUNT(*) count FROM order_events WHERE event_type='REMOTE_APPROVAL'").get().count, 1)
})

test('remote rejection keeps the quote editable scope unmaterialized and waits for a decision', async t => {
  const db = setup(t), archived = [], emitted = []
  const result = await scanRemoteApprovals(
    { workshopId: 'workshop-1' }, db,
    {
      requestRows: async () => [remoteRow('DECLINED', { customer_note: 'Proszę zmienić zakres' })],
      archivePdf: async id => archived.push(id),
      emitApproval: item => emitted.push(item)
    }
  )

  assert.equal(result[0].status, 'DECLINED')
  assert.equal(result[0].prepared, false)
  assert.equal(db.prepare('SELECT status FROM approvals WHERE id=12').get().status, 'DECLINED')
  assert.equal(db.prepare('SELECT status FROM quotes WHERE id=7').get().status, 'ROBOCZA')
  assert.equal(db.prepare('SELECT wait_state FROM orders WHERE id=1').get().wait_state, 'DECYZJA')
  assert.equal(db.prepare('SELECT COUNT(*) count FROM job_part_orders').get().count, 0)
  assert.equal(archived.length, 0)
  assert.equal(emitted.length, 1)
})
