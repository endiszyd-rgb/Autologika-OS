import test from 'node:test'
import assert from 'node:assert/strict'
import {WORK_CATALOG,catalogRows,jobsForGroup,variantFor,searchCatalogRows,searchCustomWorkTemplates} from '../src/work-catalog.js'
import {CATALOG_DIAGNOSTIC_ADDITIONS} from '../src/work-catalog-diagnostics.js'
import {CATALOG_SPECIALIST_ADDITIONS} from '../src/work-catalog-specialist.js'
import {procedureFor} from '../src/work-procedures.js'

test('every catalog variant has a stable complete definition',()=>{
 const rows=catalogRows(),ids=new Set()
 assert.ok(WORK_CATALOG.length>=48)
 assert.ok(WORK_CATALOG.reduce((count,group)=>count+group.jobs.length,0)>=470)
 assert.ok(rows.length>=1590)
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

test('every group includes three additional specialist jobs',()=>{
 assert.ok(WORK_CATALOG.length>=Object.keys(CATALOG_SPECIALIST_ADDITIONS).length)
 for(const group of WORK_CATALOG.filter(group=>CATALOG_SPECIALIST_ADDITIONS[group.group])){
  const additions=CATALOG_SPECIALIST_ADDITIONS[group.group]
  assert.equal(additions?.length,3,`missing specialist additions for ${group.group}`)
  for(const name of additions)assert.ok(group.jobs.some(job=>job.name===name),`missing ${name} in ${group.group}`)
 }
})

test('every work group includes its detailed diagnostic addition',()=>{
 assert.ok(WORK_CATALOG.length>=Object.keys(CATALOG_DIAGNOSTIC_ADDITIONS).length)
 for(const group of WORK_CATALOG.filter(group=>CATALOG_DIAGNOSTIC_ADDITIONS[group.group])){
  const addition=CATALOG_DIAGNOSTIC_ADDITIONS[group.group]
  assert.ok(addition,`missing diagnostic definition for ${group.group}`)
  assert.ok(group.jobs.some(job=>job.name===addition.name),`missing ${addition.name} in ${group.group}`)
 }
 const emissions=WORK_CATALOG.find(group=>group.group==='EGR, DPF/GPF i emisje spalin')
 assert.ok(emissions.jobs.some(job=>job.name==='Diagnostyka czujnika różnicy ciśnień'))
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

test('expanded catalog keeps semantic names unique inside their hierarchy',()=>{
 const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&|\+|\//g,' i ').replace(/\bi\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim()
 assert.equal(new Set(WORK_CATALOG.map(group=>key(group.group))).size,WORK_CATALOG.length)
 for(const group of WORK_CATALOG){
  assert.equal(new Set(group.jobs.map(job=>key(job.name))).size,group.jobs.length,`duplicate work in ${group.group}`)
  for(const job of group.jobs)assert.equal(new Set(job.variants.map(variant=>key(variant.name))).size,job.variants.length,`duplicate variant in ${group.group} / ${job.name}`)
 }
})

test('V3 operation completes the selection to procedure flow',()=>{
 const group='Naprawy specyficzne VAG',job=jobsForGroup(group).find(item=>item.name==='Wymiana odmy silnika EA888'),variant=job?.variants[0]
 assert.ok(job)
 assert.ok(variant)
 assert.equal(variantFor(job.id,variant.id)?.id,variant.id)
 assert.ok(variant.hours>0)
 assert.ok(variant.price>0)
 assert.ok(variant.customer_description.length>=80)
 const procedure=procedureFor(job,variant)
 assert.equal(procedure.catalog_work_id,job.id)
 assert.equal(procedure.catalog_variant_id,variant.id)
 assert.ok(procedure.steps.length)
 assert.ok(procedure.qc.length)
 assert.ok(catalogRows().some(row=>`${row.group} ${row.job.name} ${row.variant.name}`.toLowerCase().includes('ea888')))
})

test('catalog search finds work and variants without Polish diacritics',()=>{
 const pressure=searchCatalogRows('diagnostyka czujnika roznicy cisnien',20)
 assert.ok(pressure.length)
 assert.match(pressure[0].job.name,/Diagnostyka czujnika różnicy ciśnień/i)
 const ea888=searchCatalogRows('ea888 odma',10)
 assert.ok(ea888.some(row=>row.job.name==='Wymiana odmy silnika EA888'))
 assert.deepEqual(searchCatalogRows(''),[])
 assert.ok(searchCatalogRows('wymiana',7).length<=7)
})

test('catalog reuses its flattened search source between keystrokes',()=>{
 assert.strictEqual(catalogRows(),catalogRows())
 assert.ok(searchCatalogRows('hamulce',32).length<=32)
 assert.ok(searchCatalogRows('hamulce tarcze',32).every(row=>row.group&&row.job?.id&&row.variant?.id))
})

test('shared work search finds user templates across all fields',()=>{
 const templates=[
  {id:1,group_name:'Hamulce',name:'Wymiana klocków',variant:'Przód',scope:'Kontrola tarcz i prowadnic'},
  {id:2,group_name:'Silnik',name:'Serwis olejowy',variant:'Standard',scope:'Wymiana oleju i filtra'}
 ]
 assert.equal(searchCustomWorkTemplates(templates,'klockow przod')[0]?.template.id,1)
 assert.equal(searchCustomWorkTemplates(templates,'silnik oleju')[0]?.template.id,2)
 assert.deepEqual(searchCustomWorkTemplates(templates,''),[])
})
