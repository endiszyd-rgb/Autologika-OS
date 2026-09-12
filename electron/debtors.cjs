const ORDER_TOTAL=`COALESCE(o.labor_hours,0)*COALESCE(o.labor_rate,0)+COALESCE(o.parts_sale,0)+COALESCE(o.other_sale,0)+COALESCE(o.diagnosis_fee,0)-COALESCE(o.discount,0)`

function listDebtors(db){
  return db.prepare(`WITH balances AS (
    SELECT o.*,v.plate,v.make,v.model,v.vin,c.name customer,c.phone,c.email,
      ROUND(${ORDER_TOTAL},2) total,
      ROUND(COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id),0),2) paid
    FROM orders o
    JOIN vehicles v ON v.id=o.vehicle_id
    LEFT JOIN customers c ON c.id=v.customer_id
    WHERE o.status IN ('GOTOWE','WYDANE')
  )
  SELECT *,ROUND(MAX(0,total-paid),2) balance
  FROM balances
  WHERE total-paid>0.01
  ORDER BY balance DESC,opened_at`).all()
}

module.exports={listDebtors}
