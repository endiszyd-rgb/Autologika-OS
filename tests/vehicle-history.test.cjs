const test = require('node:test')
const assert = require('node:assert/strict')
const { DatabaseSync } = require('node:sqlite')
const { vehicleHistoryDetails } = require('../electron/vehicle-history.cjs')

test('vehicle history combines performed work, documents and customer decisions from every visit', () => {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT,status TEXT,opened_at TEXT);
    CREATE TABLE order_items(id INTEGER PRIMARY KEY,order_id INTEGER,kind TEXT,name TEXT,qty REAL,unit_price REAL,deleted_at TEXT);
    CREATE TABLE attachments(id INTEGER PRIMARY KEY,order_id INTEGER,name TEXT,category TEXT,created_at TEXT,deleted_at TEXT);
    CREATE TABLE approvals(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT,amount REAL,scope TEXT,created_at TEXT,decided_at TEXT,local_pdf_path TEXT,deleted_at TEXT);
    INSERT INTO orders VALUES(1,7,'Serwis olejowy','WYDANE','2026-01-10'),(2,7,'Hamulce','NAPRAWA','2026-02-10'),(3,8,'Inne auto','WYDANE','2026-03-10');
    INSERT INTO order_items VALUES(1,1,'ROBOCIZNA','Wymiana oleju',1,220,NULL),(2,2,'CZESC','Klocki',1,190,NULL),(3,3,'ROBOCIZNA','Obca praca',1,100,NULL),(4,1,'CZESC','Usunięta',1,10,'2026-01-11');
    INSERT INTO attachments VALUES(1,1,'protokol.pdf','WYDANIE','2026-01-10',NULL),(2,2,'hamulce.jpg','NAPRAWA','2026-02-10',NULL),(3,3,'obcy.pdf','WYDANIE','2026-03-10',NULL);
    INSERT INTO approvals VALUES(1,1,'APPROVED',220,'Wycena #1','2026-01-10','2026-01-10','C:/archive/a.pdf',NULL),(2,2,'DECLINED',190,'Wycena #2','2026-02-10','2026-02-10','',NULL),(3,3,'APPROVED',100,'Wycena #3','2026-03-10','2026-03-10','',NULL);
  `)
  const history = vehicleHistoryDetails(db, 7)
  assert.deepEqual(history.works.map(row => row.name), ['Klocki', 'Wymiana oleju'])
  assert.deepEqual(history.documents.map(row => row.name), ['hamulce.jpg', 'protokol.pdf'])
  assert.deepEqual(history.approvals.map(row => row.status), ['DECLINED', 'APPROVED'])
  assert.equal(history.approvals[1].local_pdf_path, 'C:/archive/a.pdf')
  db.close()
})

test('invalid vehicle identity returns an empty safe history', () => {
  assert.deepEqual(vehicleHistoryDetails({}, ''), { works: [], documents: [], approvals: [] })
})
