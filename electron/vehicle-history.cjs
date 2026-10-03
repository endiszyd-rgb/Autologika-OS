function vehicleHistoryDetails(db, vehicleId) {
  const id = Number(vehicleId)
  if (!Number.isInteger(id) || id <= 0) return { works: [], documents: [], approvals: [] }
  const works = db.prepare(`SELECT i.*,o.title order_title,o.opened_at,o.status order_status
    FROM order_items i JOIN orders o ON o.id=i.order_id
    WHERE o.vehicle_id=? AND i.deleted_at IS NULL
    ORDER BY o.opened_at DESC,i.id DESC`).all(id)
  const documents = db.prepare(`SELECT a.*,o.title order_title,o.opened_at
    FROM attachments a JOIN orders o ON o.id=a.order_id
    WHERE o.vehicle_id=? AND a.deleted_at IS NULL
    ORDER BY a.created_at DESC,a.id DESC`).all(id)
  const approvals = db.prepare(`SELECT a.*,o.title order_title,o.opened_at
    FROM approvals a JOIN orders o ON o.id=a.order_id
    WHERE o.vehicle_id=? AND a.deleted_at IS NULL
    ORDER BY COALESCE(a.decided_at,a.created_at) DESC,a.id DESC`).all(id)
  return { works, documents, approvals }
}

module.exports = { vehicleHistoryDetails }
