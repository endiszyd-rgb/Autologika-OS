const test = require('node:test')
const assert = require('node:assert/strict')
const { latestRemoteApprovals, remoteApprovalOutcome } = require('../electron/remote-approval-status.cjs')

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
