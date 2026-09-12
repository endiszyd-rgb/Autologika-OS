const test=require('node:test')
const assert=require('node:assert/strict')
const {normalizeBarcode,isGtin,mapWebSearch,cleanPartName,enrichPartFromHtml,lookupBarcodeOnline}=require('../electron/part-catalog.cjs')

test('normalizes Zebra symbology prefixes and validates GTIN checksum',()=>{
  assert.equal(normalizeBarcode(']E04006381333931\r\n'),'4006381333931')
  assert.equal(isGtin('4006381333931'),true)
  assert.equal(isGtin('0049000006347'),false)
  assert.equal(isGtin('ABC123'),false)
})

test('maps an online barcode result into an inventory draft',async()=>{
  const fetchImpl=async()=>({ok:true,status:200,json:async()=>({ok:true,data:{name:'Filtr oleju',brand:'MANN-FILTER',category:'Auto Parts',mpn:'W 712/95',description:'Filtr silnikowy',image_url:'https://example.test/filter.jpg'}})})
  const item=await lookupBarcodeOnline(fetchImpl,'0049000006346')
  assert.equal(item.part_no,'W 712/95')
  assert.equal(item.brand,'MANN-FILTER')
  assert.equal(item.vehicle_fitment,'')
  assert.equal(item.cross_numbers,'')
})

test('returns no match for an unknown valid barcode',async()=>{
  const fetchImpl=async()=>({ok:false,status:404})
  assert.equal(await lookupBarcodeOnline(fetchImpl,'0049000006346'),null)
})

test('keeps UPCitemDB as fallback while checking richer web results',async()=>{
  const calls=[]
  const fetchImpl=async url=>{
    calls.push(url)
    if(url.includes('upcitemdb.com'))return{ok:true,status:200,json:async()=>({code:'OK',total:1,items:[{title:'Klocki hamulcowe',brand:'ATE',category:'Auto Parts',model:'13.0460',description:'Komplet',images:['https://example.test/brakes.jpg']}]})}
    return{ok:false,status:503}
  }
  const item=await lookupBarcodeOnline(fetchImpl,'0049000006346')
  assert.equal(item.name,'Klocki hamulcowe')
  assert.equal(item.lookup_source,'UPCitemDB')
  assert.equal(calls.length,6)
})

test('provider outage returns a manual-entry result instead of a technical exception',async()=>{
  const fetchImpl=async()=>({ok:false,status:503})
  const result=await lookupBarcodeOnline(fetchImpl,'0049000006346',{details:true})
  assert.equal(result.item,null)
  assert.equal(result.available,false)
  assert.equal(result.errors.length,6)
})

test('maps an exact automotive web result when barcode catalogs have no match',()=>{
  const html=`<div class="result results_links"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.test%2F28SKV013&amp;rut=x">ESEN SKV 28SKV013 - Parking sensor 5901947342091 | sklep</a><a class="result__snippet">EAN: <b>5901947342091</b>. Czujnik parkowania tył, 12 V.</a></div>`
  const item=mapWebSearch(html,'5901947342091')
  assert.equal(item.name,'Czujnik parkowania')
  assert.equal(item.brand,'SKV')
  assert.equal(item.part_no,'28SKV013')
  assert.equal(item.lookup_url,'https://example.test/28SKV013')
  assert.equal(item.web_candidate,true)
})

test('maps DuckDuckGo Lite results into clean autofill fields',()=>{
  const html=`<tr><td><a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.autodoc.co.uk%2Fesen-skv%2F13449639&amp;rut=x" class='result-link'>28SKV013 ESEN SKV Parking sensor Rear, Ultrasonic Sensor for BMW 1 Series, 2 Series - Autodoc</a></td></tr>
  <tr><td class='result-snippet'>ESEN SKV 28SKV013 Parking sensor for BMW 1 Series, 2 Series Rear, Ultrasonic Sensor Article number: 28SKV013 EAN: <b>5901947342091</b></td></tr>`
  const item=mapWebSearch(html,'5901947342091')
  assert.equal(item.name,'Czujnik parkowania — tył')
  assert.equal(item.brand,'ESEN SKV')
  assert.equal(item.part_no,'28SKV013')
  assert.equal(item.vehicle_fitment,'BMW 1 Series\nBMW 2 Series')
  assert.equal(item.lookup_url,'https://www.autodoc.co.uk/esen-skv/13449639')
})

test('cleans common catalog titles for readable Polish inventory names',()=>{
  assert.equal(cleanPartName('W 712/95 MANN-FILTER Oil filter for VW Golf | AUTODOC','','W 712/95','MANN-FILTER'),'Filtr oleju')
  assert.equal(cleanPartName('28SKV013 ESEN SKV Parking sensor Rear, Ultrasonic Sensor for BMW','','28SKV013','ESEN SKV'),'Czujnik parkowania — tył')
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

test('extracts manufacturer, catalog number, vehicle fitment and cross references from a product page',()=>{
  const html=`<html><head><title>Czujnik parkowania ESEN SKV do BMW Seria 1, Seria 2</title>
    <script type="application/ld+json">{"@type":"Product","name":"Czujnik parkowania","sku":"28SKV013","brand":{"@type":"Brand","name":"ESEN SKV"},"isAccessoryOrSparePartFor":[{"@type":"Vehicle","name":"BMW Seria 1 E81"}]}</script></head>
    <body><section>Numery OE: 66209261582, 9261582; 66202180149</section></body></html>`
  const item=enrichPartFromHtml({barcode:'5901947342091',name:'wynik',brand:'',part_no:'',vehicle_fitment:'',cross_numbers:''},html)
  assert.equal(item.name,'Czujnik parkowania')
  assert.equal(item.brand,'ESEN SKV')
  assert.equal(item.part_no,'28SKV013')
  assert.match(item.vehicle_fitment,/BMW Seria 1 E81/)
  assert.match(item.cross_numbers,/66209261582/)
  assert.match(item.cross_numbers,/66202180149/)
})

test('enriches a web candidate with detail-page JSON-LD',async()=>{
  const search=`<a class="result__a" href="https://example.test/product">ESEN SKV 28SKV013 sensor 5901947342091 for BMW Series 1, Series 2</a><a class="result__snippet">EAN 5901947342091</a>`
  const page=`<script type="application/ld+json">{"@type":"Product","sku":"28SKV013","brand":{"name":"ESEN SKV"}}</script><p>OEM numbers: 66209261582 66202180149</p>`
  let calls=0
  const fetchImpl=async url=>{calls++;return url.includes('duckduckgo')?{ok:true,status:200,text:async()=>search}:url==='https://example.test/product'?{ok:true,status:200,text:async()=>page}:{ok:false,status:404}}
  const item=await lookupBarcodeOnline(fetchImpl,'5901947342091')
  assert.equal(item.brand,'ESEN SKV')
  assert.match(item.vehicle_fitment,/BMW Series 1/)
  assert.match(item.cross_numbers,/66209261582/)
  assert.ok(calls>=3)
})
