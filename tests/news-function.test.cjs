const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {pathToFileURL}=require('node:url')
const {render,target}=require('../scripts/build-news-function.cjs')
const news=require('../shared/news-feed.cjs')

test('server news function uses the current shared parser (run node scripts/build-news-function.cjs after edits)',()=>{
 assert.equal(fs.readFileSync(target,'utf8').replace(/\r\n/g,'\n'),render())
})

test('generated module exposes the same API as the shared parser',async()=>{
 const generated=await import(pathToFileURL(target).href)
 assert.equal(typeof generated.getNewsFeed,'function')
 const rss='<rss><channel><item><title>Nowe przepisy &amp; opłaty</title><link>https://example.com/a</link><description>&lt;p&gt;Treść&lt;/p&gt;</description></item></channel></rss>'
 assert.deepEqual(generated.parseRss(rss,{id:'t',source:'T'}),news.parseRss(rss,{id:'t',source:'T'}))
})

test('server function only fetches the fixed feed list and requires a signed-in user',()=>{
 const source=fs.readFileSync(path.join(__dirname,'..','supabase','functions','news','index.ts'),'utf8')
 assert.doesNotMatch(source,/searchParams\.get\(['"](url|feed|src)['"]\)/)
 assert.match(fs.readFileSync(path.join(__dirname,'..','supabase','config.toml'),'utf8'),/\[functions\.news\]\s*\nverify_jwt = true/)
})

test('getNewsFeed accepts a fetchAll source and still caches it',async()=>{
 let calls=0,stored=null
 const fetchAll=async({now})=>{calls++;return{items:[{title:'A',url:'https://example.com/a',source:'S'}],rates:[],refreshedAt:now().toISOString(),sources:['S'],errors:[]}}
 const io={fetchAll,readCache:()=>stored,writeCache:value=>{stored=value}}
 const first=await news.getNewsFeed({...io,now:()=>new Date('2026-11-16T10:00:00Z')})
 assert.equal(first.items.length,1);assert.equal(first.cached,false)
 const second=await news.getNewsFeed({...io,now:()=>new Date('2026-11-16T10:20:00Z')})
 assert.equal(second.cached,true);assert.equal(calls,1)
})
