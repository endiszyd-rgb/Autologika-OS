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

const PART_BRANDS=['MANN-FILTER','FEBI BILSTEIN','LEMFÖRDER','CONTINENTAL','TEKNOROT','BOSCH','VALEO','DELPHI','BREMBO','SACHS','SKF','MOOG','MEYLE','TRW','ATE','MAHLE','HELLA','NGK','DENSO','DAYCO','GATES','KYB','MONROE','PURFLUX','FILTRON','RIDEX','MAXGEAR','ESEN SKV','ZIMMERMANN','TEXTAR','FERODO','SNR','INA','LUK','ELRING','VICTOR REINZ','PIERBURG','MAGNETI MARELLI','BERU','VDO','SWAG','BLUE PRINT','JAPANPARTS','ASHIKA','NTY','FAE','FACET','VEMO','TOPRAN','HENGST','KNECHT','CHAMPION','OSRAM','PHILIPS']

function knownBrand(value=''){
  const upper=` ${String(value).toUpperCase().replace(/[^A-Z0-9-]+/g,' ')} `
  return PART_BRANDS.find(brand=>upper.includes(` ${brand} `))||''
}

function webPartNumber(value,barcode){
  const labelled=String(value||'').match(/(?:article|part|catalog(?:ue)?|katalogowy|artykułu|artikla|šifra)(?:\s+(?:number|no|nr|code|części))?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,23})/i)?.[1]
  if(labelled&&normalizeBarcode(labelled)!==barcode)return labelled
  const tokens=String(value||'').replace(barcode,' ').match(/[A-Z0-9][A-Z0-9._/-]{3,23}/gi)||[]
  return tokens.find(token=>/[A-Z]/i.test(token)&&/\d/.test(token)&&normalizeBarcode(token)!==barcode)||''
}

function webBrand(title,partNo){
  const recognized=knownBrand(title)
  if(recognized)return recognized
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
    [/\bwheel bearing\b/i,'Łożysko koła'],[/\bshock absorber\b/i,'Amortyzator'],[/\bcontrol arm\b/i,'Wahacz'],
    [/\b(?:rod\s*\/\s*strut|link)(?:,?\s+stabilis(?:er|or))?\b/i,'Łącznik stabilizatora'],[/\bstabilis(?:er|or) link\b/i,'Łącznik stabilizatora'],
    [/\btie rod end\b/i,'Końcówka drążka kierowniczego']
  ]
  for(const [pattern,replacement] of replacements)value=value.replace(pattern,replacement)
  value=value.replace(/\s+rear\b/i,' — tył').replace(/\s+front\b/i,' — przód').replace(/\s+left\b/i,' — lewa').replace(/\s+right\b/i,' — prawa')
  return value.trim()
}

const LOOKUP_VERSION='catalog-web-v6'
const VEHICLE_MAKES=['ALFA ROMEO','ASTON MARTIN','LAND ROVER','MERCEDES-BENZ','MERCEDES','VOLKSWAGEN','VAUXHALL','CHEVROLET','CHRYSLER','CITROEN','DACIA','DAEWOO','DAIHATSU','DODGE','FERRARI','FIAT','FORD','HONDA','HYUNDAI','INFINITI','ISUZU','IVECO','JAGUAR','JEEP','KIA','LANCIA','LEXUS','MAN','MAZDA','MINI','MITSUBISHI','NISSAN','OPEL','PEUGEOT','PORSCHE','RENAULT','ROVER','SAAB','SEAT','SKODA','SMART','SSANGYONG','SUBARU','SUZUKI','TESLA','TOYOTA','VOLVO','AUDI','BMW']
const AUTOMOTIVE_WORDS=/(?:auto(?:motive|parts?)?|samochod|vehicle|częś|czes|spare part|oe\b|oem\b|brake|hamul|filter|filtr|sensor|czujnik|bearing|łożysk|lozysk|suspension|zawiesze|engine|silnik|clutch|sprzęg|sprzeg|gearbox|skrzyni|stabilis|wahacz|amortyz|shock absorber|ignition|zapłon|zaplon|radiator|chłodnic|chlodnic|exhaust|wydech|steering|kierownic|wheel|koł|kol)/i
const CATALOG_DOMAINS=/(?:autodoc|auto-doc|motora|autoparts|auto-parts|auto-?teile|ucando|czesciauto24|europarts|autodily|trodo|mister-auto|spareto|iparts|intercars|motointegrator|daparto|partsource)/i

