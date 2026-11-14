/** Audit and mutation share the SQLite transaction, including sync triggers. */
function withQuoteHistory(db,{orderId,itemId,action},mutate){
 return db.transaction(()=>{
  const item=itemId?db.prepare('SELECT * FROM quote_items WHERE id=?').get(itemId):null
  const quote=item?db.prepare('SELECT * FROM quotes WHERE id=?').get(item.quote_id):null
  const target=orderId??quote?.order_id
  if(!target)return mutate()
  const snapshot=()=>db.prepare('SELECT qi.* FROM quote_items qi JOIN quotes q ON q.id=qi.quote_id WHERE q.order_id=? ORDER BY qi.id').all(target)
  const before=snapshot(),result=mutate(),after=snapshot()
  if(JSON.stringify(before)!==JSON.stringify(after))db.prepare('INSERT INTO order_events(order_id,event_type,title,details) VALUES (?,?,?,?)').run(target,'QUOTE_CHANGED',action,JSON.stringify({version:1,before,after}))
  return result
 })()
}
module.exports={withQuoteHistory}
