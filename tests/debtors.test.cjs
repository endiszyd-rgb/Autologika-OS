const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {listDebtors}=require('../electron/debtors.cjs')

function fixture(){
  const db=new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,email TEXT);
    CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,vin TEXT,make TEXT,model TEXT);
    CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT,status TEXT,labor_hours REAL,labor_rate REAL,parts_sale REAL,other_sale REAL,diagnosis_fee REAL,discount REAL,opened_at TEXT);
    CREATE TABLE payments(id INTEGER PRIMARY KEY,order_id INTEGER,amount REAL);
    INSERT INTO customers VALUES(1,'Anna Nowak','500600700','anna@example.pl');
    INSERT INTO vehicles VALUES(1,1,'PO 1234A','VIN1','Toyota','Corolla'),(2,NULL,'PO SOLO','VIN2','Ford','Focus');
    INSERT INTO orders VALUES
      (1,1,'Gotowe częściowo opłacone','GOTOWE',2,220,300,50,80,20,'2026-05-01'),
      (2,1,'Wydane i rozliczone','WYDANE',1,220,0,0,0,0,'2026-04-01'),
      (3,1,'Jeszcze w naprawie','NAPRAWA',3,220,500,0,0,0,'2026-06-01'),
      (4,2,'Auto bez właściciela','GOTOWE',1,220,0,0,0,0,'2026-07-01');
    INSERT INTO payments VALUES(1,1,300),(2,2,220);
  `)
  return db
}

test('debtors list uses order financials and subtracts partial payments',()=>{
  const rows=listDebtors(fixture())
  assert.equal(rows.length,2)
  assert.equal(rows[0].id,1)
  assert.equal(rows[0].total,850)
  assert.equal(rows[0].paid,300)
  assert.equal(rows[0].balance,550)
  assert.equal(rows[1].customer,null)
  assert.equal(rows[1].balance,220)
})

test('paid and unfinished orders are excluded from debtors',()=>{
  const ids=listDebtors(fixture()).map(row=>row.id)
  assert.deepEqual(ids,[1,4])
})
