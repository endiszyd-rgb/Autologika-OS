import test from 'node:test'
import assert from 'node:assert/strict'
import {filterOrderRows,orderFilterOptions} from '../src/order-list-model.mjs'

const rows=[
 {id:11,plate:'PO 12Ą34',vin:'WVWZZZ123',make:'Škoda',model:'Octavia',customer:'Łukasz Żak',phone:'500 600 700',title:'Diagnostyka DPF',status:'DIAGNOZA',priority:'PILNY'},
 {id:12,plate:'WZ 9988',vin:'TMB456',make:'Toyota',model:'Corolla',customer:'Anna Nowak',title:'Serwis olejowy',status:'PRZYJETE',priority:'NORMALNY'}
]

test('wyszukuje zlecenia bez polskich znaków i odstępów rejestracji',()=>{
 assert.deepEqual(filterOrderRows(rows,{query:'lukasz dpf'}).map(row=>row.id),[11])
 assert.deepEqual(filterOrderRows(rows,{query:'PO12A34'}).map(row=>row.id),[11])
 assert.deepEqual(filterOrderRows(rows,{query:'500600700'}).map(row=>row.id),[11])
})

test('łączy filtr etapu, priorytetu i tekstu',()=>{
 assert.deepEqual(filterOrderRows(rows,{query:'toyota',status:'PRZYJETE',priority:'NORMALNY'}).map(row=>row.id),[12])
 assert.deepEqual(filterOrderRows(rows,{status:'DIAGNOZA',priority:'NORMALNY'}),[])
})

test('buduje opcje filtrów tylko z dostępnych zleceń',()=>{
 assert.deepEqual(orderFilterOptions(rows,'status'),['DIAGNOZA','PRZYJETE'])
 assert.deepEqual(orderFilterOptions(rows,'priority'),['PILNY','NORMALNY'])
})
