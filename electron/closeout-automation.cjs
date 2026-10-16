const { deriveOrderReadiness } = require('./order-readiness.cjs')

function syncCloseoutAutomation(db,orderId){
  const id=Number(orderId)
  if(!Number.isInteger(id)||id<=0)throw new Error('Nieprawidłowy identyfikator zlecenia.')
  if(!db.prepare('SELECT id FROM orders WHERE id=?').get(id))throw new Error('Zlecenie nie istnieje.')
  const raw=db.prepare(`SELECT
    COALESCE((SELECT status='APPROVED' FROM approvals WHERE order_id=? ORDER BY julianday(COALESCE(decided_at,created_at)) DESC,id DESC LIMIT 1),0) customer_approved,
    EXISTS(SELECT 1 FROM diagnostics WHERE order_id=? AND (TRIM(COALESCE(symptom_confirmed,''))!='' OR TRIM(COALESCE(conclusion,''))!='' OR TRIM(COALESCE(recommendation,''))!='')) diagnosis_documented,
    NOT EXISTS(SELECT 1 FROM job_part_orders WHERE order_id=? AND status NOT IN ('ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE')) parts_documented,
    EXISTS(SELECT 1 FROM work_logs WHERE order_id=? AND ended_at IS NOT NULL) work_logged,
    (SELECT COUNT(DISTINCT check_key) FROM order_qc WHERE order_id=? AND deleted_at IS NULL AND checked=1 AND check_key IN ('symptom','dtc','leaks','torque','road','warning','clean','recommend'))=8 qc_done,
    COALESCE((SELECT SUM(amount) FROM payments WHERE order_id=?),0) paid_total,
    COALESCE((SELECT COALESCE(final_price,COALESCE(labor_hours,0)*COALESCE(labor_rate,0)+COALESCE(parts_sale,0)+COALESCE(other_sale,0)+COALESCE(diagnosis_fee,0)-COALESCE(discount,0)) FROM orders WHERE id=?),0) billed_total,
    EXISTS(SELECT 1 FROM order_notes WHERE order_id=? AND TRIM(COALESCE(release_notes,''))!='') release_notes_done`)
    .get(id,id,id,id,id,id,id,id)
  const state=deriveOrderReadiness(raw)
  db.prepare(`INSERT INTO closeout_checks(order_id,customer_approved,diagnosis_documented,parts_documented,work_logged,qc_done,payment_checked,release_notes_done,updated_at)
    VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(order_id) DO UPDATE SET
      customer_approved=excluded.customer_approved,
      diagnosis_documented=excluded.diagnosis_documented,
      parts_documented=excluded.parts_documented,
      work_logged=excluded.work_logged,
      qc_done=excluded.qc_done,
      payment_checked=excluded.payment_checked,
      release_notes_done=excluded.release_notes_done,
      updated_at=CURRENT_TIMESTAMP`)
    .run(id,state.customer_approved?1:0,state.diagnosis_documented?1:0,state.parts_documented?1:0,state.work_logged?1:0,state.qc_done?1:0,state.payment_checked?1:0,state.release_notes_done?1:0)
  return db.prepare('SELECT * FROM closeout_checks WHERE order_id=?').get(id)
}

function reconcileCloseoutAutomation(db){
  const rows=db.prepare('SELECT id FROM orders').all()
  for(const row of rows)syncCloseoutAutomation(db,row.id)
  return rows.length
}

module.exports={syncCloseoutAutomation,reconcileCloseoutAutomation}
