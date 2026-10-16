const test = require('node:test')
const assert = require('node:assert/strict')
const { latestRemoteApprovals, remoteApprovalLookupFilter, effectiveRemoteApproval, assertRemoteApprovalLinkable, shouldApplyRemoteDecision, shouldReconcileRemoteApproval, remoteApprovalOutcome } = require('../electron/remote-approval-status.cjs')

test('latest link wins even when an older link is already superseded', () => {
  const rows = [
    { id: 'old', approval_local_id: 12, status: 'SUPERSEDED', created_at: '2026-09-25T10:00:00Z' },
    { id: 'new', approval_local_id: 12, status: 'PENDING', created_at: '2026-09-25T11:00:00Z' },
    { id: 'other', approval_local_id: 13, status: 'APPROVED', created_at: '2026-09-25T09:00:00Z' }
  ]
  const latest = latestRemoteApprovals(rows)
  assert.deepEqual(latest.map(row => [row.approval_local_id, row.status]), [[12, 'PENDING'], [13, 'APPROVED']])
})

test('one cloud approval is grouped across different device-local ids', () => {
  const rows = [
    { id:'new',approval_local_id:9001,approval_cloud_id:'approval-shared',status:'APPROVED',created_at:'2026-10-16T12:00:00Z' },
    { id:'old',approval_local_id:12,approval_cloud_id:'approval-shared',status:'SUPERSEDED',created_at:'2026-10-15T12:00:00Z' }
  ]
  assert.deepEqual(latestRemoteApprovals(rows).map(row=>row.id),['new'])
})

test('remote lookup prefers the synchronized cloud id and falls back to a local id', () => {
  assert.equal(remoteApprovalLookupFilter({id:12,cloud_id:'shared/id'}),'approval_cloud_id=eq.shared%2Fid')
  assert.equal(remoteApprovalLookupFilter({id:12,cloud_id:''}),'approval_local_id=eq.12')
  assert.throws(()=>remoteApprovalLookupFilter({}),/identyfikator/)
})

test('remote statuses have distinct workflow messages', () => {
  assert.equal(remoteApprovalOutcome('APPROVED').tone, 'approved')
  assert.equal(remoteApprovalOutcome('DECLINED').tone, 'declined')
  assert.equal(remoteApprovalOutcome('EXPIRED').eventTitle, 'Link akceptacyjny wygasł')
  assert.equal(remoteApprovalOutcome('SUPERSEDED').toastTitle, 'Link akceptacyjny został zastąpiony')
  assert.equal(remoteApprovalOutcome('PENDING').terminal, false)
})

test('pending link becomes expired when its deadline passes', () => {
  const now = Date.parse('2026-09-26T12:00:00Z')
  assert.equal(effectiveRemoteApproval({ status: 'PENDING', expires_at: '2026-09-26T11:59:59Z' }, now).status, 'EXPIRED')
  assert.equal(effectiveRemoteApproval({ status: 'PENDING', expires_at: '2026-09-26T12:00:01Z' }, now).status, 'PENDING')
  assert.equal(effectiveRemoteApproval({ status: 'APPROVED', expires_at: '2026-09-20T12:00:00Z' }, now).status, 'APPROVED')
  assert.equal(effectiveRemoteApproval({ status: 'PENDING', expires_at: 'invalid' }, now).status, 'PENDING')
})

test('new links are limited to open or replaceable approvals', () => {
  for (const status of ['PENDING', 'EXPIRED', 'SUPERSEDED']) assert.equal(assertRemoteApprovalLinkable(status), status)
  assert.throws(() => assertRemoteApprovalLinkable('APPROVED'), /Zaakceptowana wycena/)
  assert.throws(() => assertRemoteApprovalLinkable('DECLINED'), /nowej wersji/)
  assert.throws(() => assertRemoteApprovalLinkable(''), /nie jest gotowa/)
})

test('an authoritative customer decision survives a local expiry race', () => {
  assert.equal(shouldApplyRemoteDecision('PENDING', 'EXPIRED'), true)
  assert.equal(shouldApplyRemoteDecision('EXPIRED', 'APPROVED'), true)
  assert.equal(shouldApplyRemoteDecision('SUPERSEDED', 'DECLINED'), true)
  assert.equal(shouldApplyRemoteDecision('EXPIRED', 'EXPIRED'), false)
  assert.equal(shouldApplyRemoteDecision('APPROVED', 'DECLINED'), false)
  assert.equal(shouldApplyRemoteDecision('DECLINED', 'APPROVED'), false)
})

test('manual refresh reconciles a replacement link with stale local status', () => {
  assert.equal(shouldReconcileRemoteApproval('EXPIRED', 'PENDING'), true)
  assert.equal(shouldReconcileRemoteApproval('SUPERSEDED', 'PENDING'), true)
  assert.equal(shouldReconcileRemoteApproval('PENDING', 'PENDING'), false)
  assert.equal(shouldReconcileRemoteApproval('APPROVED', 'PENDING'), false)
  assert.equal(shouldReconcileRemoteApproval('PENDING', 'APPROVED'), true)
})
