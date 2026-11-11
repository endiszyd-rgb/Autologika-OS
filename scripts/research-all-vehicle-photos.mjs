// Research candidates for EVERY missing model without claiming that candidates are verified.
// Run: node scripts/research-all-vehicle-photos.mjs [output.json] [limit]
// A human must check identity, generation, body and license before promoting any result.
import {writeFile} from 'node:fs/promises'
import {vehiclePhotoInventory,vehiclePhotoInventorySummary} from '../src/vehicle-photo-inventory.mjs'
import {isPhotoLicenseAllowed,normalizeVehicleText} from '../src/vehicle-photo-model.mjs'

const destination=process.argv[2]||'vehicle-photo-candidates.json'
const cap=Math.max(1,Math.min(171,Number(process.argv[3])||171))
const pending=vehiclePhotoInventory.filter(item=>item.status==='missing').slice(0,cap)
const clean=value=>String(value||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim()
const tokens=value=>normalizeVehicleText(value).split(/\s+/).filter(Boolean)
const exactTokens=(title,text)=>tokens(text).every(token=>tokens(title).includes(token))
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function queryCommons(item){
 const uri=new URL('https://commons.wikimedia.org/w/api.php')
 uri.search=new URLSearchParams({
  action:'query',format:'json',generator:'search',
  gsrsearch:'filetype:bitmap '+item.make+' '+item.model+' automobile',
  gsrnamespace:'6',gsrlimit:'24',prop:'imageinfo',
  iiprop:'url|extmetadata|size',iiurlwidth:'420'
 }).toString()
 for(let attempt=0;attempt<3;attempt++){
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),15000)
  try{
   const response=await fetch(uri,{headers:{'User-Agent':'AutoLogikaVehicleCuration/1.0 (manual validation)'},signal:controller.signal})
   if(!response.ok)throw new Error('Commons HTTP '+response.status)
   const payload=await response.json()
   const raw=Object.values(payload.query?.pages||{})
   const candidates=raw.map(page=>{
    const info=page.imageinfo?.[0]||{},meta=info.extmetadata||{}
    const license=clean(meta.LicenseShortName?.value)
    const file=String(page.title||'').replace(/^File:/,'')
    const nameMatches=exactTokens(file,item.make)&&exactTokens(file,item.model)
    return {
     file,source:info.descriptionurl||'',thumbnail:info.thumburl||'',
     author:clean(meta.Artist?.value),license,licenseUrl:clean(meta.LicenseUrl?.value),
     description:clean(meta.ImageDescription?.value).slice(0,500),
     pixels:info.width&&info.height?`${info.width}x${info.height}`:'',
     titleMatchesMakeModel:nameMatches,licensePossiblyReusable:isPhotoLicenseAllowed(license),
     reviewStatus:'unverified',
     reviewerGeneration:null,reviewerFrom:null,reviewerTo:null,reviewerBodyType:null,
     warning:'DO NOT publish automatically. Confirm photo visually and verify rights.'
    }
   }).filter(candidate=>candidate.source&&candidate.thumbnail&&candidate.titleMatchesMakeModel&&candidate.licensePossiblyReusable)
   return {make:item.make,model:item.model,status:'researched',candidates:candidates.slice(0,12)}
  }catch(error){
   if(attempt===2)return {make:item.make,model:item.model,status:'error',error:String(error.message||error),candidates:[]}
   await sleep(900*(attempt+1))
  }finally{clearTimeout(timeout)}
 }
}
const records=Array(pending.length)
let cursor=0
async function worker(){
 for(;;){
  const i=cursor++
  if(i>=pending.length)return
  records[i]=await queryCommons(pending[i])
  if(i%10===0)console.log('Photo research:',i+1,'/',pending.length)
  await sleep(300)
 }
}
await Promise.all(Array.from({length:3},worker))
const report={
 generatedAt:new Date().toISOString(),
 catalog:vehiclePhotoInventorySummary,
 attempted:pending.length,
 modelsWithCandidate:records.filter(r=>r.candidates.length).length,
 modelsWithNoCandidate:records.filter(r=>r.status==='researched'&&!r.candidates.length).length,
 errors:records.filter(r=>r.status==='error').length,
 verifiedNewPhotos:0,
 disclaimer:'Every candidate is unverified; none are promoted into the production photo manifest.',
 records
}
await writeFile(destination,JSON.stringify(report,null,2),'utf8')
console.log('Saved candidate research:',destination)
console.log('Models with candidates:',report.modelsWithCandidate,'/ '+pending.length,'; errors:',report.errors)
