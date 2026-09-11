const test=require('node:test')
const assert=require('node:assert/strict')
const {normalizeBarcode,isGtin,mapWebSearch,lookupBarcodeOnline}=require('../electron/part-catalog.cjs')

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

test('uses UPCitemDB when the original provider is unavailable',async()=>{
  const calls=[]
  const fetchImpl=async url=>{
    calls.push(url)
    if(url.includes('upcitemdb.com'))return{ok:true,status:200,json:async()=>({code:'OK',total:1,items:[{title:'Klocki hamulcowe',brand:'ATE',category:'Auto Parts',model:'13.0460',description:'Komplet',images:['https://example.test/brakes.jpg']}]})}
    return{ok:false,status:503}
  }
  const item=await lookupBarcodeOnline(fetchImpl,'0049000006346')
  assert.equal(item.name,'Klocki hamulcowe')
  assert.equal(item.lookup_source,'UPCitemDB')
  assert.equal(calls.length,1)
})

test('provider outage returns a manual-entry result instead of a technical exception',async()=>{
  const fetchImpl=async()=>({ok:false,status:503})
  const result=await lookupBarcodeOnline(fetchImpl,'0049000006346',{details:true})
  assert.equal(result.item,null)
  assert.equal(result.available,false)
  assert.equal(result.errors.length,5)
})

test('maps an exact automotive web result when barcode catalogs have no match',()=>{
  const html=`<div class="result results_links"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.test%2F28SKV013&amp;rut=x">ESEN SKV 28SKV013 - Parking sensor 5901947342091 | sklep</a><a class="result__snippet">EAN: <b>5901947342091</b>. Czujnik parkowania tył, 12 V.</a></div>`
  const item=mapWebSearch(html,'5901947342091')
  assert.equal(item.name,'ESEN SKV 28SKV013 - Parking sensor | sklep')
  assert.equal(item.brand,'SKV')
  assert.equal(item.part_no,'28SKV013')
  assert.equal(item.lookup_url,'https://example.test/28SKV013')
  assert.equal(item.web_candidate,true)
})

test('ignores web search results without the exact barcode',()=>{
  const html='<a class="result__a" href="https://example.test/item">Podobny czujnik 28SKV013</a><a class="result__snippet">Inny produkt</a>'
  assert.equal(mapWebSearch(html,'5901947342091'),null)
})

test('maps an automotive result from Brave search HTML',()=>{
  const html=`5901947342091 <a href="https://www.auto-doc.test/esen-skv/13449639" class="result l1"><div class="site">AUTODOC</div><div class="title search-snippet-title" title="28SKV013 ESEN SKV Parking sensor Rear | AUTODOC">wynik</div></a>`
  const item=mapWebSearch(html,'5901947342091')
  assert.equal(item.part_no,'28SKV013')
  assert.equal(item.brand,'ESEN SKV')
  assert.equal(item.lookup_url,'https://www.auto-doc.test/esen-skv/13449639')
})
