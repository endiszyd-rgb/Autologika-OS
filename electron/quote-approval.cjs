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

module.exports = { findQuoteApproval, assertQuoteEditable }
