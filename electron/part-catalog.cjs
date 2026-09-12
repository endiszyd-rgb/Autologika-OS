function normalizeBarcode(value=''){
  return String(value||'').trim().replace(/^\][A-Za-z][0-9]/,'').replace(/[\r\n\t ]+/g,'')
}

function isGtin(value=''){
  const code=normalizeBarcode(value)
  if(!/^\d{8}$|^\d{12,14}$/.test(code))return false
  const digits=[...code].map(Number),check=digits.pop()
  let sum=0,weight=3
  for(let i=digits.length-1;i>=0;i--){sum+=digits[i]*weight;weight=weight===3?1:3}
  return (10-(sum%10))%10===check
}

function mapUpcDev(data,scannedCode){
  const item=data?.data
  if(!data?.ok||!item?.name)return null
  return {
    barcode:normalizeBarcode(scannedCode),
    name:String(item.name||'').trim(),
    brand:String(item.brand||'').trim(),
    category:String(item.category||'').trim(),
    part_no:String(item.mpn||item.model||'').trim(),
    description:String(item.description||'').trim(),
    image_url:String(item.image_url||'').trim(),
    lookup_source:'upc.dev',
    lookup_url:`https://upc.dev/v1/product/${encodeURIComponent(normalizeBarcode(scannedCode))}`
  }
}

function mapUpcItemDb(data,scannedCode){
  const item=Array.isArray(data?.items)?data.items[0]:null
  if(data?.code!=='OK'||!item?.title)return null
  return {
    barcode:normalizeBarcode(scannedCode),
    name:String(item.title||'').trim(),
    brand:String(item.brand||'').trim(),
    category:String(item.category||'').trim(),
    part_no:String(item.model||item.mpn||'').trim(),
    description:String(item.description||'').trim(),
    image_url:String(item.images?.[0]||'').trim(),
    lookup_source:'UPCitemDB',
    lookup_url:`https://www.upcitemdb.com/upc/${encodeURIComponent(normalizeBarcode(scannedCode))}`
  }
}

function mapOpenProductsFacts(data,scannedCode){
  const item=data?.product
  if(data?.status!=='success'||!item?.product_name)return null
  return {
    barcode:normalizeBarcode(scannedCode),
    name:String(item.product_name||'').trim(),
    brand:String(item.brands||'').trim(),
    category:String(item.categories||'').trim(),
    part_no:'',
    description:String(item.generic_name||'').trim(),
    image_url:String(item.image_front_url||'').trim(),
    lookup_source:'Open Products Facts',
    lookup_url:`https://world.openproductsfacts.org/product/${encodeURIComponent(normalizeBarcode(scannedCode))}`
  }
}

function decodeHtml(value=''){
  return String(value||'')
    .replace(/<[^>]*>/g,' ')
    .replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16)))
    .replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(parseInt(code,10)))
    .replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&#x27;/gi,"'")
    .replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim()
}

function unwrapSearchUrl(value=''){
  try{
    const decoded=decodeHtml(value),url=new URL(decoded.startsWith('//')?`https:${decoded}`:decoded)
    const target=url.hostname.endsWith('duckduckgo.com')?url.searchParams.get('uddg'):url.href
    const parsed=new URL(target)
    return /^https?:$/.test(parsed.protocol)?parsed.href:''
  }catch{return''}
}

function webPartNumber(title,barcode){
  const tokens=String(title||'').replace(barcode,' ').match(/[A-Z0-9][A-Z0-9._/-]{3,23}/gi)||[]
  return tokens.find(token=>/[A-Z]/i.test(token)&&/\d/.test(token)&&normalizeBarcode(token)!==barcode)||''
}

function webBrand(title,partNo){
  if(!partNo)return''
  const partIndex=String(title).toUpperCase().indexOf(partNo.toUpperCase())
  const before=String(title||'').slice(0,partIndex)
  const stop=new Set(['FOR','FITS','FIT','NEW','GENUINE','ORIGINAL','GERMANY','UK','THE','WITH'])
  const words=(before.match(/[A-Z][A-Z0-9-]{1,15}/g)||[]).filter(word=>!stop.has(word)&&!/\d/.test(word))
  if(words.length)return words.at(-1)
  const after=String(title||'').slice(partIndex+partNo.length)
  return (after.match(/^\s*([A-Z][A-Z0-9-]{1,15}(?:\s+[A-Z][A-Z0-9-]{1,15})?)/)?.[1]||'').trim()
}

