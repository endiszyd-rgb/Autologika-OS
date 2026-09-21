const test=require('node:test')
const assert=require('node:assert/strict')
const {buildVehicleHealth}=require('../electron/vehicle-health.cjs')

const now='2026-09-14T10:00:00.000Z'
const base={vehicle:{vin:'WVWZZZ1KZBW000001',mileage:210000},orders:[{id:1,title:'Przegląd',status:'WYDANE',opened_at:'2026-08-01T10:00:00Z'}],findings:[],reminders:[],diagnostics:[{order_id:1,conclusion:'Pojazd sprawdzony'}]}

test('critical brake finding lowers only the brake subsystem and explains why',()=>{
 const result=buildVehicleHealth({...base,findings:[{id:7,title:'Przewód hamulcowy skorodowany',severity:'CRITICAL',status:'OPEN'}]},{now})
 const brakes=result.subsystems.find(item=>item.id==='brakes'),engine=result.subsystems.find(item=>item.id==='engine')
 assert.equal(brakes.score,62)
 assert.equal(engine.score,100)
 assert.equal(brakes.issues[0].sourceId,7)
 assert.ok(result.actions.some(item=>item.system==='brakes'))
})

test('overdue tire reminder affects tire health using date and mileage',()=>{
 const result=buildVehicleHealth({...base,reminders:[{id:2,title:'Wymiana opon',due_date:'2026-09-01',due_mileage:209000,status:'OPEN'}]},{now})
 assert.equal(result.subsystems.find(item=>item.id==='tires').score,80)
})

test('vehicle with no workshop evidence is marked for assessment instead of showing perfect health',()=>{
 const result=buildVehicleHealth({vehicle:{make:'Ford'},orders:[],findings:[],reminders:[],diagnostics:[]},{now})
 assert.equal(result.displayScore,null)
 assert.equal(result.state,'DO OCENY')
 assert.ok(result.actions.some(item=>item.system==='data'))
})

test('resolved findings no longer reduce the health score',()=>{
 const result=buildVehicleHealth({...base,findings:[{id:8,title:'Wyciek oleju silnika',severity:'HIGH',status:'RESOLVED'}]},{now})
 assert.equal(result.score,100)
 assert.equal(result.issueCount,0)
})

test('basic fault description counts as a completed diagnosis without electronic data',()=>{
 const result=buildVehicleHealth({
  vehicle:{vin:'WVWZZZ1KZBW000001',mileage:210000},
  orders:[{id:2,title:'Brak mocy silnika',complaint:'Brak mocy',status:'DIAGNOZA',opened_at:'2026-09-10T10:00:00Z'}],
  findings:[],reminders:[],diagnostics:[{order_id:2,symptom_confirmed:'Pęknięty przewód podciśnienia'}]
 },{now})
 assert.equal(result.issueCount,0)
 assert.ok(result.coverage>=32)
})
