const test=require('node:test')
const assert=require('node:assert/strict')
const {normalizeBarcode,isGtin,mapWebSearch,cleanPartName,enrichPartFromHtml,mergePartCandidates,buildPartAlternatives,lookupBarcodeOnline}=require('../electron/part-catalog.cjs')

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
  assert.equal(item.brand,'ESEN SKV')
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

test('fills verified TEKNOROT catalog data instead of a sparse marketplace title',()=>{
  const html=`<a class="result__a" href="https://www.ebay.ca/itm/225894369105">5901532528992 TEKNOROT Rod/Strut, stabiliser for AUDI,SEAT,SKODA,VW - eBay</a><a class="result__snippet">5901532528992 TEKNOROT Rod/Strut, stabiliser for AUDI,SEAT,SKODA,VW</a>`
  const item=mapWebSearch(html,'5901532528992')
  assert.equal(item.name,'Łącznik stabilizatora — oś przednia')
  assert.equal(item.brand,'TEKNOROT')
  assert.equal(item.part_no,'V-557')
  assert.match(item.vehicle_fitment,/Škoda Octavia II/)
  assert.match(item.cross_numbers,/1K0411315B/)
})

test('cleans common catalog titles for readable Polish inventory names',()=>{
  assert.equal(cleanPartName('W 712/95 MANN-FILTER Oil filter for VW Golf | AUTODOC','','W 712/95','MANN-FILTER'),'Filtr oleju')
  assert.equal(cleanPartName('28SKV013 ESEN SKV Parking sensor Rear, Ultrasonic Sensor for BMW','','28SKV013','ESEN SKV'),'Czujnik parkowania — tył')
})

test('ignores web search results without the exact barcode',()=>{
  const html='<a class="result__a" href="https://example.test/item">Podobny czujnik 28SKV013</a><a class="result__snippet">Inny produkt</a>'
  assert.equal(mapWebSearch(html,'5901947342091'),null)
})