function cleanPartName(title='',barcode='',partNo='',brand=''){
  let value=decodeHtml(title)
  if(barcode)value=value.replaceAll(String(barcode),' ')
  value=value.replace(/\s*[|–—-]\s*(?:AUTODOC|eBay|Amazon|Allegro|Motora|sklep).*$/i,' ').replace(/\s*\.{3}\s*/g,' ')
  const partIndex=partNo?value.toUpperCase().indexOf(String(partNo).toUpperCase()):-1
  if(partIndex>=0&&partIndex<50)value=value.slice(partIndex+String(partNo).length)
  for(const prefix of [partNo,brand]){
    if(!prefix)continue
    const escaped=String(prefix).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
    value=value.replace(new RegExp('^\\s*'+escaped+'\\s*[-–—|:]?\\s*','i'),'')
  }
  value=value.replace(/^\s*[-–—|:]\s*/,'').replace(/\s+(?:for|fits?|pour|für|do)\s+.*$/i,'').split(',')[0].replace(/\s+/g,' ').trim()
  const replacements=[
    [/\bparking sensor\b/i,'Czujnik parkowania'],[/\bultrasonic sensor\b/i,'Czujnik ultradźwiękowy'],
    [/\boil filter\b/i,'Filtr oleju'],[/\bair filter\b/i,'Filtr powietrza'],[/\bcabin filter\b/i,'Filtr kabinowy'],
    [/\bfuel filter\b/i,'Filtr paliwa'],[/\bbrake pads?\b/i,'Klocki hamulcowe'],[/\bbrake disc\b/i,'Tarcza hamulcowa'],
    [/\bwheel bearing\b/i,'Łożysko koła'],[/\bshock absorber\b/i,'Amortyzator'],[/\bcontrol arm\b/i,'Wahacz']
  ]
  for(const [pattern,replacement] of replacements)value=value.replace(pattern,replacement)
  value=value.replace(/\s+rear\b/i,' — tył').replace(/\s+front\b/i,' — przód').replace(/\s+left\b/i,' — lewa').replace(/\s+right\b/i,' — prawa')
  return value.trim()
}

const LOOKUP_VERSION='catalog-web-v3'
const VEHICLE_MAKES=['ALFA ROMEO','ASTON MARTIN','LAND ROVER','MERCEDES-BENZ','MERCEDES','VOLKSWAGEN','VAUXHALL','CHEVROLET','CHRYSLER','CITROEN','DACIA','DAEWOO','DAIHATSU','DODGE','FERRARI','FIAT','FORD','HONDA','HYUNDAI','INFINITI','ISUZU','IVECO','JAGUAR','JEEP','KIA','LANCIA','LEXUS','MAN','MAZDA','MINI','MITSUBISHI','NISSAN','OPEL','PEUGEOT','PORSCHE','RENAULT','ROVER','SAAB','SEAT','SKODA','SMART','SSANGYONG','SUBARU','SUZUKI','TESLA','TOYOTA','VOLVO','AUDI','BMW']

function uniqueLines(values=[]){
  const seen=new Set(),out=[]
  for(const value of values.flatMap(value=>String(value||'').split(/[\n;]+/))){
    const clean=decodeHtml(value).replace(/^[\s,|:–—-]+|[\s,|:–—-]+$/g,'').replace(/\s+/g,' ').trim()
    const key=clean.toLocaleUpperCase('pl-PL')
    if(clean.length>=2&&clean.length<=180&&!seen.has(key)){seen.add(key);out.push(clean)}
  }
  return out
}

