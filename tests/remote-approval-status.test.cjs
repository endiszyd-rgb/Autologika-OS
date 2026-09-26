const test = require('node:test')
const assert = require('node:assert/strict')
const { latestRemoteApprovals, effectiveRemoteApproval, remoteApprovalOutcome } = require('../electron/remote-approval-status.cjs')

test('latest link wins even when an older link is already superseded', () => {
  const rows = [
    { id: 'old', approval_local_id: 12, status: 'SUPERSEDED', created_at: '2026-09-25T10:00:00Z' },
    { id: 'new', approval_local_id: 12, status: 'PENDING', created_at: '2026-09-25T11:00:00Z' },
    { id: 'other', approval_local_id: 13, status: 'APPROVED', created_at: '2026-09-25T09:00:00Z' }
  ]
  const latest = latestRemoteApprovals(rows)
  assert.deepEqual(latest.map(row => [row.approval_local_id, row.status]), [[12, 'PENDING'], [13, 'APPROVED']])
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
