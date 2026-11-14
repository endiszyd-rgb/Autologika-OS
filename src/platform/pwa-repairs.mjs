const money=value=>Math.round((Number(value)||0)*100)/100
const same=(a,b)=>String(a??'')===String(b??'')
const parse=(value,fallback)=>{try{return typeof value==='string'?JSON.parse(value):value??fallback}catch{return fallback}}
const numeric=(value,fallback=0,max=Number.MAX_SAFE_INTEGER)=>{const n=Number(value??fallback);if(!Number.isFinite(n)||n<0||n>max)throw new Error('Nieprawidłowa wartość kosztorysu naprawy.');return n}
const fields=['pre','steps','qc','recommendations','safety','parts','materials','technical','progress']
export const hydrateProcedure=row=>{const next={...row};for(const field of fields)next[field]=parse(row[`${field}_json`]??row[field],field==='progress'?{}:[]);return next}

export function repairEstimate(operation,parts=[]){
 const laborNet=money(operation.planned_hours*operation.labor_rate),laborCost=money(operation.planned_hours*operation.labor_cost_rate)
 const partsCost=money(parts.reduce((sum,row)=>sum+Number(row.qty)*Number(row.unit_cost),0)),partsSale=money(parts.reduce((sum,row)=>sum+Number(row.qty)*Number(row.unit_price),0))
 const discountPercent=numeric(operation.discount_percent,0,100),vatRate=numeric(operation.vat_rate,0,100)
 const beforeDiscount=money(laborNet+partsSale+Number(operation.other_price||0)),discount=money(beforeDiscount*discountPercent/100),net=money(beforeDiscount-discount),vat=money(net*vatRate/100),gross=money(net+vat)
 const cost=money(laborCost+partsCost+Number(operation.other_cost||0)),margin=money(net-cost)
 return {repairOperationId:operation.id,laborNet,laborCost,partsCost,partsSale,otherCost:money(operation.other_cost),otherPrice:money(operation.other_price),discount,discountPercent,net,vat,vatRate,gross,cost,margin,marginPercent:net?money(margin/net*100):0,markupPercent:cost?money(margin/cost*100):0}
}

