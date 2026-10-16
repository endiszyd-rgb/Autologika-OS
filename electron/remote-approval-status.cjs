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
    const cloudId = String(row.approval_cloud_id || '').trim()
    const localId = String(row.approval_local_id ?? '').trim()
    const key = cloudId ? `cloud:${cloudId}` : localId ? `local:${localId}` : row.id ? `remote:${row.id}` : ''
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function remoteApprovalLookupFilter(approval = {}) {
  const cloudId = String(approval.cloud_id || '').trim()
  if (cloudId) return `approval_cloud_id=eq.${encodeURIComponent(cloudId)}`
  const localId = Number(approval.id)
  if (!Number.isInteger(localId) || localId <= 0) throw new Error('Nieprawidłowy identyfikator akceptacji.')
  return `approval_local_id=eq.${localId}`
}

function effectiveRemoteApproval(row, now = Date.now()) {
  const status = String(row?.status || '').toUpperCase()
  const expiresAt = timestamp(row?.expires_at)
  if (status === 'PENDING' && expiresAt > 0 && expiresAt <= now) return { ...row, status: 'EXPIRED' }
  return { ...row, status: status || 'PENDING' }
}

function assertRemoteApprovalLinkable(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'APPROVED') throw new Error('Zaakceptowana wycena nie może otrzymać nowego linku.')
  if (value === 'DECLINED') throw new Error('Odrzucona wycena wymaga utworzenia nowej wersji przed wysłaniem linku.')
  if (!['PENDING', 'EXPIRED', 'SUPERSEDED'].includes(value)) throw new Error('Akceptacja nie jest gotowa do wysłania klientowi.')
  return value
}

function shouldApplyRemoteDecision(localStatus, remoteStatus) {
  const local = String(localStatus || '').toUpperCase()
  const remote = String(remoteStatus || '').toUpperCase()
  if (!['APPROVED', 'DECLINED'].includes(remote)) return local === 'PENDING' && TERMINAL_REMOTE_STATUSES.has(remote)
  return ['PENDING', 'EXPIRED', 'SUPERSEDED'].includes(local)
}

function remoteApprovalOutcome(status) {
  const value = String(status || '').toUpperCase()
  if (value === 'APPROVED') return { status: value, terminal: true, eventTitle: 'Klient zaakceptował kosztorys online', toastTitle: 'Klient zaakceptował kosztorys', tone: 'approved', icon: '✓' }
  if (value === 'DECLINED') return { status: value, terminal: true, eventTitle: 'Klient odrzucił kosztorys online', toastTitle: 'Klient odrzucił kosztorys', tone: 'declined', icon: '×' }
  if (value === 'EXPIRED') return { status: value, terminal: true, eventTitle: 'Link akceptacyjny wygasł', toastTitle: 'Link akceptacyjny wygasł', tone: 'warning', icon: '!' }
  if (value === 'SUPERSEDED') return { status: value, terminal: true, eventTitle: 'Link akceptacyjny został zastąpiony', toastTitle: 'Link akceptacyjny został zastąpiony', tone: 'warning', icon: '↻' }
  return { status: 'PENDING', terminal: false, eventTitle: 'Oczekiwanie na decyzję online', toastTitle: 'Oczekiwanie na decyzję klienta', tone: 'pending', icon: '…' }
}

module.exports = { TERMINAL_REMOTE_STATUSES, latestRemoteApprovals, remoteApprovalLookupFilter, effectiveRemoteApproval, assertRemoteApprovalLinkable, shouldApplyRemoteDecision, remoteApprovalOutcome }
