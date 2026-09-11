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
    if(/google\.|duckduckgo\.|facebook\.|youtube\./i.test(url))score-=10
    results.push({url,rawTitle,snippet,score})
  }
  const bravePattern=/<a[^>]*href="(https?:\/\/[^"#]+)"[^>]*class="[^"]*\bl1\b[^"]*"[^>]*>[\s\S]{0,6000}?<div[^>]*class="[^"]*\btitle\b[^"]*"[^>]*title="([^"]+)"/gi
  if(String(html||'').includes(barcode))for(const match of String(html||'').matchAll(bravePattern)){
    const url=decodeHtml(match[1]),rawTitle=decodeHtml(match[2]),evidence=`${rawTitle} ${url}`
    let score=3
    if(/autodoc|motora|autoparts|auto-?teile|ucando|częś|czujnik|sensor|filter|brake|pompa|pump|bearing|łożysk/i.test(evidence))score+=5
    if(/google\.|duckduckgo\.|facebook\.|youtube\./i.test(url))score-=10
    results.push({url,rawTitle,snippet:'',score})
  }
  const best=results.sort((a,b)=>b.score-a.score)[0]
  if(!best||best.score<4)return null
  const name=best.rawTitle.replaceAll(barcode,'').replace(/\s*[|–—]\s*(?:eBay.*|AUTODOC.*)$/i,'').replace(/\s*\.{3}\s*$/,'').replace(/\s+/g,' ').trim()
  if(!name)return null
  const partNo=webPartNumber(best.rawTitle,barcode)
  return {
    barcode,
    name,
    brand:webBrand(best.rawTitle,partNo),
    category:'Części samochodowe',
    part_no:partNo,
    description:best.snippet.slice(0,700),
    image_url:'',
    lookup_source:'Wyszukiwanie WWW',
    lookup_url:best.url,
    web_candidate:true
  }
}

async function lookupBarcodeOnline(fetchImpl,value,{details=false}={}){
  const barcode=normalizeBarcode(value)
  if(!isGtin(barcode))throw new Error('Kod nie jest poprawnym EAN, UPC ani GTIN.')
  const headers={Accept:'application/json','Content-Type':'application/json','User-Agent':'AutologikaOS/1.0.7 (https://github.com/endiszyd-rgb/Autologika-OS)'}
  const providers=[
    {url:`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,map:mapUpcItemDb},
    {url:`https://search.brave.com/search?q=${encodeURIComponent(`"${barcode}"`)}&source=web`,map:mapWebSearch,type:'text',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'}},
    {url:`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`"${barcode}"`)}`,map:mapWebSearch,type:'text',headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'}},
    {url:`https://upc.dev/v1/product/${encodeURIComponent(barcode)}`,map:mapUpcDev},
    {url:`https://world.openproductsfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=code,product_name,brands,categories,generic_name,image_front_url`,map:mapOpenProductsFacts}
  ]
  let available=false
  const errors=[]
  for(const provider of providers){
    try{
      const response=await fetchImpl(provider.url,{headers:{...headers,...provider.headers},signal:AbortSignal.timeout(6000)})
      if(response.status===404){available=true;continue}
      if(!response.ok){errors.push(`${new URL(provider.url).hostname}: HTTP ${response.status}`);continue}
      available=true
      const payload=provider.type==='text'?await response.text():await response.json()
      const item=provider.map(payload,barcode)
      if(item)return details?{item,available:true,errors}:item
    }catch(error){errors.push(error?.message||String(error))}
  }
  return details?{item:null,available,errors}:null
}

module.exports={normalizeBarcode,isGtin,mapUpcDev,mapUpcItemDb,mapOpenProductsFacts,mapWebSearch,lookupBarcodeOnline}
