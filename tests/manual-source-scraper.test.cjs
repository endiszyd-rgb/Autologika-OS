const test=require('node:test')
const assert=require('node:assert/strict')
const {parseDuckDuckGoResults,parseBingRss,parseArchiveResults,normalizeEngines,normalizeRequest,resultScore,dedupeResults,searchTechnicalManuals}=require('../electron/manual-source-scraper.cjs')

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