function extractFitment(value=''){
  const clean=decodeHtml(value).replace(/\s*[|–—]\s*(?:AUTODOC|eBay|Amazon|Allegro|sklep|prix|price).*$/i,'').trim()
  const match=clean.match(/(?:\bpasuje\s+do\b|\bdo\b|\bfits?\b|\bfor\b|\bpour\b|\bfür\b|\bpro\b)\s+(.{3,260})$/i)
  if(!match)return''
  const raw=match[1].replace(/\([^)]*(?:price|prix|cena)[^)]*\)/gi,'').trim()
  const chunks=raw.split(/[,;]+/).map(x=>x.trim()).filter(Boolean).slice(0,18)
  const firstUpper=(chunks[0]||'').toUpperCase()
  const make=VEHICLE_MAKES.find(name=>firstUpper.startsWith(name+' ')||firstUpper===name)||''
  if(!make)return''
  const models=[]
  for(let chunk of chunks){
    const embeddedBarcode=barcodeFromText(chunk)
    if(embeddedBarcode)chunk=chunk.replace(new RegExp(`\\b${embeddedBarcode}\\b.*$`),'')
    chunk=chunk.replace(/\s*[|–—-]\s*(?:AUTODOC|eBay|Amazon|Allegro|Motora|sklep).*$/i,'').replace(/\s+(?:rear|front|tył|przód)\s*$/i,'').replace(/\s+za\s+\d[\d.,]*\s*(?:PLN|EUR|CZK).*$/i,'').trim()
    if(!chunk||/(?:\bEAN\b|article number|numer artykułu|submit a review|ultrasonic sensor|parking sensor|napięcie|voltage|weight|producent|manufacturer|brand:)/i.test(chunk))continue
    if(!VEHICLE_MAKES.some(name=>chunk.toUpperCase().startsWith(name+' ')||chunk.toUpperCase()===name))chunk=`${make} ${chunk}`
    if(chunk.toUpperCase()!==make&&chunk.length<=100)models.push(chunk)
  }
  return uniqueLines(models).join('\n')
}

function barcodeFromText(value=''){return String(value).match(/\b\d{8,14}\b/)?.[0]||''}

function extractReferenceNumbers(value='',barcode='',partNo=''){
  const text=decodeHtml(value),segments=[]
  const label=/(?:num(?:er|ery)?\s+(?:oe|oem|referencyjne|zamiennik(?:ów|i)?)|cross(?:\s*reference)?|reference(?:\s*(?:number|numbers|no))?|référence(?:s)?\s*(?:oe|constructeur)?|vergleichsnummer|oe\s*(?:nr|no|number|numbers)?|oem\s*(?:nr|no|number|numbers)?)[\s:#-]*([^\n<>]{3,500})/gi
  for(const match of text.matchAll(label))segments.push(match[1])
  const excluded=new Set([normalizeBarcode(barcode),String(partNo||'').replace(/[^A-Z0-9]/gi,'').toUpperCase()])
  const refs=[]
  for(const segment of segments){
    const numeric=segment.match(/\b\d{5,14}\b/g)||[]
    const alphanumeric=segment.match(/\b(?=[A-Z0-9._/-]{5,24}\b)(?=[A-Z0-9._/-]*\d)(?=[A-Z0-9._/-]*[A-Z])[A-Z0-9][A-Z0-9._/-]{4,23}\b/gi)||[]
    const tokens=[...numeric,...alphanumeric]
    for(let token of tokens){
      token=token.replace(/\s+/g,' ').replace(/^[._/-]+|[._/-]+$/g,'').trim()
      const compact=token.replace(/[^A-Z0-9]/gi,'').toUpperCase()
      if(!/\d/.test(token)||compact.length<5||excluded.has(compact)||/^(?:HTTP|WWW|EAN|GTIN|UPC)/i.test(token))continue
      refs.push(token)
    }
  }
  return uniqueLines(refs).slice(0,40).join('\n')
}

function jsonLdProducts(html=''){
  const products=[]
  const visit=value=>{
    if(!value||typeof value!=='object')return
    if(Array.isArray(value)){value.forEach(visit);return}
    const type=Array.isArray(value['@type'])?value['@type'].join(' '):String(value['@type']||'')
    if(/product/i.test(type))products.push(value)
    Object.values(value).forEach(visit)
  }
  for(const match of String(html).matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    try{visit(JSON.parse(match[1].trim()))}catch{}
  }
  return products
}

function enrichPartFromHtml(item,html=''){
  if(!item)return item
  const products=jsonLdProducts(html),product=products[0]||{},brandValue=typeof product.brand==='object'?product.brand?.name:product.brand
  const fitment=[]
  const collectFit=value=>{
    if(Array.isArray(value))return value.forEach(collectFit)
    if(value&&typeof value==='object')fitment.push(value.name||value.model||'')
    else fitment.push(value||'')
  }
  collectFit(product.isAccessoryOrSparePartFor)
  const text=decodeHtml(String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<\/(?:div|p|li|tr|section|h\d)>/gi,'\n'))
  const title=decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||product.name||item.name)
  const pagePartNo=String(product.sku||product.mpn||product.productID||'').trim()
  const references=extractReferenceNumbers(text,item.barcode,pagePartNo||item.part_no)
  const vehicleFitment=uniqueLines([...fitment,extractFitment(title),extractFitment(item.name)]).join('\n')
  return {...item,
    name:String(product.name||item.name||'').trim(),
    brand:String(brandValue||item.brand||'').trim(),
    part_no:pagePartNo||item.part_no||'',
    vehicle_fitment:vehicleFitment||item.vehicle_fitment||'',
    cross_numbers:references||item.cross_numbers||'',
    description:'',lookup_version:LOOKUP_VERSION
  }
}

