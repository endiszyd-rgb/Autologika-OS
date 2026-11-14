const test=require('node:test')
const assert=require('node:assert/strict')
const {editDeliveryItem,validateDelivery,confirmDelivery}=require('../shared/delivery-review.cjs')
const row={part_no:'AB-123',name:'Filtr',qty:2,unit_cost:10,vat_rate:23,gross_total:24.6}
test('editing quantity, net, gross and zero VAT keeps the proposal consistent',()=>{
 const quantity=editDeliveryItem(row,'qty','3')
 assert.equal(quantity.gross_total,36.9)
 assert.equal(editDeliveryItem(row,'unit_cost','12,50').gross_total,30.75)
 const gross=editDeliveryItem(row,'gross_total','49,20')
 assert.equal(gross.unit_cost,20)
 assert.equal(validateDelivery({items:[gross]}).items[0].net_total,40)
 const zero=editDeliveryItem(row,'vat_rate','0')
 assert.equal(zero.gross_total,20)
 assert.equal(validateDelivery({items:[zero]}).items[0].vat_rate,0)
 assert.equal(row.gross_total,24.6)
})
test('invalid OCR values cannot become a valid proposal by coercion',()=>{
 for(const patch of [{unit_cost:''},{unit_cost:null},{unit_cost:Infinity},{qty:'1.5'},{qty:0},{part_no:'---'},{vat_rate:''},{vat_rate:-1},{vat_rate:101},{gross_total:-1},{gross_total:'bad'},{gross_total:100}]){
  assert.throws(()=>validateDelivery({items:[{...row,...patch}]}),JSON.stringify(patch))
 }
 assert.equal(validateDelivery({items:[{...row,enabled:false,qty:0},row]}).items.length,1)
})
test('confirmation is required and repeated OCR rows are explicit rather than silently dropped',()=>{
 const document={gross_total:100,items:[row,{...row,part_no:'AB123'}]}
 let prompt=''
 assert.equal(confirmDelivery(document,text=>{prompt=text;return false}),null)
 assert.match(prompt,/Powtórzone numery części/)
 assert.match(prompt,/różni się/)
 assert.match(prompt,/4 szt/)
 assert.equal(confirmDelivery(document,()=>true).items.length,2)
 let called=false
 assert.throws(()=>confirmDelivery({items:[{...row,qty:0}]},()=>{called=true;return true}))
 assert.equal(called,false)
})
