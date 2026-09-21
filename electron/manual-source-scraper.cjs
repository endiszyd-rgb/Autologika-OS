const crypto=require('crypto')

const MANUAL_TERMS=/(?:workshop|service|repair|serwis|napraw|manual|wiring|schemat|technical|maintenance|technicz|instrukcj)/i
const EXCLUDED_DOMAINS=/(?:facebook|instagram|pinterest|tiktok|youtube|amazon|ebay|allegro)\.|(?:^|[./-])(?:sex[^./]*|porn[^./]*|escort[^./]*|masseur[^./]*|casino[^./]*|betting[^./]*|torrent[^./]*)(?:[./-]|$)/i
const HIGH_VALUE_DOMAINS=/(?:erwin-store|toyota-tech|fordserviceinfo|mercedes-benz|bmwgroup|servicebox|nhtsa\.gov|archive\.org)/i
const OFFICIAL_PORTALS={
  'VOLKSWAGEN':{name:'Volkswagen erWin',url:'https://volkswagen.erwin-store.com/erwin/showHome.do'},
  'AUDI':{name:'Audi erWin',url:'https://audi.erwin-store.com/erwin/showHome.do'},
  'SKODA':{name:'Skoda erWin',url:'https://skoda.erwin-store.com/erwin/showHome.do'},
  'SEAT':{name:'SEAT/CUPRA erWin',url:'https://seat.erwin-store.com/erwin/showHome.do'},
  'CUPRA':{name:'SEAT/CUPRA erWin',url:'https://seat.erwin-store.com/erwin/showHome.do'},
  'BMW':{name:'BMW AOS',url:'https://aos.bmwgroup.com/'},
  'MINI':{name:'BMW AOS',url:'https://aos.bmwgroup.com/'},
  'MERCEDES':{name:'Mercedes-Benz B2B Connect',url:'https://b2bconnect.mercedes-benz.com/'},
  'MERCEDES-BENZ':{name:'Mercedes-Benz B2B Connect',url:'https://b2bconnect.mercedes-benz.com/'},
  'TOYOTA':{name:'Toyota-Tech',url:'https://www.toyota-tech.eu/'},
  'LEXUS':{name:'Toyota-Tech',url:'https://www.toyota-tech.eu/'},
  'FORD':{name:'Ford Service Info',url:'https://www.fordserviceinfo.com/'},
  'PEUGEOT':{name:'Stellantis Service Box',url:'https://public.servicebox-parts.com/'},
  'CITROEN':{name:'Stellantis Service Box',url:'https://public.servicebox-parts.com/'},
  'OPEL':{name:'Stellantis Service Box',url:'https://public.servicebox-parts.com/'},
  'FIAT':{name:'Stellantis Service Box',url:'https://public.servicebox-parts.com/'},
  'ALFA ROMEO':{name:'Stellantis Service Box',url:'https://public.servicebox-parts.com/'},
  'JEEP':{name:'Stellantis Service Box',url:'https://public.servicebox-parts.com/'}
}

