import test from 'node:test'
import assert from 'node:assert/strict'
import {matchingVehicleParts,oeNumbers,vehicleLabel,vehiclePartScore} from '../src/vehicle-part-match.js'

const vehicle={plate:'PO 1234A',make:'Volkswagen',model:'Golf',generation:'VII',year:2017,engine:'2.0 TDI',engine_code:'CRLB'}

test('wybiera części pasujące do konkretnego pojazdu i preferuje zgodny silnik',()=>{
  const parts=[
    {id:1,name:'Filtr',vehicle_fitment:'Volkswagen Golf VII 2.0 TDI CRLB'},
    {id:2,name:'Łącznik',vehicle_fitment:'Volkswagen Golf VII'},
    {id:3,name:'Filtr',vehicle_fitment:'Ford Focus III'}
  ]
  assert.deepEqual(matchingVehicleParts(parts,vehicle).map(x=>x.id),[1,2])
  assert.ok(vehiclePartScore(parts[0],vehicle)>vehiclePartScore(parts[1],vehicle))
})

test('odczytuje unikalne numery OE z danych części',()=>{
  assert.deepEqual(oeNumbers('5Q0 411 315 A\n5Q0411315A; 5Q0 411 315 A'),['5Q0 411 315 A','5Q0411315A'])
})

test('etykieta zawiera pojazd i kod silnika',()=>{
  assert.match(vehicleLabel(vehicle),/PO 1234A.*Volkswagen Golf VII 2017.*CRLB/)
})
