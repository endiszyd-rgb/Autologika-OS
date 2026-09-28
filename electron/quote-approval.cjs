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

function replaceQuoteWithOrderSnapshot(db, quote) {
  assertQuoteEditable(db, quote)
  const order = db.prepare('SELECT * FROM orders WHERE id=?').get(quote.order_id)
  if (!order) throw new Error('Zlecenie nie istnieje.')
  const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(quote.order_id)
  const plannedParts = db.prepare(`SELECT * FROM job_part_orders WHERE order_id=?
    AND status IN ('DO_ZAMOWIENIA','ZAMOWIONE','W_DRODZE','ODEBRANE') ORDER BY id`).all(quote.order_id)
  const insert = db.prepare(`INSERT INTO quote_items(
    quote_id,kind,name,qty,unit_cost,unit_price,labor_hours,labor_rate,notes,
    catalog_work_id,catalog_variant_id,work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot,
    part_no,oe_number,inventory_part_id,supplier_name,barcode,brand,vehicle_fitment,cross_numbers,lookup_source,lookup_url,
    source_order_item_id,source_job_part_id
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  let subtotal = 0
  for (const item of orderItems) {
    const labor = item.kind === 'ROBOCIZNA'
    const qty = labor ? Number(item.hours_snapshot ?? item.qty ?? 1) : Number(item.qty || 1)
    const price = labor ? Number(item.unit_price || order.labor_rate || 0) : Number(item.unit_price || 0)
    const value = qty * price
    subtotal += value
    insert.run(
      quote.id,item.kind,item.name,Number(item.qty||1),Number(item.unit_cost||0),Number(item.unit_price||0),labor?qty:0,labor?price:0,item.notes||'',
      item.catalog_work_id||null,item.catalog_variant_id||null,item.work_name||item.name,item.variant_name||'',item.customer_description||item.notes||'',item.technical_description||'',labor?qty:(item.hours_snapshot??null),value,
      item.part_no||'',item.oe_number||'',item.inventory_part_id||null,item.supplier||'',item.barcode||'',item.brand||'',item.vehicle_fitment||'',item.cross_numbers||'',item.lookup_source||'',item.lookup_url||'',
      item.id,null
    )
  }
  for (const part of plannedParts) {
    const qty = Number(part.qty || 1), price = Number(part.unit_price || 0), value = qty * price
    subtotal += value
    insert.run(
      quote.id,'CZESC',part.name,qty,Number(part.unit_cost||0),price,0,0,part.notes||'',
      null,null,part.name,'',part.notes||'',part.notes||'',null,value,
      part.part_no||'',part.oe_number||'',part.inventory_part_id||null,part.supplier_name||'',part.barcode||'',part.brand||'',part.vehicle_fitment||'',part.cross_numbers||'',part.lookup_source||'',part.lookup_url||'',
      null,part.id
    )
  }
  const addAdjustment = (kind, name, amount, note) => {
    const value = Math.round(Number(amount || 0) * 100) / 100
    if (!value) return
    subtotal += value
    insert.run(quote.id,kind,name,1,0,value,0,0,note||'',null,null,name,'',note||'',note||'',null,value,'','',null,'','','','','','','',null,null)
  }
  addAdjustment('OPLATA','Diagnostyka',Number(order.diagnosis_fee||0),'Opłata diagnostyczna zapisana w zleceniu')
  addAdjustment('RABAT','Rabat',-Number(order.discount||0),'Rabat zapisany w zleceniu')
  if (order.final_price !== null && order.final_price !== undefined) {
    addAdjustment('KOREKTA','Korekta ceny końcowej',Number(order.final_price)-subtotal,order.final_price_note||'Uzgodniona cena końcowa')
  }
  db.prepare("UPDATE quotes SET source_type='ORDER_SNAPSHOT',source_imported_at=CURRENT_TIMESTAMP WHERE id=?").run(quote.id)
  return { ok:true, quoteId:quote.id, itemCount:orderItems.length+plannedParts.length, total:Math.round(subtotal*100)/100 }
}

function materializeApprovedQuote(db, approvalOrQuoteId) {
  const quoteId = quoteIdFromApproval(approvalOrQuoteId)
  if (!quoteId) return { prepared: false, parts: 0, quoteId: 0, reason: 'QUOTE_NOT_LINKED' }
  const quote = db.prepare('SELECT * FROM quotes WHERE id=?').get(quoteId)
  if (!quote) return { prepared: false, parts: 0, quoteId, reason: 'QUOTE_NOT_FOUND' }
  if (quote.status === 'ZAAKCEPTOWANA') return { ok: true, prepared: false, parts: 0, quoteId, already: true }

  if (quote.source_type === 'ORDER_SNAPSHOT') {
    const openParts = Number(db.prepare(`SELECT COUNT(*) count FROM job_part_orders WHERE order_id=?
      AND status IN ('DO_ZAMOWIENIA','ZAMOWIONE','W_DRODZE')`).get(quote.order_id)?.count || 0)
    db.prepare("UPDATE quotes SET status='ZAAKCEPTOWANA',accepted_at=CURRENT_TIMESTAMP WHERE id=?").run(quoteId)
    db.prepare("UPDATE orders SET status='NAPRAWA',wait_state=? WHERE id=?").run(openParts ? 'CZESCI' : 'BRAK', quote.order_id)
    db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(
      quote.order_id,'QUOTE_APPROVED','Klient zaakceptował aktualny zakres zlecenia',`Kosztorys #${quoteId} · ${openParts ? 'oczekiwanie na części' : 'zakres gotowy do realizacji'}`
    )
    return { ok:true, prepared:true, parts:0, partsPrepared:0, quoteId, orderId:quote.order_id, sourceSnapshot:true }
  }

  const items = db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY id').all(quoteId)
  let parts = 0
  const insertOrderItem = db.prepare(`INSERT INTO order_items(
    order_id,kind,name,qty,unit_cost,unit_price,notes,catalog_work_id,catalog_variant_id,
    work_name,variant_name,customer_description,technical_description,hours_snapshot,price_snapshot
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const vehicle = db.prepare(`SELECT v.id vehicle_id,v.plate,v.vin,v.make,v.model,v.generation,v.year,v.engine,v.engine_code
    FROM orders o JOIN vehicles v ON v.id=o.vehicle_id WHERE o.id=?`).get(quote.order_id) || {}
  const vehicleSnapshot = JSON.stringify(vehicle)
  const insertPart = db.prepare(`INSERT INTO job_part_orders(
    order_id,supplier_name,part_no,oe_number,inventory_part_id,vehicle_snapshot,barcode,brand,vehicle_fitment,cross_numbers,
    lookup_source,lookup_url,name,qty,unit_cost,unit_price,status,notes
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'DO_ZAMOWIENIA',?)`)

  for (const item of items) {
    if (item.kind === 'CZESC') {
      insertPart.run(
        quote.order_id,item.supplier_name||'',item.part_no||'',item.oe_number||'',item.inventory_part_id||null,vehicleSnapshot,
        item.barcode||'',item.brand||'',item.vehicle_fitment||'',item.cross_numbers||'',item.lookup_source||'',item.lookup_url||'',
        item.name,Number(item.qty||1),Number(item.unit_cost||0),Number(item.unit_price||0),`Z zaakceptowanego kosztorysu #${quoteId}`
      )
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

module.exports = { findQuoteApproval, assertQuoteEditable, quoteIdFromApproval, replaceQuoteWithOrderSnapshot, materializeApprovedQuote }