async function enrichWebCandidate(fetchImpl,item){
  const base=enrichPartFromHtml(item,'')
  if(!item?.lookup_url)return base
  try{
    const response=await fetchImpl(item.lookup_url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'},signal:AbortSignal.timeout(6000)})
    if(response.ok)return enrichPartFromHtml(base,await response.text())
  }catch{}
  return base
}

function mapWebSearch(html,scannedCode){
  const barcode=normalizeBarcode(scannedCode),results=[]
  const pattern=/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class="result__a"|$)/gi
  for(const match of String(html||'').matchAll(pattern)){
    const url=unwrapSearchUrl(match[1]),rawTitle=decodeHtml(match[2]),tail=match[3]
    const snippetMatch=tail.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
    const snippet=decodeHtml(snippetMatch?.[1]||''),evidence=`${rawTitle} ${snippet}`
    if(!url||!evidence.includes(barcode))continue
    let score=rawTitle.includes(barcode)?8:4
    if(/autodoc|motora|autoparts|auto-?teile|ucando|częś|czujnik|sensor|filter|brake|pompa|pump|bearing|łożysk/i.test(`${url} ${evidence}`))score+=3
    if(/autodoc|motora|ucando|czesciauto24|europarts|autodily/i.test(url))score+=6
    if(/ebay|amazon|allegro/i.test(url))score-=3
    if(/google\.|duckduckgo\.|facebook\.|youtube\./i.test(url))score-=10
    results.push({url,rawTitle,snippet,score})
  }
  const bravePattern=/<a[^>]*href="(https?:\/\/[^"#]+)"[^>]*class="[^"]*\bl1\b[^"]*"[^>]*>[\s\S]{0,6000}?<div[^>]*class="[^"]*\btitle\b[^"]*"[^>]*title="([^"]+)"/gi
  if(String(html||'').includes(barcode))for(const match of String(html||'').matchAll(bravePattern)){
    const url=decodeHtml(match[1]),rawTitle=decodeHtml(match[2]),evidence=`${rawTitle} ${url}`
    let score=3
    if(/autodoc|motora|autoparts|auto-?teile|ucando|częś|czujnik|sensor|filter|brake|pompa|pump|bearing|łożysk/i.test(evidence))score+=5
    if(/autodoc|motora|ucando|czesciauto24|europarts|autodily/i.test(url))score+=6
    if(/ebay|amazon|allegro/i.test(url))score-=3
    if(/google\.|duckduckgo\.|facebook\.|youtube\./i.test(url))score-=10
    results.push({url,rawTitle,snippet:'',score})
  }
  const litePattern=/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*result-link[^"']*["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class=["'][^"']*result-link|$)/gi
  for(const match of String(html||'').matchAll(litePattern)){
    const url=unwrapSearchUrl(match[1]),rawTitle=decodeHtml(match[2])
    const snippet=decodeHtml(match[3].match(/class=["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/td>/i)?.[1]||'')
    const evidence=`${rawTitle} ${snippet}`
    if(!url||!evidence.includes(barcode))continue
    let score=rawTitle.includes(barcode)?8:5
    if(/autodoc|motora|autoparts|auto-?teile|ucando|cz[eę]ści|czujnik|sensor|filter|brake|pompa|pump|bearing|łożysk/i.test(`${url} ${evidence}`))score+=3
    if(/autodoc|motora|ucando|czesciauto24|europarts|autodily/i.test(url))score+=6
    if(/ebay|amazon|allegro/i.test(url))score-=3
    results.push({url,rawTitle,snippet,score})
  }
  const best=results.sort((a,b)=>b.score-a.score)[0]
  if(!best||best.score<4)return null
  const name=best.rawTitle.replaceAll(barcode,'').replace(/\s*[|–—]\s*(?:eBay.*|AUTODOC.*)$/i,'').replace(/\s*\.{3}\s*$/,'').replace(/\s+/g,' ').trim()
  if(!name)return null
  const partNo=webPartNumber(best.rawTitle,barcode)
  const brand=webBrand(best.rawTitle,partNo)
  return {
    barcode,
    name:cleanPartName(name,barcode,partNo,brand)||name,
    brand,
    category:'Części samochodowe',
    part_no:partNo,
    description:'',
    vehicle_fitment:uniqueLines(results.flatMap(result=>[extractFitment(result.rawTitle),extractFitment(result.snippet)])).join('\n'),
    cross_numbers:extractReferenceNumbers(results.map(result=>result.snippet).join('\n'),barcode,partNo),
    image_url:'',
    lookup_source:'Wyszukiwanie WWW',
    lookup_url:best.url,
    web_candidate:true,lookup_version:LOOKUP_VERSION
  }
}

async function lookupBarcodeOnline(fetchImpl,value,{details=false}={}){
  const barcode=normalizeBarcode(value)
  if(!isGtin(barcode))throw new Error('Kod nie jest poprawnym EAN, UPC ani GTIN.')
  const headers={Accept:'application/json','Content-Type':'application/json','User-Agent':'AutologikaOS/1.0.7 (https://github.com/endiszyd-rgb/Autologika-OS)'}
  const providers=[
    {url:`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,map:mapUpcItemDb},
    {url:`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(barcode)}`,map:mapWebSearch,type:'text',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36','Accept-Language':'pl-PL,pl;q=0.9'}},
    {url:`https://search.brave.com/search?q=${encodeURIComponent(`"${barcode}"`)}&source=web`,map:mapWebSearch,type:'text',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'}},
    {url:`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${barcode}"`)}`,map:mapWebSearch,type:'text',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'}},
    {url:`https://upc.dev/v1/product/${encodeURIComponent(barcode)}`,map:mapUpcDev},
    {url:`https://world.openproductsfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=code,product_name,brands,categories,generic_name,image_front_url`,map:mapOpenProductsFacts}
  ]
  let available=false
  let fallbackItem=null
  const errors=[]
  for(const provider of providers){
    try{
      const response=await fetchImpl(provider.url,{headers:{...headers,...provider.headers},signal:AbortSignal.timeout(6000)})
      if(response.status===404){available=true;continue}
      if(!response.ok){errors.push(`${new URL(provider.url).hostname}: HTTP ${response.status}`);continue}
      available=true
      const payload=provider.type==='text'?await response.text():await response.json()
      let item=provider.map(payload,barcode)
      if(item){
        item={vehicle_fitment:'',cross_numbers:'',lookup_version:LOOKUP_VERSION,...item}
        if(item.web_candidate){item=await enrichWebCandidate(fetchImpl,item);return details?{item,available:true,errors}:item}
        fallbackItem??=item
      }
    }catch(error){errors.push(error?.message||String(error))}
  }
  if(fallbackItem)return details?{item:fallbackItem,available:true,errors}:fallbackItem
  return details?{item:null,available,errors}:null
}

module.exports={LOOKUP_VERSION,normalizeBarcode,isGtin,mapUpcDev,mapUpcItemDb,mapOpenProductsFacts,mapWebSearch,cleanPartName,extractFitment,extractReferenceNumbers,enrichPartFromHtml,lookupBarcodeOnline}
