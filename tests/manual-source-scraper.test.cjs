const test=require('node:test')
const assert=require('node:assert/strict')
const {parseDuckDuckGoResults,parseBingRss,parseArchiveResults,parseWorkshopManualResults,parseProCarSearchResults,parseProCarDetail,normalizeEngines,normalizeRequest,resultScore,dedupeResults,searchTechnicalManuals,platformsCompatible}=require('../electron/manual-source-scraper.cjs')

test('parses search metadata without copying remote manual contents',()=>{
 const html=`<a rel="nofollow" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fgolf-bkc.pdf" class="result-link">Volkswagen Golf BKC workshop manual PDF</a><td class="result-snippet">Repair and service instructions for 2007 1.9 TDI</td>`
 const result=parseDuckDuckGoResults(html)
 assert.equal(result.length,1)
 assert.equal(result[0].url,'https://example.com/golf-bkc.pdf')
 assert.match(result[0].title,/BKC workshop manual/)
})

test('parses Bing RSS and Internet Archive metadata',()=>{
 const rss='<rss><channel><item><title>Ford Focus service manual</title><link>https://ford.example/manual</link><description>Workshop repair 2012</description></item></channel></rss>'
 assert.equal(parseBingRss(rss)[0].provider,'Bing RSS')
 const archive=parseArchiveResults({response:{docs:[{identifier:'vw-manual',title:'VW repair manual',creator:'Volkswagen'}]}})
 assert.equal(archive[0].url,'https://archive.org/details/vw-manual')
})

test('splits slash-separated engine codes into stable engine groups',()=>{
 const engines=normalizeEngines([{engine:'1.9 TDI',engine_code:'BKC/BLS/BXE',power_hp:105},{engine:'1.9 TDI',engine_code:'BKC',power_hp:105}])
 assert.deepEqual(engines.map(row=>row.engine_code),['BKC','BLS','BXE'])
 assert.equal(normalizeRequest({make:'Volkswagen',model:'Golf',year:2007,engines}).year,2007)
})

test('ranks exact vehicle and engine manual above an unrelated result',()=>{
 const request={make:'Volkswagen',model:'Golf',year:2007},engine={engine:'1.9 TDI',engine_code:'BKC'}
 const exact=resultScore({title:'Volkswagen Golf 2007 BKC workshop repair manual',snippet:'1.9 TDI service',url:'https://example.com/manual.pdf'},request,engine)
 const unrelated=resultScore({title:'BMW brochure',snippet:'sales',url:'https://example.com/brochure'},request,engine)
 assert.ok(exact>=20)
 assert.ok(exact>unrelated)
})

test('rejects suspicious domains even when their title imitates a workshop manual',()=>{
 const rows=dedupeResults([{title:'Volkswagen BKC workshop manual',url:'https://sexymasseur.example/bkc.pdf',engine_key:'ALL',relevance:30}])
 assert.equal(rows.length,0)
})

test('rejects a manual for a conflicting vehicle generation',()=>{
 assert.equal(platformsCompatible('BMW 3 Series E90 320d workshop manual',[{generation:'F30'}]),false)
 assert.equal(platformsCompatible('2007 Volkswagen Golf VI factory repair manual',[{generation:'V'}]),false)
 assert.equal(platformsCompatible('Volkswagen Golf V 1.9 TDI workshop manual',[{generation:'V'}]),true)
 const request=normalizeRequest({make:'BMW',model:'3 Series',year:2012,engines:[{engine:'2.0 diesel',engine_code:'N47D20',generation:'F30'}]})
 const html='<a href="https://workshop-manuals.com/bmw/3_series_e90/320d_n47/">BMW 3 Series E90 320d N47 workshop manual</a>'
 assert.equal(parseWorkshopManualResults(html,request).length,0)
})

test('rejects an archived manual whose title covers a different year range',()=>{
 const rows=dedupeResults([{title:'1997-2003 Volkswagen Golf Repair Manual',snippet:'Factory workshop manual',url:'https://archive.org/details/golf-1997-2003',domain:'archive.org',source_kind:'ARCHIVE',engine_key:'ALL',make:'Volkswagen',model:'Golf',year:2007,request_generation:'V',matched_engine:false,relevance:30}])
 assert.equal(rows.length,0)
})

test('extracts an exact engine manual from a public manual catalogue detail',()=>{
 const search='<h2><a href="https://procarmanuals.com/vw-4-cylinder-diesel-engine-unit-injector-workshop-manual/?ref=search">VW 4-cylinder diesel engine unit injector workshop manual</a></h2>'
 const candidates=parseProCarSearchResults(search)
 assert.equal(candidates.length,1)
 const request=normalizeRequest({make:'Volkswagen',model:'Golf',year:2007,engines:[{engine:'1.9 TDI',engine_code:'BKC',generation:'V'}]})
 const detail='<main><h1>VW 4-cylinder diesel engine workshop manual</h1><p>Volkswagen Golf V applications: BKC, BLS, BXE. Service and repair procedures.</p></main>'
 const rows=parseProCarDetail(detail,candidates[0],request)
 assert.equal(rows.length,1)
 assert.equal(rows[0].engine_code,'BKC')
 assert.equal(rows[0].match_level,'ENGINE')
})

test('online search groups results by engine and includes the official OEM portal',async()=>{
 const ddg=engine=>`<a href="//duckduckgo.com/l/?uddg=${encodeURIComponent(`https://manual.example/${engine}.pdf`)}" class="result-link">Volkswagen Touran 2008 ${engine} workshop repair manual</a><td class="result-snippet">Service instructions PDF</td>`
 const fetchImpl=async url=>{
  if(url.includes('archive.org'))return{ok:true,json:async()=>({response:{docs:[]}})}
  const query=decodeURIComponent(url.split('q=')[1]||''),engine=query.includes('AVQ')?'AVQ':'general'
  return{ok:true,text:async()=>ddg(engine)}
 }
 const result=await searchTechnicalManuals(fetchImpl,{make:'Volkswagen',model:'Touran',year:2008,engines:[{engine:'1.9 TDI',engine_code:'AVQ'}]})
 assert.ok(result.results.some(row=>row.source_kind==='OEM_PORTAL'))
 assert.ok(result.groups.some(group=>group.engine_code==='AVQ'&&group.results.length))
})
