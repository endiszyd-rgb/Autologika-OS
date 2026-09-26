const TERMINAL_REMOTE_STATUSES = new Set(['APPROVED', 'DECLINED', 'EXPIRED', 'SUPERSEDED'])

function timestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : 0
}

function latestRemoteApprovals(rows = []) {
  const sorted = [...rows].sort((a, b) => {
    return timestamp(b.created_at) - timestamp(a.created_at)
  })
  const seen = new Set()
  return sorted.filter(row => {
    const key = String(row.approval_local_id ?? '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function effectiveRemoteApproval(row, now = Date.now()) {
  const status = String(row?.status || '').toUpperCase()
  const expiresAt = timestamp(row?.expires_at)
  if (status === 'PENDING' && expiresAt > 0 && expiresAt <= now) return { ...row, status: 'EXPIRED' }
  return { ...row, status: status || 'PENDING' }
}

function remoteApprovalOutcome(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'APPROVED') return { status: value, terminal: true, eventTitle: 'Klient zaakceptował kosztorys online', toastTitle: 'Klient zaakceptował kosztorys', tone: 'approved', icon: '✓' }
  if (value === 'DECLINED') return { status: value, terminal: true, eventTitle: 'Klient odrzucił kosztorys online', toastTitle: 'Klient odrzucił kosztorys', tone: 'declined', icon: '×' }
  if (value === 'EXPIRED') return { status: value, terminal: true, eventTitle: 'Link akceptacyjny wygasł', toastTitle: 'Link akceptacyjny wygasł', tone: 'warning', icon: '!' }
  if (value === 'SUPERSEDED') return { status: value, terminal: true, eventTitle: 'Link akceptacyjny został zastąpiony', toastTitle: 'Link akceptacyjny został zastąpiony', tone: 'warning', icon: '↻' }
  return { status: 'PENDING', terminal: false, eventTitle: 'Oczekiwanie na decyzję online', toastTitle: 'Oczekiwanie na decyzję klienta', tone: 'pending', icon: '…' }
}

module.exports = { TERMINAL_REMOTE_STATUSES, latestRemoteApprovals, effectiveRemoteApproval, remoteApprovalOutcome }