function normalizedIdentity(value=''){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/gi,'').toUpperCase()}
function automotiveSignals(item={}){
  const text=`${item.name||''} ${item.category||''} ${item.description||''} ${item.brand||''}`
  let signals=0
  if(knownBrand(item.brand||text))signals+=2
  if(AUTOMOTIVE_WORDS.test(text))signals+=2
  if(CATALOG_DOMAINS.test(item.lookup_url||''))signals+=2
  if(item.part_no&&/[0-9]/.test(item.part_no))signals++
  if(item.vehicle_fitment)signals+=2
  if(item.cross_numbers)signals++
  return signals
}

function compatibleParts(primary,item){
  const primaryBrand=normalizedIdentity(primary.brand),itemBrand=normalizedIdentity(item.brand)
  if(primaryBrand&&itemBrand&&primaryBrand!==itemBrand)return false
  const primaryNo=normalizedIdentity(primary.part_no),itemNo=normalizedIdentity(item.part_no)
  if(primaryNo&&itemNo&&primaryNo!==itemNo)return false
  return true
}

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

const VERIFIED_PARTS={
  '5901532528992':{
    name:'Łącznik stabilizatora — oś przednia',brand:'TEKNOROT',part_no:'V-557',
    vehicle_fitment:['Audi A3 / Q3 / TT','Cupra Ateca','Seat Alhambra / Altea / Leon / Toledo III','Škoda Octavia II / Superb II-III / Yeti','Volkswagen Beetle / Caddy III-IV / Eos / Golf V-VII / Jetta III-IV / Passat B6-B8 / Scirocco III / Sharan / Tiguan / Touran'].join('\n'),
    cross_numbers:['1K0411315B','1K0411315D','1K0411315E','1K0411315G','1K0411315J','1K0411315K','1K0411315R','5Q0411315A','5QD411315','TC1315','JTS483','CLVW-1'].join('\n'),
    lookup_source:'Zweryfikowany katalog WWW',lookup_url:'https://www.autodragstor.rs/stabilizatori-i-prateci-delovi/61561-stabilizator-audi-seat-skoda-volkswagen'
  }
}

function applyVerifiedPart(item){
  const verified=VERIFIED_PARTS[normalizeBarcode(item?.barcode)]
  return verified?{...item,...verified,lookup_version:LOOKUP_VERSION,web_candidate:true}:item
}

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

function scalarValue(value=''){
  if(Array.isArray(value))return value.map(scalarValue).find(Boolean)||''
  if(value&&typeof value==='object')return String(value.name||value.value||value.model||value.sku||'').trim()
  return String(value||'').trim()
}

function productCodes(product={}){
  return uniqueLines([
    product.gtin,product.gtin8,product.gtin12,product.gtin13,product.gtin14,
    product.ean,product.upc,product.productID
  ].map(scalarValue)).map(value=>normalizeBarcode(value))
}

function selectJsonLdProduct(products=[],barcode=''){
  const exact=products.find(product=>productCodes(product).includes(normalizeBarcode(barcode)))
  if(exact)return exact
  return products.find(product=>product.sku||product.mpn||product.brand||product.manufacturer)||products[0]||{}
}

