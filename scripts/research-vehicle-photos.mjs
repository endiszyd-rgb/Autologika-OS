// Photo research only. Never automatically approve photographs based on filenames.
// Usage: node scripts/research-vehicle-photos.mjs [--limit 25] [--make Volkswagen] [--output path.json]
import {writeFile} from 'node:fs/promises'
import {vehicleCatalog} from '../src/vehicle-catalog.js'
import {photoCoverage} from '../src/vehicle-photo-model.mjs'

const args=process.argv.slice(2)
const option=(flag,otherwise)=>{const i=args.indexOf(flag);return i<0?otherwise:args[i+1]}
const limit=Math.max(1,Math.min(171,Number(option('--limit','25'))||25))
const makeFilter=option('--make','')
const output=option('--output','vehicle-photo-research.json')
const items=photoCoverage(vehicleCatalog).missingModels.filter(row=>!makeFilter||row.make.toLowerCase()===makeFilter.toLowerCase()).slice(0,limit)
function clean(html=''){return String(html).replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim()}
async function search(item){
 const endpoint=new URL('https://commons.wikimedia.org/w/api.php')
 endpoint.search=new URLSearchParams({
  action:'query',format:'json',generator:'search',gsrnamespace:'6',gsrlimit:'12',
  gsrsearch:'filetype:bitmap '+item.make+' '+item.model,
  prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'420'
 }).toString()
 try{
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),12000)
  let data
  try{
   const response=await fetch(endpoint,{signal:controller.signal,headers:{'User-Agent':'AutoLogikaOS-vehicle-photo-research/1.0 (manual-curation)'}})
   if(!response.ok)throw Error('HTTP '+response.status)
   data=await response.json()
  }finally{clearTimeout(timer)}
  const pages=Object.values(data.query?.pages||{})
  return {make:item.make,model:item.model,candidates:pages.map(page=>{
   const info=page.imageinfo?.[0]||{},meta=info.extmetadata||{}
   return {
    file:page.title?.replace(/^File:/,'')||'',
    preview:info.thumburl||'',source:info.descriptionurl||'',
    author:clean(meta.Artist?.value||''),license:clean(meta.LicenseShortName?.value||''),
    licenseUrl:meta.LicenseUrl?.value||'',
    description:clean(meta.ImageDescription?.value||''),
    reviewed:false, // NEVER auto-approve by API response
    generation:'',from:null,to:null,bodyType:'',
    reviewerNotes:'Verify body, generation, facelift, year and author before adding to manifest.'
   }
  }).filter(c=>c.preview&&c.source)}
 }catch(error){return {make:item.make,model:item.model,candidates:[],error:String(error.message||error)}}
}
const results=[]
for(const item of items){
 results.push(await search(item))
 console.log('Research:',item.make,item.model,'candidates',results.at(-1).candidates.length)
 // Keep Wikimedia requests sequential; avoid bulk parallel pressure.
}
await writeFile(output,JSON.stringify({generatedAt:new Date().toISOString(),source:'Wikimedia Commons',autoApproved:false,records:results},null,2),'utf8')
console.log('Saved '+results.length+' model research records to '+output)
console.log('All records are unverified until reviewed manually.')
