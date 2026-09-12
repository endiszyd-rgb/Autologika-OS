import test from 'node:test'
import assert from 'node:assert/strict'
import {ageLabel,attentionHeadline,attentionMeta,attentionStats,filterAttention} from '../src/attention-center.mjs'

const rows=[
 {kind:'WAIT',plate:'PO 1',text:'KLIENT',created_at:'2026-09-12T10:00:00Z'},
 {kind:'PART_LATE',plate:'PO 2',text:'Filtr',created_at:'2026-09-12T11:00:00Z'},
 {kind:'VEHICLE_FINDING',plate:'PO 3',text:'Wyciek',severity:'CRITICAL',created_at:'2026-09-12T12:00:00Z'},
 {kind:'APPROVAL',plate:'PO 4',text:'APPROVED',created_at:'2026-09-12T13:00:00Z'}
]

test('attention center ranks critical records before routine waiting items',()=>{
 const result=filterAttention(rows)
 assert.deepEqual(result.slice(0,2).map(row=>row.plate),['PO 2','PO 3'])
 assert.equal(attentionMeta(result[0]).tone,'critical')
})

test('attention center filters groups and searches without Polish diacritics',()=>{
 assert.deepEqual(filterAttention(rows,{group:'PARTS'}).map(row=>row.plate),['PO 2'])
 assert.deepEqual(filterAttention(rows,{query:'wyciek'}).map(row=>row.plate),['PO 3'])
})

test('attention center reports operational counters and readable age',()=>{
 assert.deepEqual(attentionStats(rows),{total:4,critical:2,WAITING:1,CONTACT:0,PARTS:1,DECISIONS:1,VEHICLE:1})
 assert.equal(ageLabel('2026-09-12T10:00:00Z',Date.parse('2026-09-12T12:00:00Z')),'2 godz. temu')
})

test('attention headline uses Polish plural forms',()=>{
 assert.equal(attentionHeadline(0),'Warsztat jest pod kontrolą')
 assert.equal(attentionHeadline(1),'1 sprawa wymaga reakcji')
 assert.equal(attentionHeadline(2),'2 sprawy wymagają reakcji')
 assert.equal(attentionHeadline(12),'12 spraw wymaga reakcji')
 assert.equal(attentionHeadline(24),'24 sprawy wymagają reakcji')
})
