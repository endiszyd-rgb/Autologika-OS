// Wiadomości motoryzacyjne + kursy NBP dla wersji na telefon (PWA).
// Portale RSS nie pozwalają przeglądarce pobierać kanałów z innej domeny (CORS), więc pobiera je serwer.
// Tylko stała lista źródeł z shared/news-feed.cjs — funkcja nie przyjmuje adresów od klienta.
// Wymaga zalogowanego użytkownika (verify_jwt w supabase/config.toml).
import {getNewsFeed} from './news-feed.generated.mjs'

const MAX_BYTES=1_500_000
const TIMEOUT_MS=10_000
const allowedOrigins=new Set([
 'https://endiszyd-rgb.github.io',
 'http://localhost:5173','http://127.0.0.1:5173','http://localhost:4173','http://127.0.0.1:4173'
])

const corsHeaders=(origin:string)=>allowedOrigins.has(origin)?{
 'access-control-allow-origin':origin,
 'access-control-allow-methods':'GET, OPTIONS',
 'access-control-allow-headers':'authorization, apikey, content-type, x-client-info',
 'access-control-max-age':'86400',
 'vary':'Origin'
}:{}

// Odczyt z limitem rozmiaru (kanał nie może zapchać pamięci funkcji)
async function limitedText(url:string,accept:string){
 const response=await fetch(url,{headers:{accept,'user-agent':'AutoLogika-News/1.0'},redirect:'follow',signal:AbortSignal.timeout(TIMEOUT_MS)})
 if(!response.ok)throw new Error(`HTTP ${response.status}`)
 // przekierowanie tylko w obrębie tego samego portalu
 const host=(value:string)=>new URL(value).hostname.replace(/^www\./,'')
 if(response.url&&host(response.url)!==host(url)){await response.body?.cancel();throw new Error('Przekierowanie poza portal')}
 const declared=Number(response.headers.get('content-length')||0)
 if(declared>MAX_BYTES)throw new Error('Kanał jest za duży')
 const reader=response.body?.getReader()
 if(!reader)return ''
 const chunks:Uint8Array[]=[];let total=0
 for(;;){
  const {done,value}=await reader.read()
  if(done)break
  total+=value.byteLength
  if(total>MAX_BYTES){await reader.cancel();throw new Error('Kanał jest za duży')}
  chunks.push(value)
 }
 const all=new Uint8Array(total);let offset=0
 for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}
 return new TextDecoder().decode(all)
}

// Pamięć podręczna instancji (1 h, jak w aplikacji) + zapytania w toku współdzielone
let cache:unknown=null
let inflight:Promise<unknown>|null=null
let lastForcedAt=0
const load=(force:boolean)=>{
 if(inflight)return inflight
 inflight=getNewsFeed({
  force,
  readCache:()=>cache,
  writeCache:(value:unknown)=>{cache=value},
  fetchText:(url:string)=>limitedText(url,'application/rss+xml, application/xml;q=0.9, */*;q=0.5'),
  fetchJson:async(url:string)=>JSON.parse(await limitedText(url,'application/json'))
 }).finally(()=>{inflight=null})
 return inflight
}

Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',cors=corsHeaders(origin)
 if(req.method==='OPTIONS')return new Response(null,{status:allowedOrigins.has(origin)?204:403,headers:cors})
 if(req.method!=='GET')return new Response(JSON.stringify({error:'Metoda nie jest obsługiwana.'}),{status:405,headers:{...cors,'content-type':'application/json; charset=utf-8'}})
 try{
  // „Odśwież” z telefonu wymusza pobranie najwyżej raz na 5 minut (ochrona portali przed nadmiarem zapytań)
  const force=new URL(req.url).searchParams.get('force')==='1'&&Date.now()-lastForcedAt>=5*60_000
  if(force)lastForcedAt=Date.now()
  const feed=await load(force)
  return new Response(JSON.stringify(feed),{headers:{...cors,'content-type':'application/json; charset=utf-8','cache-control':'private, max-age=300','x-content-type-options':'nosniff'}})
 }catch(error){
  return new Response(JSON.stringify({error:String((error as Error)?.message||error)}),{status:502,headers:{...cors,'content-type':'application/json; charset=utf-8'}})
 }
})
