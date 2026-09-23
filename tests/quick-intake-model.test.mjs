import test from 'node:test'
import assert from 'node:assert/strict'
import {clearIntakeVehicle,filterIntakeCustomers,findActiveIntakeOrder,findScannedIntakeVehicle,intakeMileageState,selectIntakeCustomer,selectIntakeVehicle,vehiclesForIntakeCustomer} from '../src/quick-intake-model.js'

const customers=[{id:1,name:'Anna Nowak',phone:'500 600 700',email:'anna@example.pl',company:'Auto Anna'},{id:2,name:'Jan Kowalski',phone:'700800900'}]
const vehicles=[{id:10,customer_id:1,plate:'WA 1234',vin:'ABC123',make:'Volvo',model:'V60',mileage:125000},{id:20,customer_id:2,plate:'KR 55',vin:'XYZ789',make:'Ford',model:'Focus'}]

test('wybór klienta uzupełnia dane i czyści wcześniej wybrane auto',()=>{
 const result=selectIntakeCustomer({vehicle_id:99,plate:'OLD',title:'Naprawa'},customers[0])
 assert.equal(result.customer_id,1)
 assert.equal(result.customer_phone,'500 600 700')
 assert.equal(result.vehicle_id,'')
 assert.equal(result.plate,'')
 assert.equal(result.title,'Naprawa')
})

test('wybór pojazdu uzupełnia auto i jego właściciela',()=>{
 const result=selectIntakeVehicle({title:'Diagnostyka'},vehicles[0],customers)
 assert.equal(result.vehicle_id,10)
 assert.equal(result.customer_id,1)
 assert.equal(result.customer_name,'Anna Nowak')
 assert.equal(result.make,'Volvo')
 assert.equal(result.mileage,125000)
})

test('lista i wyszukiwanie ograniczają dane do wybranego klienta',()=>{
 assert.deepEqual(vehiclesForIntakeCustomer(vehicles,1).map(vehicle=>vehicle.id),[10])
 assert.deepEqual(filterIntakeCustomers(customers,'anna 500').map(customer=>customer.id),[1])
 assert.equal(clearIntakeVehicle({vehicle_id:10,plate:'WA 1234',customer_id:1}).customer_id,1)
})

test('skan rozpoznaje pojazd zapisany już w kartotece',()=>{
 assert.equal(findScannedIntakeVehicle(vehicles,{vin:'abc 123'}).id,10)
 assert.equal(findScannedIntakeVehicle(vehicles,{registration:{form:{plate:'kr55'}}}).id,20)
})

test('wykrywa aktywne zlecenie dla wybranego pojazdu',()=>{
 const orders=[{id:31,vehicle_id:10,status:'NAPRAWA'},{id:32,vehicle_id:20,status:'WYDANE'},{id:33,vehicle_id:20,status:'PRZYJETE',archived_at:'2026-09-20'}]
 assert.equal(findActiveIntakeOrder(orders,10)?.id,31)
 assert.equal(findActiveIntakeOrder(orders,20),null)
 assert.equal(findActiveIntakeOrder(orders,''),null)
})

test('chroni historię pojazdu przed przypadkowym cofnięciem przebiegu',()=>{
 assert.equal(intakeMileageState({mileage:125000},124999).invalid,true)
 assert.equal(intakeMileageState({mileage:125000},125001).increased,true)
 assert.equal(intakeMileageState({mileage:125000},'').invalid,false)
 assert.equal(intakeMileageState(null,90000).invalid,false)
})