function decodeHtml(value=''){
 return String(value||'').replace(/<[^>]*>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(parseInt(code,16))).replace(/&#(\d+);/g,(_,code)=>String.fromCodePoint(parseInt(code,10))).replace(/&quot;/gi,'"').replace(/&apos;|&#39;|&#x27;/gi,"'").replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim()
}
function normalizeText(value=''){return decodeHtml(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('pl-PL')}
function safeUrl(value=''){
 try{const url=new URL(decodeHtml(value).replace(/^\/\//,'https://'));return /^https?:$/.test(url.protocol)?url.href:''}catch{return''}
}
function unwrapSearchUrl(value=''){
 try{const raw=safeUrl(value);if(!raw)return'';const url=new URL(raw),target=url.hostname.endsWith('duckduckgo.com')?url.searchParams.get('uddg'):raw;return safeUrl(target)}catch{return''}
}
function domainOf(value=''){try{return new URL(value).hostname.replace(/^www\./,'')}catch{return''}}
function stableId(value=''){return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0,18)}

function parseDuckDuckGoResults(html=''){
 const rows=[]
 const pattern=/<a[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*result-link[^"']*["'][^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]*class=["'][^"']*result-link|$)/gi
 for(const match of String(html).matchAll(pattern)){
  const url=unwrapSearchUrl(match[1]),title=decodeHtml(match[2]),snippet=decodeHtml(match[3].match(/class=["'][^"']*result-snippet[^"']*["'][^>]*>([\s\S]*?)<\/(?:td|div)>/i)?.[1]||'')
  if(url&&title)rows.push({url,title,snippet,provider:'DuckDuckGo'})
 }
 return rows
}
function parseBingRss(xml=''){
 const rows=[]
 for(const match of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const body=match[1],title=decodeHtml(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1]||''),url=safeUrl(decodeHtml(body.match(/<link>([\s\S]*?)<\/link>/i)?.[1]||'')),snippet=decodeHtml(body.match(/<description>([\s\S]*?)<\/description>/i)?.[1]||'')
  if(url&&title)rows.push({url,title,snippet,provider:'Bing RSS'})
 }
 return rows
}
function parseArchiveResults(payload={}){
 return (payload?.response?.docs||[]).map(item=>({title:Array.isArray(item.title)?item.title[0]:item.title||item.identifier,url:`https://archive.org/details/${encodeURIComponent(item.identifier)}`,snippet:[item.creator,Array.isArray(item.description)?item.description[0]:item.description,item.date].filter(Boolean).join(' · '),provider:'Internet Archive',source_kind:'ARCHIVE'})).filter(item=>item.title&&item.url)
}

function normalizeEngines(engines=[]){
 const seen=new Set(),out=[]
 for(const row of engines||[]){
  const engine=String(row?.engine||'').trim(),codes=String(row?.engine_code||'').split('/').map(x=>x.trim()).filter(Boolean)
  if(codes.length)for(const code of codes){const key=normalizeText(code);if(!seen.has(key)){seen.add(key);out.push({key,engine,engine_code:code,power_hp:Number(row?.power_hp)||null})}}
  else if(engine){const key=normalizeText(engine);if(!seen.has(key)){seen.add(key);out.push({key,engine,engine_code:'',power_hp:Number(row?.power_hp)||null})}}
 }
 return out.slice(0,12)
}
function normalizeRequest(input={}){
 const make=String(input.make||'').trim(),model=String(input.model||'').trim(),year=Number(input.year)
 if(make.length<2||model.length<1)throw new Error('Wybierz markę i model pojazdu.')
 if(!Number.isInteger(year)||year<1950||year>new Date().getFullYear()+1)throw new Error('Podaj poprawny rok pojazdu.')
 return{make,model,year,engines:normalizeEngines(input.engines)}
}
function resultScore(item,request,engine){
 const evidence=normalizeText(`${item.title} ${item.snippet} ${item.url}`),make=normalizeText(request.make),model=normalizeText(request.model),year=String(request.year),engineTokens=[engine?.engine_code,engine?.engine].filter(Boolean).map(normalizeText)
 let score=0
 if(evidence.includes(make))score+=5
 if(evidence.includes(model))score+=6
 if(evidence.includes(year))score+=2
 if(MANUAL_TERMS.test(`${item.title} ${item.snippet}`))score+=5
 if(engineTokens.some(token=>token&&evidence.includes(token)))score+=5
 if(HIGH_VALUE_DOMAINS.test(item.url))score+=5
 if(/\.pdf(?:$|[?#])/i.test(item.url))score+=2
 if(EXCLUDED_DOMAINS.test(item.url))score-=20
 return score
}
function decorateResult(item,request,engine=null){
 const url=safeUrl(item.url),domain=domainOf(url),score=resultScore(item,request,engine)
 return{...item,id:stableId(`${url}|${engine?.engine_code||engine?.engine||'ALL'}`),url,domain,relevance:score,make:request.make,model:request.model,year:request.year,engine:engine?.engine||'',engine_code:engine?.engine_code||'',engine_key:engine?.key||'ALL',source_kind:item.source_kind||(HIGH_VALUE_DOMAINS.test(url)?'OFFICIAL_OR_ARCHIVE':'WEB')}
}
function dedupeResults(rows=[]){
 const map=new Map()
 for(const row of rows.filter(row=>row.url&&row.relevance>=7&&!EXCLUDED_DOMAINS.test(row.url))){
  const key=`${row.url}|${row.engine_key}`
  if(!map.has(key)||map.get(key).relevance<row.relevance)map.set(key,row)
 }
 return [...map.values()].sort((a,b)=>b.relevance-a.relevance||a.title.localeCompare(b.title,'pl')).slice(0,80)
}
async function fetchSearchPage(fetchImpl,query){
 const headers={Accept:'text/html,application/xhtml+xml,application/xml','User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36','Accept-Language':'pl-PL,pl;q=0.9,en;q=0.7'}
 try{
  const response=await fetchImpl(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`,{headers,signal:AbortSignal.timeout(9000)})
  if(response.ok){const rows=parseDuckDuckGoResults(await response.text());if(rows.length)return{rows,available:true}}
 }catch{}
 try{
  const response=await fetchImpl(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`,{headers,signal:AbortSignal.timeout(9000)})
  if(response.ok)return{rows:parseBingRss(await response.text()),available:true}
 }catch{}
 return{rows:[],available:false}
}
async function searchArchive(fetchImpl,request){
 const phrase=`${request.make} ${request.model} ${request.year} service repair workshop manual`,q=`title:(${phrase.replace(/[^\p{L}\p{N}\s.-]/gu,' ')})`,url=`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=creator&fl%5B%5D=description&fl%5B%5D=date&rows=15&page=1&output=json`
 try{const response=await fetchImpl(url,{headers:{Accept:'application/json','User-Agent':'AutologikaOS/1.0'},signal:AbortSignal.timeout(9000)});if(response.ok)return parseArchiveResults(await response.json())}catch{}
 return[]
}
function officialPortalResult(request){
 const portal=OFFICIAL_PORTALS[normalizeText(request.make)]
 if(!portal)return null
 return decorateResult({title:`${portal.name} — oficjalna dokumentacja naprawcza`,url:portal.url,snippet:`Portal producenta dla ${request.make} ${request.model}. Dostęp do dokumentów może wymagać konta lub wykupienia czasu.`,provider:'Katalog OEM/RMI',source_kind:'OEM_PORTAL'},request)
}
async function searchTechnicalManuals(fetchImpl,input={}){
 const request=normalizeRequest(input),queries=[{query:`"${request.make} ${request.model}" ${request.year} workshop service repair manual PDF`,engine:null}]
 for(const engine of request.engines)queries.push({query:`"${request.make} ${request.model}" ${request.year} "${engine.engine_code||engine.engine}" repair workshop manual`,engine})
 const [web,archive]=await Promise.all([Promise.all(queries.map(row=>fetchSearchPage(fetchImpl,row.query).then(result=>({result,engine:row.engine})))),searchArchive(fetchImpl,request)])
 const rows=[]
 for(const {result,engine} of web)rows.push(...result.rows.map(item=>decorateResult(item,request,engine)))
 rows.push(...archive.map(item=>decorateResult(item,request,null)))
 const portal=officialPortalResult(request);if(portal)rows.unshift(portal)
 const results=dedupeResults(rows),groups=[{key:'ALL',engine:'Dokumentacja ogólna',engine_code:'',results:results.filter(row=>row.engine_key==='ALL')}]
 for(const engine of request.engines){const matches=results.filter(row=>row.engine_key===engine.key);if(matches.length)groups.push({key:engine.key,engine:engine.engine||engine.engine_code,engine_code:engine.engine_code,power_hp:engine.power_hp,results:matches})}
 return{vehicle:request,groups,results,available:web.some(item=>item.result.available)||archive.length>0,searched_at:new Date().toISOString()}
}

module.exports={decodeHtml,parseDuckDuckGoResults,parseBingRss,parseArchiveResults,normalizeEngines,normalizeRequest,resultScore,dedupeResults,searchTechnicalManuals,officialPortalResult}
