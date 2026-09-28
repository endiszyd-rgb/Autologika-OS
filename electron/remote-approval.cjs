const crypto = require('crypto')

const TERMS_VERSION = 'repair-approval-pl-v1'
const TERMS_TEXT = 'Potwierdzam zapoznanie się z przedstawionym zakresem prac oraz kosztami i wyrażam zgodę na wykonanie wskazanych prac.'

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue)
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]))
  return value
}
function canonicalJson(value){return JSON.stringify(stableValue(value))}
function sha256(value){return crypto.createHash('sha256').update(value).digest('hex')}
function quoteIdFromScope(scope){return Number(String(scope||'').match(/^Wycena #(\d+)(?:\s*·|$)/)?.[1]||0)}
const number=value=>Math.round((Number(value)||0)*100)/100

function buildApprovalSnapshot(db,approvalId){
  const approval=db.prepare('SELECT * FROM approvals WHERE id=?').get(Number(approvalId))
  if(!approval)throw new Error('Akceptacja nie istnieje.')
  const quoteId=quoteIdFromScope(approval.scope)
  if(!quoteId)throw new Error('Akceptacja nie wskazuje dokładnej wersji kosztorysu.')
  const quote=db.prepare('SELECT * FROM quotes WHERE id=? AND order_id=?').get(quoteId,approval.order_id)
  if(!quote)throw new Error('Nie znaleziono zamrożonego kosztorysu tej akceptacji.')
  const order=db.prepare(`SELECT o.id,o.cloud_id,o.title,o.complaint,o.opened_at,v.id vehicle_id,v.cloud_id vehicle_cloud_id,
      v.plate,v.vin,v.make,v.model,v.year,v.engine,c.name customer_name,c.company customer_company,c.email customer_email
    FROM orders o JOIN vehicles v ON v.id=o.vehicle_id LEFT JOIN customers c ON c.id=v.customer_id WHERE o.id=?`).get(approval.order_id)
  if(!order)throw new Error('Nie znaleziono pojazdu dla akceptacji.')
  const rows=db.prepare('SELECT * FROM quote_items WHERE quote_id=? ORDER BY id').all(quoteId)
  if(!rows.length)throw new Error('Nie można udostępnić pustego kosztorysu.')
  const sequence=Number(db.prepare('SELECT COUNT(*) count FROM approvals WHERE order_id=? AND id<=?').get(approval.order_id,approval.id)?.count||1)
  const previouslyApprovedTotal=number(db.prepare("SELECT COALESCE(SUM(amount),0) total FROM approvals WHERE order_id=? AND id<? AND status='APPROVED'").get(approval.order_id,approval.id)?.total)
  const items=rows.map((item,index)=>{
    const quantity=item.kind==='ROBOCIZNA'?number(item.labor_hours||1):number(item.qty||1)
    const unitPrice=item.kind==='ROBOCIZNA'?number(item.labor_rate):number(item.unit_price)
    return {position:index+1,kind:item.kind,name:item.work_name||item.name,variant:item.variant_name||'',description:item.customer_description||item.notes||'',quantity,unit:item.kind==='ROBOCIZNA'?'h':'szt.',unitPrice,value:number(quantity*unitPrice),vatRate:null,partNumber:item.part_no||'',oeNumber:item.oe_number||'',brand:item.brand||'',vehicleFitment:item.vehicle_fitment||''}
  })
  const total=number(items.reduce((sum,item)=>sum+item.value,0))
  const currentOrderSnapshot=quote.source_type==='ORDER_SNAPSHOT'
  const displayedPreviousTotal=currentOrderSnapshot?0:previouslyApprovedTotal
  const snapshot={
    schemaVersion:2,approvalId:approval.id,approvalSequence:sequence,quoteId,orderId:order.id,orderCloudId:order.cloud_id||'',
    documentNo:`AL-${String(order.id).padStart(5,'0')}`,approvalDocumentNo:`AL-${String(order.id).padStart(5,'0')}-A${String(sequence).padStart(2,'0')}`,
    createdAt:new Date().toISOString(),scope:approval.scope||'',additionalScope:currentOrderSnapshot?false:(sequence>1||previouslyApprovedTotal>0),
    previouslyApprovedTotal:displayedPreviousTotal,additionalTotal:total,newCombinedTotal:number(displayedPreviousTotal+total),
    vehicle:{id:order.vehicle_id,cloudId:order.vehicle_cloud_id||'',make:order.make||'',model:order.model||'',year:order.year||null,engine:order.engine||'',plate:order.plate||'',vin:order.vin||''},
    customer:{name:order.customer_name||'',company:order.customer_company||'',email:order.customer_email||''},
    order:{title:order.title||'',complaint:order.complaint||'',openedAt:order.opened_at||''},items,
    totals:{net:null,vat:null,gross:total,currency:'PLN'},notes:approval.note||'',terms:{version:TERMS_VERSION,text:TERMS_TEXT}
  }
  const canonical=canonicalJson(snapshot)
  return {approval,quote,order,snapshot,canonical,snapshotHash:sha256(canonical),hashAlgorithm:'SHA-256',sequence,quoteId,total,previouslyApprovedTotal}
}

module.exports={TERMS_VERSION,TERMS_TEXT,stableValue,canonicalJson,sha256,quoteIdFromScope,buildApprovalSnapshot}
