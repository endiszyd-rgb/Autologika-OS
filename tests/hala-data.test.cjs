const test=require('node:test')
const assert=require('node:assert/strict')
const hala=require('../shared/hala-settings.cjs')
const news=require('../shared/news-feed.cjs')

test('hala settings are normalized, capped and keep assignments by cloud id',()=>{
 assert.deepEqual(hala.normalizeHalaSettings(),{greetingName:'',workshopName:'',accent:'#F43F5E',assignments:{}})
 const value=hala.normalizeHalaSettings({greetingName:'  Endi  ',workshopName:'x'.repeat(90),accent:'#3ee0c8',assignments:{'Stanowisko 1':{orderCloudId:'c-1',orderId:7},'':{orderCloudId:'c-2'},'Zła':{}}})
 assert.equal(value.greetingName,'Endi')
 assert.equal(value.workshopName.length,60)
 assert.equal(value.accent,'#3EE0C8')
 assert.deepEqual(Object.keys(value.assignments),['Stanowisko 1'])
 assert.equal(value.assignments['Stanowisko 1'].orderId,'7')
 assert.equal(hala.normalizeHalaSettings({accent:'red'}).accent,'#F43F5E','tylko kolory z makiety')
 assert.deepEqual(hala.parseHalaSettings('{zepsuty'),hala.normalizeHalaSettings())
})

test('assignBay sets and clears one bay without touching the rest',()=>{
 const start=hala.normalizeHalaSettings({greetingName:'Endi',assignments:{B:{orderCloudId:'c-9'}}})
 const assigned=hala.assignBay(start,'A',{id:5,cloud_id:'c-5'})
 assert.equal(assigned.assignments.A.orderCloudId,'c-5')
 assert.equal(assigned.assignments.A.orderId,'5')
 assert.equal(assigned.assignments.B.orderCloudId,'c-9')
 assert.equal(assigned.greetingName,'Endi')
 const cleared=hala.assignBay(assigned,'A',null)
 assert.equal(cleared.assignments.A,undefined)
 assert.ok(hala.sameOrder({orderCloudId:'c-5',orderId:'5'},{id:5,cloud_id:'c-5'}))
 assert.ok(!hala.sameOrder({orderCloudId:'c-5',orderId:'5'},{id:5,cloud_id:'inne'}),'lokalne id z innego komputera nie wystarcza')
 assert.ok(hala.sameOrder({orderCloudId:'',orderId:'5'},{id:5}))
})

const RSS=`<?xml version="1.0"?><rss><channel><title>T</title>
<item><title><![CDATA[Nowy taryfikator mandatów od 21 listopada]]></title><link>https://motofakty.pl/a</link><pubDate>Fri, 13 Nov 2026 10:00:00 +0100</pubDate><description><![CDATA[<p>Kierowcy stracą prawo jazdy &#8211; szczegóły.</p>]]></description></item>
<item><title>Konkurs Hella &#8211; wyniki</title><link>https://motofocus.pl/b</link><pubDate>Sat, 14 Nov 2026 12:00:00 +0000</pubDate><category><![CDATA[Producenci części i dystrybutorzy]]></category><description><![CDATA[<p>Wyniki.</p><p>Artykuł <a href="x">Konkurs</a> pochodzi z serwisu MotoFocus.</p>]]></description></item>
<item><title>Bez linku</title></item>
<item><title><![CDATA[<script>alert(1)</script>Stage 2 i 400 KM]]></title><link>javascript:alert(1)</link></item>
<item><title>Remap Stage 1 dla TDI</title><link>https://autogaleria.pl/c</link></item>
</channel></rss>`

test('RSS parser keeps plain text only, safe links and a category',()=>{
 const items=news.parseRss(RSS,{id:'test',source:'Test'})
 assert.equal(items.length,3,'bez linku i z linkiem javascript: odrzucone')
 assert.equal(items[0].title,'Nowy taryfikator mandatów od 21 listopada')
 assert.equal(items[0].category,'PRZEPISY')
 assert.equal(items[0].lead,'Kierowcy stracą prawo jazdy – szczegóły.')
 assert.equal(items[0].publishedAt,'2026-11-13T09:00:00.000Z')
 assert.equal(items[1].title,'Konkurs Hella – wyniki')
 assert.equal(items[1].lead,'Wyniki.','stopka WordPressa usunięta')
 assert.equal(items[1].category,'CZESCI')
 assert.equal(items[2].category,'TUNING')
 assert.ok(items.every(item=>!/[<>]/.test(item.title+item.lead)))
 assert.equal(news.decodeEntities('&amp;&#x41;&bogus;'),'&A&bogus;')
})

test('NBP rates are parsed and invalid payloads ignored',()=>{
 assert.deepEqual(news.parseNbp({code:'EUR',rates:[{effectiveDate:'2026-11-13',mid:4.407}]},'EUR'),{code:'EUR',mid:4.407,date:'2026-11-13'})
 assert.equal(news.parseNbp({rates:[]},'USD'),null)
 assert.equal(news.nbpUrl('EUR'),'https://api.nbp.pl/api/exchangerates/rates/a/eur/?format=json')
})