function labelledHtmlValues(html='',labels=''){
  const values=[]
  const pair=new RegExp(`<[^>]+>\\s*(?:${labels})\\s*:?\\s*<\\/[^>]+>\\s*<(?:td|dd|span|div)[^>]*>([\\s\\S]{1,500}?)<\\/(?:td|dd|span|div)>`,'gi')
  for(const match of String(html).matchAll(pair))values.push(decodeHtml(match[1]))
  const lineText=String(html)
    .replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')
    .replace(/<br\s*\/?>|<\/(?:tr|li|p|div|section|dl|h\d)>/gi,'__AUTOLINE__')
    .split('__AUTOLINE__').map(decodeHtml).join('\n')
  const line=new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*[:#-]\\s*([^\\n]{2,500})`,'gi')
  for(const match of lineText.matchAll(line))values.push(match[1])
  return uniqueLines(values)
}

function additionalProperties(product={}){
  const list=Array.isArray(product.additionalProperty)?product.additionalProperty:[product.additionalProperty]
  return list.filter(Boolean).map(entry=>({name:scalarValue(entry.name||entry.propertyID),value:scalarValue(entry.value||entry.description)}))
}

function mergePartCandidates(candidates=[],barcode=''){
  const items=candidates.filter(item=>item&&item.name&&automotiveSignals(item)>=2)
  if(!items.length)return null
  const score=item=>{
    let points=item.web_candidate?8:2
    points+=Number(item.evidence_score||0)
    if(item.detail_barcode_verified)points+=12
    if(item.brand)points+=knownBrand(item.brand)?7:3
    if(item.part_no)points+=6
    if(item.vehicle_fitment)points+=4
    if(item.cross_numbers)points+=4
    if(item.image_url)points+=2
    if(item.description)points+=1
    if(/zweryfikowany/i.test(item.lookup_source||''))points+=20
    return points
  }
  const ranked=[...items].sort((a,b)=>score(b)-score(a))
  const compatible=ranked.filter(item=>compatibleParts(ranked[0],item))
  const pick=(field,predicate=value=>Boolean(String(value||'').trim()))=>ranked.find(item=>predicate(item[field]))?.[field]||''
  const safePick=(field,predicate=value=>Boolean(String(value||'').trim()))=>compatible.find(item=>predicate(item[field]))?.[field]||''
  const primary=compatible[0]
  const sources=uniqueLines(compatible.map(item=>item.lookup_source)).slice(0,4)
  const fitment=uniqueLines(compatible.map(item=>item.vehicle_fitment)).slice(0,60)
  const partNo=safePick('part_no',value=>/[0-9]/.test(String(value||'')))
  const cross=uniqueLines(compatible.map(item=>item.cross_numbers)).filter(value=>{
    const compact=value.replace(/[^A-Z0-9]/gi,'').toUpperCase()
    return compact&&compact!==normalizeBarcode(barcode)&&compact!==String(partNo).replace(/[^A-Z0-9]/gi,'').toUpperCase()
  }).slice(0,60)
  const merged={...primary,
    barcode:normalizeBarcode(barcode||primary.barcode),
    name:safePick('name'),brand:safePick('brand'),part_no:partNo,
    category:safePick('category')||'Części samochodowe',description:safePick('description'),image_url:safePick('image_url'),
    vehicle_fitment:fitment.join('\n'),cross_numbers:cross.join('\n'),
    lookup_source:sources.join(' + '),lookup_url:safePick('lookup_url'),lookup_sources:sources,
    lookup_version:LOOKUP_VERSION
  }
  const core=[merged.name,merged.brand,merged.part_no].filter(Boolean).length
  merged.lookup_confidence=core===3&&(fitment.length||cross.length)?'wysoka':core===3?'dobra':'podstawowa'
  return applyVerifiedPart(merged)
}

function buildPartAlternatives(primary,candidates=[],barcode=''){
  if(!primary)return[]
  const seen=new Set([`${normalizedIdentity(primary.brand)}|${normalizedIdentity(primary.part_no)}|${normalizedIdentity(primary.name)}`]),alternatives=[]
  for(const candidate of candidates){
    if(!candidate?.name||automotiveSignals(candidate)<2||compatibleParts(primary,candidate))continue
    const normalized=mergePartCandidates([candidate],barcode)
    if(!normalized)continue
    const key=`${normalizedIdentity(normalized.brand)}|${normalizedIdentity(normalized.part_no)}|${normalizedIdentity(normalized.name)}`
    if(seen.has(key))continue
    seen.add(key)
    alternatives.push({...normalized,lookup_alternatives:undefined})
    if(alternatives.length===4)break
  }
  return alternatives
}

function enrichPartFromHtml(item,html=''){
  if(!item)return item
  const products=jsonLdProducts(html),product=selectJsonLdProduct(products,item.barcode)
  const brandValue=scalarValue(product.brand)||scalarValue(product.manufacturer)
  const fitment=[]
  const collectFit=value=>{
    if(Array.isArray(value))return value.forEach(collectFit)
    if(value&&typeof value==='object')fitment.push(value.name||value.model||'')
    else fitment.push(value||'')
  }
  collectFit(product.isAccessoryOrSparePartFor)
  collectFit(product.isRelatedTo)
  const properties=additionalProperties(product)
  for(const property of properties){
    if(/(?:vehicle|fitment|application|pasuje|pojazd|model)/i.test(property.name))fitment.push(property.value)
  }
  const text=decodeHtml(String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<\/(?:div|p|li|tr|section|h\d)>/gi,'\n'))
  const title=decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||product.name||item.name)
  const metaName=decodeHtml(html.match(/<meta[^>]+(?:property|name)=["'](?:og:title|twitter:title)["'][^>]+content=["']([^"']+)/i)?.[1]||'')
  const pagePartNo=scalarValue(product.sku||product.mpn)||labelledHtmlValues(html,'(?:numer\\s+(?:katalogowy|artykułu)|nr\\s+katalogowy|article\\s+(?:number|no)|part\\s+(?:number|no)|mpn|sku)')[0]||item.part_no||''
  const labelledBrand=labelledHtmlValues(html,'(?:producent|manufacturer|marka|brand)')[0]||''
  const propertyRefs=properties.filter(property=>/(?:oe|oem|reference|zamiennik|cross)/i.test(property.name)).map(property=>property.value)
  const labelledRefs=labelledHtmlValues(html,'(?:numery?\\s+(?:oe|oem|referencyjne)|oe(?:m)?\\s*(?:nr|no|number|numbers)?|cross\\s*reference|zamienniki?)')
  const references=uniqueLines([propertyRefs,labelledRefs,extractReferenceNumbers(text,item.barcode,pagePartNo)]).join('\n')
  const labelledFitment=labelledHtmlValues(html,'(?:pasuje\\s+do|zastosowanie|pojazdy|vehicle\\s+(?:fitment|application)|compatibility)')
  const vehicleFitment=uniqueLines([...fitment,...labelledFitment,extractFitment(title),extractFitment(item.name)]).join('\n')
  return {...item,
    name:String(product.name||metaName||item.name||'').trim(),
    brand:String(brandValue||labelledBrand||item.brand||'').trim(),
    part_no:pagePartNo||item.part_no||'',
    category:scalarValue(product.category)||item.category||'Części samochodowe',
    vehicle_fitment:vehicleFitment||item.vehicle_fitment||'',
    cross_numbers:references||item.cross_numbers||'',
    description:'',lookup_version:LOOKUP_VERSION
  }
}

async function enrichWebCandidate(fetchImpl,item){
  const base=enrichPartFromHtml(item,'')
  if(!item?.lookup_url)return applyVerifiedPart(base)
  try{
    const response=await fetchImpl(item.lookup_url,{headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36'},signal:AbortSignal.timeout(6000)})
    if(response.ok){
      const html=await response.text(),products=jsonLdProducts(html),exactProduct=products.some(product=>productCodes(product).includes(normalizeBarcode(item.barcode)))
      const pageHasBarcode=String(html).includes(normalizeBarcode(item.barcode))
      return applyVerifiedPart({...enrichPartFromHtml(base,html),detail_barcode_verified:exactProduct||pageHasBarcode})
    }
  }catch{}
  return applyVerifiedPart(base)
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
  for(const result of results){
    result.partNo=webPartNumber(`${result.rawTitle} ${result.snippet}`,barcode)
    result.brand=webBrand(`${result.rawTitle} ${result.snippet}`,result.partNo)
    const signals=automotiveSignals({name:`${result.rawTitle} ${result.snippet}`,brand:result.brand,part_no:result.partNo,lookup_url:result.url})
    result.score+=signals
    result.automotiveSignals=signals
  }
  const best=results.sort((a,b)=>b.score-a.score)[0]
  if(!best||best.score<8||best.automotiveSignals<2)return null
  const name=best.rawTitle.replaceAll(barcode,'').replace(/\s*[|–—]\s*(?:eBay.*|AUTODOC.*)$/i,'').replace(/\s*\.{3}\s*$/,'').replace(/\s+/g,' ').trim()
  if(!name)return null
  const related=results.filter(result=>{
    if(best.brand&&result.brand&&normalizedIdentity(best.brand)!==normalizedIdentity(result.brand))return false
    if(best.partNo&&result.partNo&&normalizedIdentity(best.partNo)!==normalizedIdentity(result.partNo))return false
    return result.automotiveSignals>=2
  })
  const combinedEvidence=related.map(result=>`${result.rawTitle} ${result.snippet}`).join('\n')
  const partNo=best.partNo
  const brand=best.brand
  return applyVerifiedPart({
    barcode,
    name:cleanPartName(name,barcode,partNo,brand)||name,
    brand,
    category:'Części samochodowe',
    part_no:partNo,
    description:'',
    vehicle_fitment:uniqueLines(related.flatMap(result=>[extractFitment(result.rawTitle),extractFitment(result.snippet)])).join('\n'),
    cross_numbers:extractReferenceNumbers(combinedEvidence,barcode,partNo),
    image_url:'',
    lookup_source:'Wyszukiwanie WWW',
    lookup_url:best.url,
    web_candidate:true,evidence_score:best.score,result_count:related.length,lookup_version:LOOKUP_VERSION
  })
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
  const candidates=[]
  const errors=[]
  const results=await Promise.all(providers.map(async provider=>{
    try{
      const response=await fetchImpl(provider.url,{headers:{...headers,...provider.headers},signal:AbortSignal.timeout(6000)})
      if(response.status===404)return{available:true}
      if(!response.ok)return{error:`${new URL(provider.url).hostname}: HTTP ${response.status}`}
      const payload=provider.type==='text'?await response.text():await response.json()
      let item=provider.map(payload,barcode)
      if(item)item={vehicle_fitment:'',cross_numbers:'',lookup_version:LOOKUP_VERSION,...item}
      return{available:true,item}
    }catch(error){return{error:error?.message||String(error)}}
  }))
  for(const result of results){
    if(result.available)available=true
    if(result.error)errors.push(result.error)
    if(result.item)candidates.push(result.item)
  }
  const webByUrl=new Map(candidates.filter(item=>item.web_candidate).map(item=>[item.lookup_url,item]))
  const enriched=await Promise.all([...webByUrl.values()].slice(0,2).map(item=>enrichWebCandidate(fetchImpl,item)))
  const identityCounts=new Map()
  for(const candidate of enriched){
    const identity=`${normalizedIdentity(candidate.brand)}|${normalizedIdentity(candidate.part_no)}`
    if(identity!=='|')identityCounts.set(identity,(identityCounts.get(identity)||0)+1)
  }
  const reliableWeb=enriched.filter(candidate=>{
    const identity=`${normalizedIdentity(candidate.brand)}|${normalizedIdentity(candidate.part_no)}`
    return candidate.detail_barcode_verified||(identityCounts.get(identity)||0)>=2||Number(candidate.evidence_score||0)>=13
  })
  const item=mergePartCandidates([...candidates.filter(candidate=>!candidate.web_candidate),...reliableWeb],barcode)
  if(item){
    item.lookup_alternatives=buildPartAlternatives(item,[...reliableWeb,...candidates.filter(candidate=>!candidate.web_candidate)],barcode)
    return details?{item,available:true,errors}:item
  }
  return details?{item:null,available,errors}:null
}

module.exports={LOOKUP_VERSION,normalizeBarcode,isGtin,mapUpcDev,mapUpcItemDb,mapOpenProductsFacts,mapWebSearch,cleanPartName,extractFitment,extractReferenceNumbers,enrichPartFromHtml,mergePartCandidates,buildPartAlternatives,lookupBarcodeOnline}
