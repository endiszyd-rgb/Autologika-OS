import test from 'node:test'
import assert from 'node:assert/strict'
import {WORK_CATALOG,catalogRows} from '../src/work-catalog.js'
import {procedureFor} from '../src/work-procedures.js'

test('every catalog variant has a stable complete definition',()=>{
 const rows=catalogRows(),ids=new Set()
 assert.ok(WORK_CATALOG.length>=48)
 assert.ok(WORK_CATALOG.reduce((count,group)=>count+group.jobs.length,0)>=291)
 assert.ok(rows.length>=871)
 for(const {job,variant} of rows){
  assert.match(job.id,/^work_/)
  assert.match(variant.id,/^variant_/)
  assert.ok(!ids.has(variant.id),`duplicate ${variant.id}`);ids.add(variant.id)
  assert.ok(variant.hours>0,variant.id)
  assert.ok(variant.price>0,variant.id)
  assert.ok(variant.customer_description.length>=80,variant.id)
  const procedure=procedureFor(job,variant)
  assert.equal(procedure.catalog_variant_id,variant.id)
  assert.ok(procedure.steps.length)
  assert.ok(procedure.qc.length)
  assert.ok(procedure.tools.length)
 }
})

test('expanded workshop domains provide tailored procedures',()=>{
 const expectations=[
  ['Koła, opony i TPMS','Sezonowa wymiana kompletu kół','Ciężarki wyważające'],
  ['Klimatyzacja i komfort termiczny','Serwis klimatyzacji R134a','Czynnik chłodniczy'],
  ['Instalacje LPG i CNG','Przegląd okresowy instalacji LPG','Filtry / uszczelnienia instalacji gazowej'],
  ['Pojazdy hybrydowe i elektryczne – serwis HV','Procedura bezpiecznego odłączenia układu HV','blokad bezpieczeństwa']
 ]
 for(const[groupName,jobName,expected]of expectations){
  const group=WORK_CATALOG.find(item=>item.group===groupName),job=group?.jobs.find(item=>item.name===jobName)
  assert.ok(job,`${groupName} / ${jobName}`)
  const procedure=procedureFor(job,job.variants[0]),content=JSON.stringify(procedure)
  assert.match(content,new RegExp(expected,'i'))
  assert.ok(procedure.pre.length>=3)
  assert.ok(procedure.qc.length>=3)
 }
})

test('descriptions are individually composed per variant',()=>{
 const descriptions=catalogRows().map(row=>row.variant.customer_description)
 assert.equal(new Set(descriptions).size,descriptions.length)
})
