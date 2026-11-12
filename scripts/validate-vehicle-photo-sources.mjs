// Checks ACTUAL Wikimedia file existence and license metadata in batches.
// Output is a review report; unavailable Commons API must not be mistaken for a missing file.
// Run: node scripts/validate-vehicle-photo-sources.mjs [output.json]
import {writeFile} from 'node:fs/promises'
import {verifiedVehiclePhotos} from '../src/vehicle-photo-manifest.mjs'
import {normalizeVehicleText} from '../src/vehicle-photo-model.mjs'
const dest=process.argv[2]||'vehicle-photo-source-audit.json'
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const clean=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').trim()
const canonical=s=>normalizeVehicleText(s).replace(/ /g,'')
const canonicalLicense=s=>{
 const value=canonical(s)
 if(value==='cc0'||value==='cc010')return 'cc0'
 if(value==='publicdomain'||value.startsWith('pd-'))return 'publicdomain'
 return value
}
const batches=[]
for(let i=0;i<verifiedVehiclePhotos.length;i+=30)batches.push(verifiedVehiclePhotos.slice(i,i+30))
async function fetchBatch(batch){
 const query=new URL('https://commons.wikimedia.org/w/api.php')
 query.search=new URLSearchParams({
  action:'query',format:'json',redirects:'1',
  titles:batch.map(p=>'File:'+p.file).join('|'),
  prop:'imageinfo',iiprop:'url|extmetadata',formatversion:'2'
 }).toString()
 for(let attempt=0;attempt<4;attempt++){
  const controller=new AbortController()
  const timeout=setTimeout(()=>controller.abort(),25000)
  try{
   const res=await fetch(query,{signal:controller.signal,headers:{'User-Agent':'AutoLogikaVehicleSourceAudit/1.0 (metadata check)'}})
   if(!res.ok)throw Error('HTTP '+res.status)
   return await res.json()
  }catch(error){
   if(attempt===3)return {apiError:String(error.message||error)}
   await sleep(3000*Math.pow(2,attempt))
  }finally{clearTimeout(timeout)}
 }
}
const rows=[]
for(let i=0;i<batches.length;i++){
 const batch=batches[i],result=await fetchBatch(batch)
 if(result.apiError){
  for(const p of batch)rows.push({make:p.make,model:p.model,file:p.file,status:'unavailable',issue:result.apiError})
  continue
 }
 const pages=result.query?.pages||[]
 const redirects=new Map((result.query?.redirects||[]).map(x=>[canonical(x.from),canonical(x.to)]))
 const normalized=new Map(pages.map(page=>[canonical(page.title),page]))
 for(const p of batch){
  const lookup='File:'+p.file
  const resolved=redirects.get(canonical(lookup))||canonical(lookup)
  const page=normalized.get(resolved)
  if(!page||page.missing){
   rows.push({make:p.make,model:p.model,file:p.file,status:'missing',issue:'No file page'})
   continue
  }
  const info=page.imageinfo?.[0],metadata=info?.extmetadata||{}
  const observedLicense=clean(metadata.LicenseShortName?.value)
  const observedArtist=clean(metadata.Artist?.value)
  const matchedLicense=canonicalLicense(observedLicense)===canonicalLicense(p.license)
  const issues=[]
  if(!info?.url)issues.push('No image URL')
  if(!matchedLicense)issues.push('License mismatch: manifest '+p.license+' / Commons '+observedLicense)
  if(!observedArtist)issues.push('Missing Commons author metadata')
  rows.push({
   make:p.make,model:p.model,file:p.file,status:issues.length?'review':'ok',
   license:p.license,observedLicense,author:p.author,observedArtist,
   commonsUrl:info?.descriptionurl||p.source,issues
  })
 }
 console.log('Source audit batch '+(i+1)+'/'+batches.length+' done')
 await sleep(1600)
}
const summary={
 total:rows.length,ok:rows.filter(x=>x.status==='ok').length,
 review:rows.filter(x=>x.status==='review').length,
 missing:rows.filter(x=>x.status==='missing').length,
 unavailable:rows.filter(x=>x.status==='unavailable').length
}
await writeFile(dest,JSON.stringify({generatedAt:new Date().toISOString(),summary,rows},null,2))
console.log('Source audit complete:',JSON.stringify(summary))
for(const r of rows.filter(r=>r.status!=='ok'))console.log('PHOTO AUDIT',r.status,r.make,r.model,r.file,(r.issues||[]).join('; ')||r.issue)
