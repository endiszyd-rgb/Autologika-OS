import {WORK_CATALOG,catalogRows} from '../src/work-catalog.js'
import {procedureFor} from '../src/work-procedures.js'

const rows=catalogRows()
const counts=new Map()
for(const {variant} of rows)counts.set(variant.customer_description,(counts.get(variant.customer_description)||0)+1)
const missingId=rows.filter(({variant})=>!variant.id)
const ids=rows.map(({variant})=>variant.id)
const duplicateIds=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))]
const missingHours=rows.filter(({variant})=>!(Number(variant.hours)>0))
const missingPrice=rows.filter(({variant})=>!(Number(variant.price)>0))
const missingDescription=rows.filter(({variant})=>!String(variant.customer_description||'').trim())
const shortDescription=rows.filter(({variant})=>String(variant.customer_description||'').trim().length<80)
const repeatedDescriptions=[...counts].filter(([,count])=>count>=5)
const missingProcedure=rows.filter(({job,variant})=>{const p=procedureFor(job,variant);return !p?.key||!p.steps?.length||!p.qc?.length})
const report={
 groups:WORK_CATALOG.length,
 works:WORK_CATALOG.reduce((sum,group)=>sum+group.jobs.length,0),
 variants:rows.length,
 variants_without_id:missingId.length,
 duplicate_ids:duplicateIds.length,
 variants_without_hours:missingHours.length,
 variants_without_price:missingPrice.length,
 variants_without_customer_description:missingDescription.length,
 suspiciously_short_descriptions:shortDescription.length,
 descriptions_reused_at_least_5_times:repeatedDescriptions.length,
 variants_without_procedure_or_fallback:missingProcedure.length
}
console.log(JSON.stringify(report,null,2))
for(const [label,list] of Object.entries({missingId,duplicateIds,missingHours,missingPrice,missingDescription,shortDescription,repeatedDescriptions,missingProcedure}))if(list.length)console.log(`\n${label}:`,list.slice(0,20).map(item=>item.variant?.id||item[0]||item).join('\n'))
const failures=missingId.length+duplicateIds.length+missingHours.length+missingPrice.length+missingDescription.length+repeatedDescriptions.length+missingProcedure.length
if(failures)process.exitCode=1
