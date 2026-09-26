import test from 'node:test'
import assert from 'node:assert/strict'
import {approvalLinkState} from '../src/approval-link-state.mjs'

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
