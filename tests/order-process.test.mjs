import test from 'node:test'
import assert from 'node:assert/strict'
import {deriveOrderAdvice} from '../src/order-process.mjs'

const base={order:{status:'NAPRAWA',total:1000},diagnosis:{conclusion:'Potwierdzona usterka'},items:[{id:1}],parts:[],approvals:[{status:'APPROVED'}],payments:[],qcRows:[],logs:[],procedures:[]}

test('naprawa kieruje najpierw do zapisania zakresu prac',()=>{
 const advice=deriveOrderAdvice({...base,items:[]})
 assert.equal(advice.tab,'works')
 assert.match(advice.title,/zakres/i)
})

test('naprawa wymaga czasu pracy przed kontrolą jakości',()=>{
 const advice=deriveOrderAdvice(base)
 assert.equal(advice.tab,'time')
 assert.match(advice.title,/czas pracy/i)
})

test('kontrola jakości pojawia się po zakończonym wpisie czasu',()=>{
 const advice=deriveOrderAdvice({...base,logs:[{ended_at:'2026-09-22 10:00:00',duration_minutes:45}]})
 assert.equal(advice.tab,'release')
 assert.match(advice.title,/kontrolę jakości/i)
})

test('po kontroli jakości zlecenie przechodzi do gotowych',()=>{
 const qcRows=Array.from({length:8},(_,index)=>({check_key:String(index),checked:1}))
 const advice=deriveOrderAdvice({...base,logs:[{ended_at:'2026-09-22 10:00:00'}],qcRows})
 assert.equal(advice.status,'GOTOWE')
 assert.equal(advice.tab,'settlement')
})

test('najnowsza decyzja klienta zastępuje wcześniejszą akceptację',()=>{
 const advice=deriveOrderAdvice({...base,order:{status:'AKCEPTACJA',total:1000},approvals:[{id:1,status:'APPROVED'},{id:2,status:'DECLINED'}]})
 assert.equal(advice.tab,'quote')
 assert.equal(advice.status,undefined)
 assert.match(advice.title,/akceptację/i)
})
