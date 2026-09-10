const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {createCustomer,updateCustomer,createVehicle,updateVehicle}=require('../electron/record-editing.cjs')

function fixture(){
 const db=new DatabaseSync(':memory:')
 db.exec(`
  CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,phone TEXT,email TEXT,company TEXT,notes TEXT);
  CREATE TABLE vehicles(id INTEGER PRIMARY KEY,customer_id INTEGER,plate TEXT,vin TEXT,make TEXT,model TEXT,generation TEXT,year INTEGER,engine TEXT,power_hp REAL,engine_code TEXT,mileage REAL,notes TEXT);
  INSERT INTO customers VALUES(1,'Jan Kowalski','','','','');
 `)
 return db
}

test('customer records are validated and editable',()=>{
 const db=fixture()
 const created=createCustomer(db,{name:'  Anna Nowak ',email:' ANNA@EXAMPLE.PL ',phone:'123'})
 assert.deepEqual({...db.prepare('SELECT name,email,phone FROM customers WHERE id=?').get(created.id)},{name:'Anna Nowak',email:'anna@example.pl',phone:'123'})
 updateCustomer(db,created.id,{name:'Anna Nowak-Kowalska',email:'anna@warsztat.pl',company:'Auto Test'})
 assert.equal(db.prepare('SELECT company FROM customers WHERE id=?').get(created.id).company,'Auto Test')
 assert.throws(()=>createCustomer(db,{name:'Test',email:'invalid'}),/adres e-mail/)
})

test('vehicle records normalize identifiers, prevent duplicates and remain editable',()=>{
 const db=fixture()
 const first=createVehicle(db,{customer_id:1,plate:' po 12ab ',vin:'wvwzzz1jzxw000001',make:'Volkswagen',year:2019,mileage:120000})
 assert.deepEqual({...db.prepare('SELECT plate,vin,make,year,mileage FROM vehicles WHERE id=?').get(first.id)},{plate:'PO 12AB',vin:'WVWZZZ1JZXW000001',make:'Volkswagen',year:2019,mileage:120000})
 assert.throws(()=>createVehicle(db,{customer_id:1,plate:'PO 99',vin:'WVWZZZ1JZXW000001',make:'VW'}),/VIN-em/)
 assert.throws(()=>createVehicle(db,{customer_id:1,plate:'po 12ab',make:'VW'}),/rejestracyjnym/)
 assert.throws(()=>createVehicle(db,{customer_id:1,plate:'PO 99',vin:'ABC',make:'VW'}),/17 .*znak/)
 updateVehicle(db,first.id,{customer_id:1,plate:'po 34 cd',vin:'WVWZZZ1JZXW000001',make:'Volkswagen',model:'Golf',engine_code:' caxa ',mileage:121500})
 assert.deepEqual({...db.prepare('SELECT plate,model,engine_code,mileage FROM vehicles WHERE id=?').get(first.id)},{plate:'PO 34 CD',model:'Golf',engine_code:'CAXA',mileage:121500})
})



test('vehicle can be created and edited without creating or selecting a customer',()=>{
 const db=fixture()
 const customersBefore=db.prepare('SELECT COUNT(*) n FROM customers').get().n
 const created=createVehicle(db,{customer_id:null,plate:'WE 1234A',make:'Toyota',model:'Corolla'})
 assert.deepEqual({...db.prepare('SELECT customer_id,plate,make,model FROM vehicles WHERE id=?').get(created.id)},{customer_id:null,plate:'WE 1234A',make:'Toyota',model:'Corolla'})
 assert.equal(db.prepare('SELECT COUNT(*) n FROM customers').get().n,customersBefore)
 updateVehicle(db,created.id,{customer_id:1,plate:'WE 1234A',make:'Toyota',model:'Corolla'})
 assert.equal(db.prepare('SELECT customer_id FROM vehicles WHERE id=?').get(created.id).customer_id,1)
 updateVehicle(db,created.id,{customer_id:'',plate:'WE 1234A',make:'Toyota',model:'Corolla'})
 assert.equal(db.prepare('SELECT customer_id FROM vehicles WHERE id=?').get(created.id).customer_id,null)
})
