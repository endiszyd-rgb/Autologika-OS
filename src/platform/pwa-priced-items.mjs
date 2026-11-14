/** Financial edits and their audit event are written in one sync_records batch. */
export function createPricedItems(cloud,{normalize,repairs}){
 const same=(a,b)=>String(a)===String(b)
 const list=async id=>(await cloud.list('order_items')).filter(row=>id==null||same(row.order_id,id))
 const editable=async id=>{const order=await cloud.get('orders',id);if(!order||order.status==='WYDANE'||order.archived_at)throw new Error('Zamknięte zlecenie jest tylko do odczytu.')}
 const save=async(orderId,before,after,extra=[])=>{
  await editable(orderId)
  const id=before?.cloud_id||crypto.randomUUID(),order_cloud_id=cloud.resolveCloudId('orders',orderId)
  const entries=[{entity:'order_items',cloudId:id,payload:after?{...after,order_cloud_id}: {},remove:!after},...extra,{entity:'order_events',cloudId:crypto.randomUUID(),payload:{order_cloud_id,event_type:'ORDER_ITEM_CHANGED',title:!before?'Dodano pozycję wyceny':!after?'Usunięto pozycję wyceny':'Zmieniono pozycję wyceny',details:JSON.stringify({version:1,before,after}),created_at:new Date().toISOString()}}]
  return (await cloud.upsertMany(entries))[0]
 }
 return {list,create:async(id,data)=>save(id,null,normalize(data)),update:async(id,data)=>{
  const before=await cloud.get('order_items',id);if(!before)throw new Error('Pozycja nie istnieje.')
  const merged={...before,...data}
  if(data.qty!==undefined&&data.labor_hours===undefined)merged.labor_hours=data.qty
  if(data.unit_price!==undefined&&data.labor_rate===undefined)merged.labor_rate=data.unit_price
  const after=normalize(merged)
  if(before.repair_operation_id&&before.kind==='ROBOCIZNA')return repairs.update(before.repair_operation_id,{title:after.name,planned_hours:after.qty,labor_rate:after.unit_price,customer_description:after.customer_description||after.notes,technical_description:after.technical_description})
  return save(before.order_id,before,after)
 },remove:async id=>{
  const before=await cloud.get('order_items',id);if(!before)return true
  if(before.inventory_part_id)throw new Error('Zwrot części magazynowej wykonaj w Windows.')
  const extra=[]
  if(before.repair_operation_id){
   if(before.kind!=='ROBOCIZNA')throw new Error('Najpierw rozlicz część przypisaną do naprawy w Windows.')
   const parts=(await cloud.list('repair_parts')).filter(row=>same(row.repair_operation_id,before.repair_operation_id))
   if(parts.some(part=>Number(part.reserved_qty)>0||Number(part.issued_qty)>Number(part.returned_qty)||Number(part.installed_qty)>0||part.order_item_id))throw new Error('Najpierw rozlicz rezerwacje, zwroty i zamontowane części tej naprawy.')
   for(const entity of ['repair_parts','job_part_orders','order_qc','work_procedure_runs'])for(const row of await cloud.list(entity))if(same(row.repair_operation_id,before.repair_operation_id))extra.push({entity,cloudId:row.cloud_id,remove:true})
   extra.push({entity:'order_repair_operations',cloudId:cloud.resolveCloudId('order_repair_operations',before.repair_operation_id),remove:true})
  }
  return save(before.order_id,before,null,extra)
 }}
}