test('news feed caches for one hour and falls back to the last download offline',async()=>{
 let store=null,calls=0
 const io={readCache:async()=>store,writeCache:async value=>{store=value},fetchText:async()=>{calls++;return RSS},fetchJson:async url=>({code:url.includes('eur')?'EUR':'USD',rates:[{effectiveDate:'2026-11-13',mid:4}]})}
 const t0=new Date('2026-11-14T10:00:00Z')
 const first=await news.getNewsFeed({...io,now:()=>t0,feeds:[{id:'a',source:'A',url:'u'}]})
 assert.equal(first.cached,false)
 assert.equal(first.items.length,3)
 assert.equal(first.rates.length,2)
 assert.deepEqual(first.sources,['A'])
 const second=await news.getNewsFeed({...io,now:()=>new Date('2026-11-14T10:30:00Z'),feeds:[{id:'a',source:'A',url:'u'}]})
 assert.equal(second.cached,true)
 assert.equal(calls,1,'w ciągu godziny bez pobierania')
 const offline=await news.getNewsFeed({...io,fetchText:async()=>{throw new Error('offline')},fetchJson:async()=>{throw new Error('offline')},now:()=>new Date('2026-11-14T12:00:00Z'),feeds:[{id:'a',source:'A',url:'u'}]})
 assert.equal(offline.stale,true)
 assert.equal(offline.items.length,3,'ostatnie pobrane')
 assert.equal(offline.errors.length,3)
 const forced=await news.getNewsFeed({...io,force:true,now:()=>new Date('2026-11-14T10:31:00Z'),feeds:[{id:'a',source:'A',url:'u'}]})
 assert.equal(forced.cached,false)
 assert.equal(calls,2)
 const partial=await news.getNewsFeed({...io,force:true,fetchText:async()=>{throw new Error('RSS down')},now:()=>new Date('2026-11-14T10:40:00Z'),feeds:[{id:'a',source:'A',url:'u'}]})
 assert.equal(partial.items.length,3,'RSS z cache, kursy świeże')
 const empty=await news.getNewsFeed({now:()=>t0})
 assert.deepEqual([empty.items,empty.rates,empty.stale],[[],[],true])
})

test('electron main exposes the Hala IPC channels',()=>{
 const fs=require('node:fs'),path=require('node:path')
 const main=fs.readFileSync(path.join(__dirname,'..','electron','main.cjs'),'utf8')
 for(const channel of ["'settings:getHala'","'settings:setHala'","'news:feed'"])assert.ok(main.includes(`ipcMain.handle(${channel}`),channel)
 assert.match(main,/news-feed-cache\.json/)
})

test('merged news interleave sources so a busy portal does not hide the others',()=>{
 const item=(source,hour)=>({source,title:`${source} ${hour}`,publishedAt:`2026-11-14T${String(hour).padStart(2,'0')}:00:00Z`})
 const busy=[10,11,12,13,14].map(hour=>item('Interia',hour)),quiet=[item('MotoFocus',1),item('MotoFocus',2)]
 const merged=news.mergeNews([busy,quiet],4)
 assert.deepEqual(merged.map(row=>row.title),['Interia 14','MotoFocus 2','Interia 13','MotoFocus 1'])
 assert.equal(news.mergeNews([[item('A',1),{...item('A',1)}]]).length,1,'duplikaty tytułów usunięte')
})

test('review fixes: move instead of copy, encoded HTML, unclosed items, tampered cache',async()=>{
 const moved=hala.assignBay(hala.assignBay({},'A',{id:1,cloud_id:'c-1'}),'B',{id:1,cloud_id:'c-1'})
 assert.deepEqual(Object.keys(moved.assignments),['B'],'auto przeniesione, nie skopiowane')
 assert.equal(hala.bayKey('  Stanowisko   1 '),'Stanowisko 1')
 const encoded='<rss><item><title>T</title><link>https://a.pl/x</link><description>&lt;p&gt;Lead &lt;img src="x"&gt; tekst&lt;/p&gt;</description></item></rss>'
 assert.equal(news.parseRss(encoded,{id:'a',source:'A'})[0].lead,'Lead tekst')
 const started=Date.now()
 assert.deepEqual(news.parseRss('<item>'.repeat(200000),{id:'a',source:'A'}),[])
 assert.ok(Date.now()-started<500,'uszkodzony kanał nie blokuje')
 assert.equal(news.itemBlocks('<item>1</item>'.repeat(100)).length,60)
 const cache=news.sanitizeCache({refreshedAt:'2026-11-14T10:00:00Z',items:[{title:'Zły',url:'javascript:alert(1)',source:'X'},{title:'<b>Dobry</b>',url:'https://a.pl',source:'A'}],rates:[{code:'eurx',mid:'4.4'},{code:'USD',mid:'x'}]})
 assert.deepEqual(cache.items.map(item=>item.title),['Dobry'])
 assert.deepEqual(cache.rates,[{code:'EUR',mid:4.4,date:''}])
 assert.equal(news.isFresh({refreshedAt:'2026-11-14T12:00:00Z'},new Date('2026-11-14T11:00:00Z')),false,'znacznik z przyszłości')
})
