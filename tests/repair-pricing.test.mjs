import test from 'node:test'
import assert from 'node:assert/strict'
import {calculateLabor,validatePricing,resolveCatalogVariant} from '../src/repair-pricing.mjs'
import {catalogRows} from '../src/work-catalog.js'

test('labor multiplies configured rate by hours and selected conditions once',()=>{
 const result=calculateLabor({hours:2,hourlyRate:200,corrosionMultiplier:1.25,accessMultiplier:1.2})
 assert.equal(result.total,600);assert.equal(result.effectiveRate,300)
 assert.equal(result.hours,2);assert.equal(result.timeSource,'WORKSHOP_ESTIMATE')
 assert.equal(calculateLabor({hours:1.33,hourlyRate:199.99}).total,265.99)
})
test('manual total replaces calculated price, including an intentional zero',()=>{
 assert.equal(calculateLabor({hours:2,hourlyRate:200,corrosionMultiplier:2,manualPrice:123.45,reason:'Uzgodnienie'}).total,123.45)
 assert.equal(calculateLabor({hours:2,hourlyRate:null,manualPrice:0,reason:'Gwarancja'}).total,0)
 assert.throws(()=>calculateLabor({hours:2,hourlyRate:200,manualPrice:20}),/uzasadnienie/)
})
test('missing settings and nonfinite, negative or empty numbers never silently become zero',()=>{
 for(const hourlyRate of [null,undefined,'',NaN,Infinity,-1])assert.throws(()=>calculateLabor({hours:1,hourlyRate}))
 for(const hours of [0,-1,'',NaN,Infinity])assert.throws(()=>calculateLabor({hours,hourlyRate:200}))
 assert.throws(()=>validatePricing({hourlyRate:200,corrosionMultiplier:.5,accessMultiplier:1}))
})
test('all bundled examples are excluded from production prices; workshop overrides survive',()=>{
 for(const row of catalogRows()){
  assert.equal(row.variant.price,null)
  assert.equal(resolveCatalogVariant(row.group,row.job,{...row.variant,price:999999}).price,null)
 }
 const row=catalogRows()[0],own={[row.variant.id]:{price:0}}
 assert.equal(resolveCatalogVariant(row.group,row.job,row.variant,own).price,0)
 const legacy={[`${row.group}::${row.job.name}::${row.variant.name}`]:350}
 assert.equal(resolveCatalogVariant(row.group,row.job,row.variant,{},legacy).price,350)
})
