// Moduł newsFeed ekranu „Hala na żywo”: RSS portali motoryzacyjnych + kursy NBP.
// Wejście/wyjście (pobieranie, cache) jest wstrzykiwane — ten sam kod działa w procesie Electron i w PWA.

const NEWS_TTL_MS=60*60*1000
const NEWS_FEEDS=[
 {id:'motofakty',source:'Motofakty',url:'https://motofakty.pl/rss'},
 {id:'interia',source:'Interia Motoryzacja',url:'https://motoryzacja.interia.pl/feed'},
 {id:'motofocus',source:'MotoFocus',url:'https://motofocus.pl/rss'},
 {id:'autogaleria',source:'autoGALERIA',url:'https://www.autogaleria.pl/feed'}
]
const NBP_CURRENCIES=['EUR','USD']
const nbpUrl=code=>`https://api.nbp.pl/api/exchangerates/rates/a/${code.toLowerCase()}/?format=json`

const ENTITIES={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',bdquo:'„',rdquo:'”',ldquo:'“',rsquo:'’',lsquo:'‘',oacute:'ó',Oacute:'Ó'}
function decodeEntities(value){
 return String(value||'').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,(match,code)=>{
  if(code[0]==='#'){const point=code[1].toLowerCase()==='x'?parseInt(code.slice(2),16):parseInt(code.slice(1),10);return Number.isFinite(point)&&point>0&&point<0x110000?String.fromCodePoint(point):''}
  return ENTITIES[code]??match
 })
}
const unwrap=value=>String(value||'').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/,'$1')
// Tekst z RSS jest niezaufany: zostawiamy wyłącznie czysty tekst (bez tagów), React i tak go escapuje.
// Najpierw dekodujemy encje (HTML bywa zakodowany bez CDATA), potem usuwamy tagi — dwukrotnie, na wypadek podwójnego kodowania.
const plain=value=>decodeEntities(decodeEntities(unwrap(value)).replace(/<[^>]*>/g,' ')).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()
const tag=(xml,name)=>{const match=xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,'i'));return match?match[1]:''}
const tags=(xml,name)=>[...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`,'gi'))].map(match=>plain(match[1]))

function safeUrl(value){
 try{const url=new URL(plain(value));return ['http:','https:'].includes(url.protocol)?url.href:''}
 catch{return ''}
}

const CATEGORY_RULES=[
 ['PRZEPISY',/przepis|mandat|prawo jazdy|ustaw|rozporz|kodeks|policj|fotoradar|punkty karne|kar[ayę]|opłat|akcyz|ministerst|unij|\bue\b|homologac|badani[ea] technic/i],
 ['TUNING',/tuning|chip|stage ?\d|moc\b|\bkm\b|wydech|remap|sport|osiągi|turbo|wyścig|rajd/i],
 ['CZESCI',/części|częśc|olej|filtr|hamul|opon|akumulator|sprzęgł|rozrząd|amortyz|dpf|egr|wtrysk|świec|zawieszeni|diagnost|warsztat|serwis|hella|bosch|valeo|dystrybut/i]
]
function categorize(text){
 for(const [category,rule] of CATEGORY_RULES)if(rule.test(text))return category
 return 'OGOLNE'
}
const CATEGORY_LABELS={PRZEPISY:'PRZEPISY',TUNING:'TUNING',CZESCI:'CZĘŚCI',OGOLNE:'MOTORYZACJA'}

const MAX_ITEMS_PER_FEED=60
// Liniowe skanowanie (bez regexu na całym dokumencie) — uszkodzony kanał nie zablokuje procesu głównego
function itemBlocks(xml,limit=MAX_ITEMS_PER_FEED){
 const source=String(xml||''),lower=source.toLowerCase(),blocks=[]
 let from=0
 while(blocks.length<limit){
  const start=lower.indexOf('<item',from)
  if(start<0)break
  const end=lower.indexOf('</item>',start)
  if(end<0)break
  blocks.push(source.slice(start,end+7))
  from=end+7
 }
 return blocks
}

function parseRss(xml,feed){
 const items=[]
 for(const block of itemBlocks(xml)){
  if(block.length>20000)continue
  const title=plain(tag(block,'title')),url=safeUrl(tag(block,'link'))
  if(!title||!url)continue
  const lead=plain(tag(block,'description')).replace(/\s*Artykuł .+ pochodzi z serwisu .+$/i,'').slice(0,240)
  const published=Date.parse(plain(tag(block,'pubDate')))
  const categories=tags(block,'category').join(' ')
  const category=categorize(`${title} ${categories} ${lead}`)
  items.push({id:`${feed.id}:${url}`,source:feed.source,feed:feed.id,title,lead,url,category,label:CATEGORY_LABELS[category],publishedAt:Number.isFinite(published)?new Date(published).toISOString():null})
 }
 return items
}

function parseNbp(json,code){
 const rate=json?.rates?.[0]
 const mid=Number(rate?.mid)
 if(!Number.isFinite(mid)||mid<=0)return null
 return{code:String(json.code||code).toUpperCase(),mid,date:String(rate.effectiveDate||'')}
}

// Przeplatanie źródeł, żeby jedno nie zdominowało listy, potem od najnowszych
function mergeNews(groups,limit=24){
 const newest=(a,b)=>String(b.publishedAt||'').localeCompare(String(a.publishedAt||''))
 const queues=groups.map(group=>[...group].sort(newest)).filter(group=>group.length)
 const seen=new Set(),urls=new Set(),all=[]
 // kolejka po jednej wiadomości z każdego źródła na rundę
 for(let round=0;all.length<limit&&queues.some(queue=>queue.length>round);round++){
  const batch=queues.map(queue=>queue[round]).filter(Boolean).sort(newest)
  for(const item of batch){
   const key=item.title.toLocaleLowerCase('pl-PL')
   if(seen.has(key)||(item.url&&urls.has(item.url))||all.length>=limit)continue
   seen.add(key);urls.add(item.url);all.push(item)
  }
 }
 return all
}

async function fetchNewsFeed({fetchText,fetchJson,feeds=NEWS_FEEDS,currencies=NBP_CURRENCIES,now=()=>new Date()}={}){
 const errors=[]
 const groups=fetchText?await Promise.all(feeds.map(async feed=>{
  try{return parseRss(await fetchText(feed.url),feed)}
  catch(error){errors.push({source:feed.source,message:String(error?.message||error)});return[]}
 })):[]
 const rates=fetchJson?(await Promise.all(currencies.map(async code=>{
  try{return parseNbp(await fetchJson(nbpUrl(code)),code)}
  catch(error){errors.push({source:`NBP ${code}`,message:String(error?.message||error)});return null}
 }))).filter(Boolean):[]
 const items=mergeNews(groups)
 return{items,rates,refreshedAt:now().toISOString(),sources:[...new Set(items.map(item=>item.source))],errors}
}

const isFresh=(cache,now,ttl=NEWS_TTL_MS)=>{
 // znacznik z przyszłości (przestawiony zegar) nie jest „świeży”
 const age=now.getTime()-Date.parse(cache?.refreshedAt)
 return Number.isFinite(age)&&age>=0&&age<ttl
}

// Cache z pliku/localStorage traktujemy jak dane z zewnątrz: ponownie filtrujemy adresy i tekst
function sanitizeCache(cache){
 if(!cache||typeof cache!=='object')return null
 const items=(Array.isArray(cache.items)?cache.items:[]).map(item=>({...item,url:safeUrl(item?.url),title:plain(item?.title),lead:plain(item?.lead)})).filter(item=>item.url&&item.title)
 const rates=(Array.isArray(cache.rates)?cache.rates:[]).filter(rate=>Number.isFinite(Number(rate?.mid))&&Number(rate.mid)>0).map(rate=>({code:String(rate.code||'').slice(0,3).toUpperCase(),mid:Number(rate.mid),date:String(rate.date||'')}))
 return{...cache,items,rates,sources:[...new Set(items.map(item=>item.source))]}
}

// Cache 1 h; offline albo błąd wszystkich źródeł → ostatnie pobrane dane z flagą stale
async function getNewsFeed({force=false,readCache,writeCache,now=()=>new Date(),ttl=NEWS_TTL_MS,...io}={}){
 let cache=null
 try{cache=sanitizeCache(readCache?await readCache():null)}catch{cache=null}
 if(!force&&isFresh(cache,now(),ttl))return{...cache,cached:true,stale:false}
 const fresh=await fetchNewsFeed({...io,now})
 const usable=fresh.items.length||fresh.rates.length
 if(!usable&&cache)return{...cache,cached:true,stale:true,errors:fresh.errors}
 // częściowa awaria: brakujące części uzupełniamy z cache
 const items=fresh.items.length?fresh.items:cache?.items||[]
 const merged={...fresh,items,rates:fresh.rates.length?fresh.rates:cache?.rates||[],sources:[...new Set(items.map(item=>item.source))]}
 if(usable){try{await writeCache?.(merged)}catch{}}
 // wiadomości wzięte z cache przy świeżych kursach też oznaczamy jako offline
 return{...merged,cached:false,stale:!usable||(!fresh.items.length&&items.length>0)}
}

module.exports={NEWS_TTL_MS,NEWS_FEEDS,NBP_CURRENCIES,nbpUrl,decodeEntities,parseRss,parseNbp,categorize,mergeNews,fetchNewsFeed,getNewsFeed,isFresh,sanitizeCache,itemBlocks}