test('ignores generic barcode pages even when they contain the exact code',()=>{
  const html=`<a class="result__a" href="https://example.test/ean/5901947342091">EAN lookup 5901947342091 - barcode database</a><a class="result__snippet">Search any product code and compare prices online.</a>`
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

test('selects the JSON-LD product whose GTIN matches the scanned barcode',()=>{
  const html=`<script type="application/ld+json">{"@graph":[
    {"@type":"Product","name":"Inny produkt","gtin13":"4006381333931","sku":"WRONG-1","brand":{"name":"Inna marka"}},
    {"@type":"Product","name":"Wahacz zawieszenia","gtin13":"5901947342091","mpn":"72SKV999","manufacturer":{"name":"ESEN SKV"},"category":"Zawieszenie","additionalProperty":[{"name":"OE numbers","value":"5Q0407151A; 5Q0407151B"},{"name":"Vehicle fitment","value":"Volkswagen Golf VII; Skoda Octavia III"}]}
  ]}</script>`
  const item=enrichPartFromHtml({barcode:'5901947342091',name:'wynik',brand:'',part_no:'',vehicle_fitment:'',cross_numbers:''},html)
  assert.equal(item.name,'Wahacz zawieszenia')
  assert.equal(item.brand,'ESEN SKV')
  assert.equal(item.part_no,'72SKV999')
  assert.equal(item.category,'Zawieszenie')
  assert.match(item.vehicle_fitment,/Volkswagen Golf VII/)
  assert.match(item.vehicle_fitment,/Skoda Octavia III/)
  assert.match(item.cross_numbers,/5Q0407151A/)
})

test('extracts product fields from labelled specification tables',()=>{
  const html=`<title>Łącznik stabilizatora do Volkswagen Golf VII</title><table>
    <tr><th>Producent</th><td>FEBI BILSTEIN</td></tr>
    <tr><th>Numer katalogowy</th><td>178899</td></tr>
    <tr><th>Numery OE</th><td>5Q0 411 315 A; 5Q0 411 315 B</td></tr>
    <tr><th>Pasuje do</th><td>Volkswagen Golf VII; Skoda Octavia III</td></tr>
  </table>`
  const item=enrichPartFromHtml({barcode:'5901947342091',name:'wynik',brand:'',part_no:'',vehicle_fitment:'',cross_numbers:''},html)
  assert.equal(item.brand,'FEBI BILSTEIN')
  assert.equal(item.part_no,'178899')
  assert.match(item.vehicle_fitment,/Volkswagen Golf VII/)
  assert.match(item.cross_numbers,/5Q0 411 315 A/)
})

test('merges complementary catalog results without losing OE and fitment data',()=>{
  const item=mergePartCandidates([
    {barcode:'5901947342091',name:'Wahacz zawieszenia',brand:'ESEN SKV',part_no:'72SKV999',category:'Części samochodowe',vehicle_fitment:'Volkswagen Golf VII',cross_numbers:'5Q0407151A',lookup_source:'Wyszukiwanie WWW',lookup_url:'https://example.test/part',web_candidate:true},
    {barcode:'5901947342091',name:'Control arm',brand:'',part_no:'',category:'Auto Parts',vehicle_fitment:'Skoda Octavia III',cross_numbers:'5Q0407151B',image_url:'https://example.test/image.jpg',lookup_source:'UPCitemDB'}
  ],'5901947342091')
  assert.equal(item.brand,'ESEN SKV')
  assert.equal(item.part_no,'72SKV999')
  assert.match(item.vehicle_fitment,/Volkswagen Golf VII/)
  assert.match(item.vehicle_fitment,/Skoda Octavia III/)
  assert.match(item.cross_numbers,/5Q0407151A/)
  assert.match(item.cross_numbers,/5Q0407151B/)
  assert.equal(item.image_url,'https://example.test/image.jpg')
  assert.equal(item.lookup_confidence,'wysoka')
})

test('does not merge fields from conflicting manufacturers or part numbers',()=>{
  const item=mergePartCandidates([
    {barcode:'5901947342091',name:'Czujnik parkowania',brand:'BOSCH',part_no:'0 263 003 001',category:'Części samochodowe',vehicle_fitment:'BMW Seria 3',cross_numbers:'66209261582',lookup_source:'Katalog A',lookup_url:'https://autodoc.test/a',web_candidate:true,evidence_score:20},
    {barcode:'5901947342091',name:'Filtr oleju',brand:'MANN-FILTER',part_no:'W 712/95',category:'Części samochodowe',vehicle_fitment:'Volkswagen Golf',cross_numbers:'04E115561H',image_url:'https://example.test/wrong.jpg',lookup_source:'Katalog B',web_candidate:true,evidence_score:5}
  ],'5901947342091')
  assert.equal(item.brand,'BOSCH')
  assert.equal(item.part_no,'0 263 003 001')
  assert.doesNotMatch(item.vehicle_fitment,/Volkswagen/)
  assert.doesNotMatch(item.cross_numbers,/04E115561H/)
  assert.equal(item.image_url,'')
})

test('keeps credible conflicting matches as selectable alternatives',()=>{
  const primary={barcode:'5901947342091',name:'Czujnik parkowania',brand:'BOSCH',part_no:'0 263 003 001',category:'Części samochodowe',lookup_source:'Katalog A',lookup_url:'https://autodoc.test/a',web_candidate:true,evidence_score:20}
  const candidates=[primary,
    {barcode:'5901947342091',name:'Czujnik parkowania',brand:'VEMO',part_no:'V20-72-0134',category:'Części samochodowe',vehicle_fitment:'BMW Seria 3',lookup_source:'Katalog B',lookup_url:'https://autoparts.test/b',web_candidate:true,evidence_score:16},
    {barcode:'5901947342091',name:'Barcode lookup result',brand:'',part_no:'',category:'',lookup_source:'Niepewne źródło'}]
  const alternatives=buildPartAlternatives(primary,candidates,'5901947342091')
  assert.equal(alternatives.length,1)
  assert.equal(alternatives[0].brand,'VEMO')
  assert.equal(alternatives[0].part_no,'V20-72-0134')
})
