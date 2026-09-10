const test=require('node:test')
const assert=require('node:assert/strict')
const {normalizeBarcode,isGtin,lookupBarcodeOnline}=require('../electron/part-catalog.cjs')

test('normalizes Zebra symbology prefixes and validates GTIN checksum',()=>{
  assert.equal(normalizeBarcode(']E04006381333931\r\n'),'4006381333931')
  assert.equal(isGtin('4006381333931'),true)
  assert.equal(isGtin('0049000006347'),false)
  assert.equal(isGtin('ABC123'),false)
})

test('maps an online barcode result into an inventory draft',async()=>{
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>({ok:true,data:{name:'Filtr oleju',brand:'MANN-FILTER',category:'Auto Parts',mpn:'W 712/95',description:'Filtr silnikowy',image_url:'https://example.test/filter.jpg'}})})
  const item=await lookupBarcodeOnline(fetchImpl,'0049000006346')
  assert.deepEqual(item,{barcode:'0049000006346',name:'Filtr oleju',brand:'MANN-FILTER',category:'Auto Parts',part_no:'W 712/95',description:'Filtr silnikowy',image_url:'https://example.test/filter.jpg',lookup_source:'upc.dev',lookup_url:'https://upc.dev/v1/product/0049000006346'})
})

test('returns no match for an unknown valid barcode',async()=>{
  const fetchImpl=async()=>({ok:false,status:404})
  assert.equal(await lookupBarcodeOnline(fetchImpl,'0049000006346'),null)
})
