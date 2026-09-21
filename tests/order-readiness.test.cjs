const test=require('node:test')
const assert=require('node:assert/strict')
const {deriveOrderReadiness}=require('../electron/order-readiness.cjs')

const completeRaw={
 diagnosis_documented:1,
 customer_approved:1,
 parts_documented:1,
 work_logged:1,
 qc_done:1,
 paid_total:1200,
 billed_total:1200,
 release_notes_done:1
}

test('nowe zlecenie nie zalicza automatycznie części ani płatności',()=>{
 const readiness=deriveOrderReadiness({parts_documented:1,paid_total:0,billed_total:0})
 assert.deepEqual(readiness,{
  customer_approved:false,
  diagnosis_documented:false,
  parts_documented:false,
  work_logged:false,
  qc_done:false,
  payment_checked:false,
  release_notes_done:false
 })
})

test('etapy uaktywniają się dopiero po ukończeniu wcześniejszych kroków',()=>{
 const beforeDiagnosis=deriveOrderReadiness({...completeRaw,diagnosis_documented:0})
 assert.equal(beforeDiagnosis.customer_approved,false)
 assert.equal(beforeDiagnosis.parts_documented,false)
 assert.equal(beforeDiagnosis.payment_checked,false)

 const beforeApproval=deriveOrderReadiness({...completeRaw,customer_approved:0})
 assert.equal(beforeApproval.diagnosis_documented,true)
 assert.equal(beforeApproval.parts_documented,false)
 assert.equal(beforeApproval.work_logged,false)
})

test('płatność jest gotowa dopiero po QC i pokryciu pełnej wartości',()=>{
 assert.equal(deriveOrderReadiness({...completeRaw,qc_done:0}).payment_checked,false)
 assert.equal(deriveOrderReadiness({...completeRaw,paid_total:1199}).payment_checked,false)
 assert.equal(deriveOrderReadiness(completeRaw).payment_checked,true)
 assert.equal(deriveOrderReadiness({...completeRaw,billed_total:0,paid_total:0}).payment_checked,true)
})

test('zalecenia wydania kończą sekwencję po rozliczeniu płatności',()=>{
 assert.deepEqual(deriveOrderReadiness(completeRaw),{
  customer_approved:true,
  diagnosis_documented:true,
  parts_documented:true,
  work_logged:true,
  qc_done:true,
  payment_checked:true,
  release_notes_done:true
 })
 assert.equal(deriveOrderReadiness({...completeRaw,paid_total:0}).release_notes_done,false)
})
