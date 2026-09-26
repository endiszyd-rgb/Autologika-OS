// Match the complete identifier, including the separator used by saved scopes.
function findQuoteApproval(db, orderId, quoteId) {
  const scope = `Wycena #${quoteId}`
  return db.prepare(`SELECT * FROM approvals WHERE order_id=?
    AND (scope=? OR scope LIKE ?) ORDER BY id DESC LIMIT 1`)
    .get(orderId, scope, `${scope} · %`)
}

function assertQuoteEditable(db, quote) {
  if (!quote || quote.status !== 'ROBOCZA' || findQuoteApproval(db, quote.order_id, quote.id)) {
    throw new Error('Kosztorys został zamrożony. Nie można zmieniać zakresu przekazanego do akceptacji.')
  }
}

function quoteIdFromApproval(value) {
  if (Number.isInteger(Number(value)) && Number(value) > 0) return Number(value)
  const match = String(value?.scope || '').match(/Wycena #(\d+)/)
  return match ? Number(match[1]) : 0
}

function materializeApprovedQuote(db, approvalOrQuoteId) {
  const quoteId = quoteIdFromApproval(approvalOrQuoteId)
  if (!quoteId) return { prepared: false, parts: 0, quoteId: 0, reason: 'QUOTE_NOT_LINKED' }
  const quote = db.prepare('SELECT * FROM quotes WHERE id=?').get(quoteId)
  if (!quote) return { prepared: false, parts: 0, quoteId, reason: 'QUOTE_NOT_FOUND' }
  if (quote.status === 'ZAAKCEPTOWANA') return { ok: true, prepared: false, parts: 0, quoteId, already: true }

  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY id').all(quoteId)
  let parts = 0
  const insertOrderItem = db.prepare(`INSERT INTO order_items(
    order_id,kind,name,qty,unit_cost,unit_price,notes,catalog_work_id,catalog_variant_id,
    work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const insertPart = db.prepare(`INSERT INTO job_part_orders(order_id,part_no,name,qty,unit_cost,unit_price,status,notes)
    VALUES (?,?,?,?,?,?,'DO_ZAMOWIENIA',?)`)

  for (const item of items) {
    if (item.kind === 'CZESC') {
      insertPart.run(quote.order_id, '', item.name, Number(item.qty || 1), Number(item.unit_cost || 0), Number(item.unit_price || 0), `Z zaakceptowanego kosztorysu #${quoteId}`)
      parts++
      continue
    }
    const labor = item.kind === 'ROBOCIZNA'
    const quantity = labor ? Number(item.labor_hours || 1) : Number(item.qty || 1)
    const unitCost = labor ? 0 : Number(item.unit_cost || 0)
    const unitPrice = labor ? Number(item.labor_rate || 220) : Number(item.unit_price || 0)
    insertOrderItem.run(
      quote.order_id, item.kind, item.name, quantity, unitCost, unitPrice, item.customer_description || item.notes || '',
      item.catalog_work_id || null, item.catalog_variant_id || null, item.work_name || item.name,
      item.variant_name || '', item.customer_description || item.notes || '', item.technical_description || '',
      labor ? Number(item.hours_snapshot ?? item.labor_hours ?? 1) : (item.hours_snapshot ?? null),
      Number(item.price_snapshot ?? quantity * unitPrice)
    )
  }

  const sums = db.prepare(`SELECT
    COALESCE(SUM(CASE WHEN kind='CZESC' THEN qty*unit_cost ELSE 0 END),0) pc,
    COALESCE(SUM(CASE WHEN kind='CZESC' THEN qty*unit_price ELSE 0 END),0) ps,
    COALESCE(SUM(CASE WHEN kind!='CZESC' THEN qty*unit_cost ELSE 0 END),0) oc,
    COALESCE(SUM(CASE WHEN kind!='CZESC' THEN qty*unit_price ELSE 0 END),0) os
    FROM order_items WHERE order_id=?`).get(quote.order_id)
  db.prepare('UPDATE orders SET parts_cost=?,parts_sale=?,other_cost=?,other_sale=?,status=?,wait_state=? WHERE id=?')
    .run(sums.pc, sums.ps, sums.oc, sums.os, parts ? 'AKCEPTACJA' : 'NAPRAWA', parts ? 'CZESCI' : 'BRAK', quote.order_id)
  db.prepare("UPDATE quotes SET status='ZAAKCEPTOWANA',accepted_at=CURRENT_TIMESTAMP WHERE id=?").run(quoteId)
  db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(
    quote.order_id, 'QUOTE_PREPARED', parts ? 'Zakres zaakceptowany — części do zamówienia' : 'Zakres zaakceptowany — gotowe do naprawy',
    parts ? `${parts} pozycji części utworzono jako DO_ZAMOWIENIA` : 'Brak części blokujących rozpoczęcie naprawy'
  )
  return { ok: true, prepared: true, parts, partsPrepared: parts, quoteId, orderId: quote.order_id }
}

module.exports = { findQuoteApproval, assertQuoteEditable, quoteIdFromApproval, materializeApprovedQuote }
