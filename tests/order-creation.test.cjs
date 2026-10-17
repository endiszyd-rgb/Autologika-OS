const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {normalizeOrder,activeOrderForVehicle,insertOrder,createOrderBundle}=require('../electron/order-creation.cjs')

function fixture(){
  const db=new DatabaseSync(':memory:')
  db.exec('PRAGMA foreign_keys = ON')
  db.transaction=fn=>(...args)=>{
    db.exec('BEGIN')
    try{const result=fn(...args);db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}
  }
  db.exec(`
    CREATE TABLE customers(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,phone TEXT,email TEXT,company TEXT,notes TEXT);
    CREATE TABLE vehicles(id INTEGER PRIMARY KEY AUTOINCREMENT,customer_id INTEGER,plate TEXT,vin TEXT,make TEXT,model TEXT,generation TEXT,year INTEGER,engine TEXT,power_hp REAL,engine_code TEXT,mileage REAL,notes TEXT,FOREIGN KEY(customer_id) REFERENCES customers(id));
    CREATE TABLE orders(id INTEGER PRIMARY KEY AUTOINCREMENT,vehicle_id INTEGER NOT NULL,title TEXT NOT NULL,complaint TEXT,status TEXT NOT NULL,priority TEXT,diagnosis_limit REAL,labor_rate REAL,diagnosis_fee REAL,source TEXT,due_at TEXT,wait_state TEXT,opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,archived_at TEXT,FOREIGN KEY(vehicle_id) REFERENCES vehicles(id));
    CREATE TABLE order_notes(order_id INTEGER PRIMARY KEY,intake_notes TEXT,release_notes TEXT,qc_notes TEXT,FOREIGN KEY(order_id) REFERENCES orders(id));
    CREATE TABLE order_events(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id INTEGER NOT NULL,event_type TEXT,title TEXT,details TEXT,FOREIGN KEY(order_id) REFERENCES orders(id));
    INSERT INTO customers(name) VALUES ('Jan Kowalski');
    INSERT INTO vehicles(customer_id,plate,vin,make,model,mileage) VALUES (1,'PO 1234A','WVWZZZ1JZXW000001','Volkswagen','Golf',120000);
  `)
  return db
}

test('order input is normalized and invalid business values are rejected',()=>{
  assert.deepEqual(normalizeOrder({title:'  Wymiana rozrządu ',priority:'pilny',labor_rate:'250'}),{
    title:'Wymiana rozrządu',complaint:'',priority:'PILNY',diagnosis_limit:0,labor_rate:250,diagnosis_fee:0,source:'nieznane',due_at:null,intake_notes:''
  })
  assert.throws(()=>normalizeOrder({title:' '}),/nazwę zlecenia/)
  assert.throws(()=>normalizeOrder({title:'Test',labor_rate:-1}),/Stawka robocizny/)
  assert.throws(()=>normalizeOrder({title:'Test',priority:'KRYTYCZNY'}),/priorytet/)
})

test('existing vehicle order is created with notes and auditable intake event',()=>{
  const db=fixture()
  const result=db.transaction(()=>insertOrder(db,1,{title:'Hamulce przód',complaint:'Hałas',intake_notes:'Klucz w schowku'}))()
  assert.equal(result.order_id,1)
  assert.deepEqual({...db.prepare('SELECT title,status,wait_state FROM orders WHERE id=1').get()},{title:'Hamulce przód',status:'PRZYJETE',wait_state:'BRAK'})
  assert.equal(db.prepare('SELECT intake_notes FROM order_notes WHERE order_id=1').get().intake_notes,'Klucz w schowku')
  assert.deepEqual({...db.prepare('SELECT event_type,title FROM order_events WHERE order_id=1').get()},{event_type:'INTAKE',title:'Utworzono zlecenie'})
})

test('active order collision is blocked unless operator explicitly allows a second order',()=>{
  const db=fixture()
  insertOrder(db,1,{title:'Pierwsze zlecenie'})
  assert.equal(activeOrderForVehicle(db,1).title,'Pierwsze zlecenie')
  assert.throws(()=>insertOrder(db,1,{title:'Drugie zlecenie'}),/aktywne zlecenie #1/)
  const second=insertOrder(db,1,{title:'Drugie zlecenie'},true)
  assert.equal(second.existing_order_id,1)
  assert.equal(db.prepare('SELECT COUNT(*) total FROM orders').get().total,2)
})

test('new customer, vehicle and order are committed as one linked bundle',()=>{
  const db=fixture()
  const result=createOrderBundle(db,{mode:'new',owner_mode:'new',customer:{name:'Anna Nowak',email:'anna@example.pl'},vehicle:{plate:'WE 55ABC',make:'Toyota',model:'Corolla'},order:{title:'Przegląd okresowy',labor_rate:240}})
  const row=db.prepare(`SELECT o.title,v.make,v.plate,c.name FROM orders o JOIN vehicles v ON v.id=o.vehicle_id JOIN customers c ON c.id=v.customer_id WHERE o.id=?`).get(result.order_id)
  assert.deepEqual({...row},{title:'Przegląd okresowy',make:'Toyota',plate:'WE 55ABC',name:'Anna Nowak'})
})

test('bundle rolls back customer and vehicle when final order insert fails',()=>{
  const db=fixture()
  db.exec("CREATE TRIGGER reject_order BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT,'test order failure'); END;")
  const before={customers:db.prepare('SELECT COUNT(*) n FROM customers').get().n,vehicles:db.prepare('SELECT COUNT(*) n FROM vehicles').get().n}
  assert.throws(()=>createOrderBundle(db,{mode:'new',owner_mode:'new',customer:{name:'Rollback'},vehicle:{plate:'KR 1TEST',make:'Skoda'},order:{title:'Test rollback'}}),/test order failure/)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM customers').get().n,before.customers)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM vehicles').get().n,before.vehicles)
  assert.equal(db.prepare('SELECT COUNT(*) n FROM orders').get().n,0)
})
