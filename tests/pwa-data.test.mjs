import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {buildVehicleHealth} from '../src/platform/vehicle-health.mjs'
import {orderMoney,financeData,reminderState} from '../src/platform/pwa-data.mjs'
const require=createRequire(import.meta.url),desktop=require('../electron/vehicle-health.cjs')
test('browser health and forecast match desktop calculations for identical records',()=>{
 const input={vehicle:{id:1,vin:'VIN',mileage:120000},orders:[{id:2,status:'NAPRAWA',title:'Hamulce',opened_at:'2026-10-01'}],findings:[{id:3,title:'Klocki hamulcowe',severity:'HIGH',status:'OPEN'}],reminders:[{title:'Olej silnikowy',status:'OPEN',due_mileage:119000}],diagnostics:[]},options={now:'2026-11-04T12:00:00Z'}
 assert.deepEqual(buildVehicleHealth(input,options),desktop.buildVehicleHealth(input,options))
})
test('labor is not counted twice when legacy totals coexist with itemized labor',()=>{
 const order=orderMoney({id:1,labor_hours:2,labor_rate:200,other_sale:400,parts_sale:100,diagnosis_fee:50},[{order_id:1,kind:'ROBOCIZNA',qty:2,unit_price:200},{order_id:1,kind:'CZESC',qty:1,unit_price:100}],[])
 assert.equal(order.total,550);assert.equal(order.legacy_labor,0)
})
test('month finance uses local dates, payments and measured time with a complete empty contract',()=>{
 const now=new Date('2026-11-04T12:00:00Z'),empty=financeData([],[],[],now)
 assert.equal(empty.current.revenue,0);assert.equal(empty.daily.length,30);assert.deepEqual(empty.details,[])
 const result=financeData([{id:1,opened_at:'2026-11-01T12:00:00Z',total:100,balance:40,item_labor:100}], [{amount:60,paid_at:'2026-11-02'}],[{started_at:'2026-11-01 10:00:00',ended_at:'2026-11-01 11:00:00',duration_minutes:60}],now)
 assert.equal(result.current.actual_hours,1);assert.equal(result.current.paid,60);assert.equal(result.current.receivables,40)
})
test('reminders distinguish completed, past mileage and approaching date',()=>{
 assert.equal(reminderState({status:'DONE',due_mileage:1,current_mileage:2}).urgency,'DONE')
 assert.equal(reminderState({status:'OPEN',due_mileage:1,current_mileage:2}).urgency,'OVERDUE')
 assert.equal(reminderState({status:'OPEN',due_date:'2026-11-10'},new Date('2026-11-04T12:00:00')).urgency,'SOON')
})
