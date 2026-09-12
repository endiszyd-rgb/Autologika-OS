const ORDER_VALUE=`COALESCE(o.labor_hours,0)*COALESCE(o.labor_rate,0)+COALESCE(o.parts_sale,0)+COALESCE(o.other_sale,0)+COALESCE(o.diagnosis_fee,0)-COALESCE(o.discount,0)`
const ORDER_COST=`COALESCE(o.parts_cost,0)+COALESCE(o.other_cost,0)`

function customerProfile(db,id){
  const customer=db.prepare('SELECT * FROM customers WHERE id=?').get(id)
  if(!customer)return null

  const vehicles=db.prepare(`SELECT v.*,
    COUNT(DISTINCT o.id) order_count,
    MAX(o.opened_at) last_visit,
    ROUND(COALESCE(SUM(${ORDER_VALUE}),0),2) revenue
    FROM vehicles v
    LEFT JOIN orders o ON o.vehicle_id=v.id
    WHERE v.customer_id=?
    GROUP BY v.id
    ORDER BY COALESCE(MAX(o.opened_at),v.created_at) DESC,v.id DESC`).all(id)

  const orders=db.prepare(`SELECT o.*,v.plate,v.make,v.model,v.vin,
    ROUND(${ORDER_VALUE},2) total,
    ROUND((${ORDER_VALUE})-(${ORDER_COST}),2) contribution,
    ROUND(COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id),0),2) paid,
    ROUND(MAX(0,(${ORDER_VALUE})-COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id=o.id),0)),2) balance
    FROM orders o JOIN vehicles v ON v.id=o.vehicle_id
    WHERE v.customer_id=?
    ORDER BY o.opened_at DESC,o.id DESC`).all(id)

  const payments=db.prepare(`SELECT p.*,o.title,v.plate
    FROM payments p
    JOIN orders o ON o.id=p.order_id
    JOIN vehicles v ON v.id=o.vehicle_id
    WHERE v.customer_id=?
    ORDER BY p.paid_at DESC,p.id DESC LIMIT 12`).all(id)

  const totals=orders.reduce((result,order)=>{
    result.revenue+=Number(order.total||0)
    result.paid+=Number(order.paid||0)
    result.balance+=Number(order.balance||0)
    result.contribution+=Number(order.contribution||0)
    if(order.status!=='WYDANE'&&!order.archived_at)result.active+=1
    return result
  },{revenue:0,paid:0,balance:0,contribution:0,active:0})

  for(const key of ['revenue','paid','balance','contribution'])totals[key]=Math.round(totals[key]*100)/100
  return {customer,vehicles,orders,payments,totals}
}

module.exports={customerProfile}
