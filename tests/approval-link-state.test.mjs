import test from 'node:test'
import assert from 'node:assert/strict'
import {approvalEventMatches,approvalLinkState} from '../src/approval-link-state.mjs'

const now=Date.parse('2026-09-26T12:00:00Z')

test('pending approval shows a readable active link lifetime',()=>{
 const state=approvalLinkState({status:'PENDING',remote_id:'r1',remote_expires_at:'2026-09-28T12:00:00Z'},now)
 assert.equal(state.status,'PENDING');assert.equal(state.active,true);assert.equal(state.relative,'Wygasa za 2 dni');assert.equal(state.hasRemoteLink,true)
})

test('locally expired link becomes actionable before the next cloud pull',()=>{
 const state=approvalLinkState({status:'PENDING',remote_id:'r1',remote_expires_at:'2026-09-26T11:30:00Z'},now)
 assert.equal(state.status,'EXPIRED');assert.equal(state.storedStatus,'PENDING');assert.equal(state.active,false);assert.equal(state.relative,'Wygasł 30 minut temu')
})

test('link due within a day is marked as expiring soon',()=>{
 const state=approvalLinkState({status:'PENDING',remote_expires_at:'2026-09-26T15:00:00Z'},now)
 assert.equal(state.expiringSoon,true);assert.equal(state.relative,'Wygasa za 3 godziny')
})

test('remote decision refreshes only its open quote',()=>{
 assert.equal(approvalEventMatches({approvalId:'17',orderId:4},{id:17},4),true)
 assert.equal(approvalEventMatches({approvalId:99,orderId:'4'},{id:17},4),true)
 assert.equal(approvalEventMatches({approvalId:99,orderId:8},{id:17},4),false)
 assert.equal(approvalEventMatches({},null,4),false)
})
