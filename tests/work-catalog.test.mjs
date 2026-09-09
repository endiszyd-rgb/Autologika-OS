import test from 'node:test'
import assert from 'node:assert/strict'
import {WORK_CATALOG,catalogRows} from '../src/work-catalog.js'
import {procedureFor} from '../src/work-procedures.js'

test('every catalog variant has a stable complete definition',()=>{
 const rows=catalogRows(),ids=new Set()
 assert.ok(WORK_CATALOG.length>0)
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

test('descriptions are individually composed per variant',()=>{
 const descriptions=catalogRows().map(row=>row.variant.customer_description)
 assert.equal(new Set(descriptions).size,descriptions.length)
})
