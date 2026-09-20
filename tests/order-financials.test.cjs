const test=require('node:test')
const assert=require('node:assert/strict')
const {normalizeFinalPrice,finalPriceChange}=require('../electron/order-financials.cjs')

test('final price accepts money values and supports restoring automatic calculation',()=>{
 assert.equal(normalizeFinalPrice('1234.567'),1234.57)
 assert.equal(normalizeFinalPrice(''),null)
 assert.deepEqual(finalPriceChange({previous:1200,next:null,note:'Powrót'}),{before:1200,after:null,note:'Powrót'})
})

test('manual final price requires a reason and rejects invalid values',()=>{
 assert.throws(()=>finalPriceChange({next:1000,note:''}),/Podaj powód/)
 assert.throws(()=>normalizeFinalPrice(-1),/Cena końcowa/)
 assert.throws(()=>normalizeFinalPrice('abc'),/Cena końcowa/)
})
