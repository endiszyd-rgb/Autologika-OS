const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {customerProfile}=require('../electron/customer-profile.cjs')

function fixture(){
  const db=new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,email TEXT,company TEXT,notes TEXT,created_at TEXT);
    CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,vin TEXT,make TEXT,model TEXT,created_at TEXT);
    CREATE TABLE orders(id INTEGER PRIMARY KEY,vehicle_id INTEGER,title TEXT,status TEXT,labor_hours REAL,labor_rate REAL,parts_cost REAL,parts_sale REAL,other_cost REAL,other_sale REAL,diagnosis_fee REAL,discount REAL,opened_at TEXT,archived_at TEXT);
    CREATE TABLE payments(id INTEGER PRIMARY KEY,order_id INTEGER,amount REAL,method TEXT,reference TEXT,note TEXT,paid_at TEXT);
    INSERT INTO customers VALUES(1,'Jan Kowalski','500600700','jan@example.pl','Kowalski Auto','Stały klient','2026-01-01');
    INSERT INTO vehicles VALUES(1,1,'PO 1234A','JT123','Toyota','Corolla','2026-01-01'),(2,1,'PO 5678B','WF123','Ford','Focus','2026-02-01'),(3,NULL,'WE SOLO','XX','Opel','Astra','2026-03-01');
    INSERT INTO orders VALUES
      (1,1,'Serwis olejowy','WYDANE',1,220,100,180,0,0,0,0,'2026-04-01','2026-04-02'),
      (2,2,'Hamulce','NAPRAWA',2,220,200,350,20,50,80,20,'2026-05-01',NULL);
    INSERT INTO payments VALUES(1,1,400,'KARTA','','','2026-04-02'),(2,2,300,'PRZELEW','','','2026-05-02');
  `)
  return db
}

test('customer profile combines vehicles, service history and settlements',()=>{
  const profile=customerProfile(fixture(),1)
  assert.equal(profile.customer.name,'Jan Kowalski')
  assert.equal(profile.vehicles.length,2)
  assert.equal(profile.orders.length,2)
  assert.equal(profile.payments.length,2)
  assert.deepEqual(profile.totals,{revenue:1300,paid:700,balance:600,contribution:980,active:1})
  assert.equal(profile.vehicles.find(vehicle=>vehicle.id===2).order_count,1)
  assert.equal(profile.orders.find(order=>order.id===2).balance,600)
})

test('customer profile returns null for a missing customer',()=>{
  assert.equal(customerProfile(fixture(),99),null)
})