export function createPwaRepairs(cloud){
 const forOrder=async(entity,id)=>(await cloud.list(entity)).filter(row=>same(row.order_id,id))
 const editable=async id=>{const order=await cloud.get('orders',id);if(!order)throw new Error('Zlecenie nie istnieje.');if(order.status==='WYDANE'||order.archived_at)throw new Error('Zamknięte zlecenie jest tylko do odczytu.');return order}
 const createBundle=async(orderId,data)=>{
  await editable(orderId)
  data.idempotency_key||=crypto.randomUUID()
  const orderCloud=cloud.resolveCloudId('orders',orderId),root=`pwa-job:${orderCloud}:${data.idempotency_key}`
  const operationId=`${root}:repair`,laborId=`${root}:labor`,procedureId=`${root}:procedure`
  const existing=await cloud.get('order_repair_operations',operationId)
  if(existing)return {operationId:existing.id,existing:true}
  const hours=numeric(data.hours),rate=numeric(data.rate),costRate=numeric(data.labor_cost_rate),title=String(data.title||data.name||'').trim()
  if(!title||hours<=0)throw new Error('Wpisz nazwę naprawy i dodatni czas pracy.')
  const created_at=new Date().toISOString(),order_cloud_id=orderCloud,repair_operation_cloud_id=operationId
  const operation={order_cloud_id,idempotency_key:data.idempotency_key,catalog_work_id:data.catalog_work_id||null,catalog_variant_id:data.catalog_variant_id||null,title,variant:data.variant||'',customer_description:data.scope||'',technical_description:data.technicalDescription||'',planned_hours:hours,labor_rate:rate,labor_cost_rate:costRate,discount_percent:numeric(data.discount_percent,0,100),vat_rate:numeric(data.vat_rate,23,100),other_cost:0,other_price:0,order_item_cloud_id:laborId,procedure_run_cloud_id:procedureId,created_at}
  const labor={order_cloud_id,repair_operation_cloud_id,kind:'ROBOCIZNA',name:data.name||title,work_name:title,variant_name:data.variant||'',qty:hours,unit_cost:costRate,unit_price:rate,labor_hours:hours,labor_rate:rate,notes:data.scope||'',customer_description:data.scope||'',technical_description:data.technicalDescription||'',catalog_work_id:data.catalog_work_id||null,catalog_variant_id:data.catalog_variant_id||null,hours_snapshot:hours,price_snapshot:money(hours*rate),created_at}
  const selectedParts=(data.parts||[]).filter(part=>part.selected!==false),progress={}
  for(const section of ['pre','steps','qc'])for(let i=0;i<(data[section]||[]).length;i++)progress[`${section}:${i}`]=false
  const procedure={order_cloud_id,repair_operation_cloud_id,order_item_cloud_id:laborId,template_key:data.template_key||'',title,variant:data.variant||'',catalog_work_id:data.catalog_work_id||null,catalog_variant_id:data.catalog_variant_id||null,technical_description:data.technicalDescription||'',technical_data_key:data.technicalDataKey||null,created_at}
  for(const field of fields)procedure[`${field}_json`]=JSON.stringify(field==='progress'?progress:field==='parts'?selectedParts:data[field]||[])
  const entries=[{entity:'order_items',cloudId:laborId,payload:labor},{entity:'work_procedure_runs',cloudId:procedureId,payload:procedure},{entity:'order_repair_operations',cloudId:operationId,payload:operation}]
  selectedParts.forEach((part,index)=>{
   const qty=numeric(part.qty??1);if(!Number.isInteger(qty)||qty<=0)throw new Error('Ilość części musi być dodatnią liczbą sztuk.')
   const jobId=`${root}:part-order:${index}`,common={order_cloud_id,repair_operation_cloud_id,name:part.name,part_no:part.part_no||'',qty,unit_cost:numeric(part.unit_cost),unit_price:numeric(part.unit_price),notes:part.note||'',created_at}
   entries.push({entity:'job_part_orders',cloudId:jobId,payload:{...common,status:'DO_ZAMOWIENIA'}},{entity:'repair_parts',cloudId:`${root}:part:${index}`,payload:{...common,job_part_order_cloud_id:jobId,source:'SUGGESTED',status:'SUGGESTED',reserved_qty:0,issued_qty:0,returned_qty:0,installed_qty:0}})
  })
  ;(data.qc||[]).forEach((label,index)=>entries.push({entity:'order_qc',cloudId:`${root}:qc:${index}`,payload:{order_cloud_id,repair_operation_cloud_id,check_key:`repair:${operationId}:qc:${index}`,label:String(label),checked:0,note:'',created_at}}))
  entries.push({entity:'order_events',cloudId:`${root}:event`,payload:{order_cloud_id,event_type:'SMART_JOB_CREATED',title:'Dodano naprawę z katalogu',details:`${title} · ${hours} h · ${money(hours*rate)} zł netto`,created_at}})
  const saved=await cloud.upsertMany(entries)
  return {operationId:saved[2].id,procedureId:saved[1].id,orderItemId:saved[0].id,existing:false}
 }
 const list=async orderId=>{
  const [operations,parts,qc]=await Promise.all([forOrder('order_repair_operations',orderId),forOrder('repair_parts',orderId),forOrder('order_qc',orderId)])
  return operations.map(operation=>{const linked=parts.filter(part=>same(part.repair_operation_id,operation.id)),checks=qc.filter(row=>same(row.repair_operation_id,operation.id));return {...operation,parts:linked,part_count:linked.length,qc_total:checks.length,qc_done:checks.filter(row=>row.checked).length,estimate:repairEstimate(operation,linked)}})
 }
 const estimate=async orderId=>{
  const operations=(await list(orderId)).map(operation=>operation.estimate),totals={}
  for(const operation of operations)for(const key of ['laborNet','laborCost','partsCost','partsSale','otherCost','otherPrice','discount','net','vat','gross','cost','margin'])totals[key]=money((totals[key]||0)+operation[key])
  totals.marginPercent=totals.net?money(totals.margin/totals.net*100):0;totals.markupPercent=totals.cost?money(totals.margin/totals.cost*100):0
  return {orderId,operations,totals}
 }
 const update=async(id,data)=>{
  const operation=await cloud.get('order_repair_operations',id);if(!operation)throw new Error('Naprawa nie istnieje.')
  await editable(operation.order_id)
  const next={...operation}
  for(const field of ['title','variant','customer_description','technical_description'])if(data[field]!==undefined)next[field]=String(data[field]||'').trim()
  if(!next.title)throw new Error('Nazwa naprawy jest wymagana.')
  for(const field of ['planned_hours','labor_rate','labor_cost_rate','other_cost','other_price','discount_percent','vat_rate'])next[field]=numeric(data[field],operation[field]||0,['discount_percent','vat_rate'].includes(field)?100:undefined)
  const payload={...next};for(const field of ['id','order_id','order_item_id','procedure_run_id','estimate','parts'])delete payload[field]
  const entries=[{entity:'order_repair_operations',cloudId:operation.cloud_id,payload}]
  if(operation.order_item_cloud_id)entries.push({entity:'order_items',cloudId:operation.order_item_cloud_id,payload:{name:next.title,work_name:next.title,variant_name:next.variant,customer_description:next.customer_description,technical_description:next.technical_description,notes:next.customer_description,qty:next.planned_hours,unit_cost:next.labor_cost_rate,unit_price:next.labor_rate,labor_hours:next.planned_hours,labor_rate:next.labor_rate,hours_snapshot:next.planned_hours,price_snapshot:money(next.planned_hours*next.labor_rate)}})
  if(operation.procedure_run_cloud_id)entries.push({entity:'work_procedure_runs',cloudId:operation.procedure_run_cloud_id,payload:{title:next.title,variant:next.variant,technical_description:next.technical_description}})
  entries.push({entity:'order_events',cloudId:crypto.randomUUID(),payload:{order_cloud_id:cloud.resolveCloudId('orders',operation.order_id),event_type:'REPAIR_UPDATED',title:'Zmieniono wycene naprawy',details:JSON.stringify({version:1,before:operation,after:next}),created_at:new Date().toISOString()}})
  await cloud.upsertMany(entries)
  return {operationId:id,estimate:repairEstimate(next,(await forOrder('repair_parts',operation.order_id)).filter(part=>same(part.repair_operation_id,id)))}
 }
 return {createBundle,list,estimate,update}
}
