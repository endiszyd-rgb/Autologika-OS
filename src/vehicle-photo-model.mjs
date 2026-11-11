import {verifiedVehiclePhotos} from './vehicle-photo-manifest.mjs'
export const normalizeVehicleText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const norm=normalizeVehicleText
export const isPhotoLicenseAllowed=value=>/^(CC BY(?:-SA)?(?: [0-9.]+)?|CC0(?: [0-9.]+)?|Public domain|PD(?:-|$))/i.test(String(value||'').replace(/<[^>]+>/g,'').trim())
export const vehiclePhotoKey=v=>[v?.make,v?.model,v?.generation,v?.year].map(norm).join('|')
const matchesGeneration=(requested,record)=>!requested||norm(requested)===norm(record||'')
export function resolveVerifiedVehiclePhoto(vehicle,records=verifiedVehiclePhotos){
 if(!vehicle?.make||!vehicle?.model)return null
 const year=Number(vehicle.year)
 const generation=norm(vehicle.generation)
 // A year is mandatory: facelift-only photographs must not represent an unknown model year.
 if(!Number.isInteger(year)||year<1900||year>2100)return null
 const candidates=records.filter(p=>norm(p.make)===norm(vehicle.make)&&norm(p.model)===norm(vehicle.model)&&isPhotoLicenseAllowed(p.license)&&p.file&&p.source&&p.author)
  .filter(p=>{
   if(generation){if(!matchesGeneration(vehicle.generation,p.generation))return false}
   else if(!Number.isInteger(year)||year<1900||year>2100)return false
   if(Number.isInteger(year)&&year>=1900&&year<=2100 && (year<p.from||year>p.to))return false
   // Don't use an undated photo to infer a generation.
   return Boolean(p.from&&p.to)
  })
 // More specific generation + smaller year intervals win.
 candidates.sort((a,b)=>Number(Boolean(b.generation))-Number(Boolean(a.generation))||(a.to-a.from)-(b.to-b.from))
 if(!candidates.length)return null
 const photo=candidates[0]
 return {...photo,src:'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(photo.file)}
}
export function photoCoverage(catalog,records=verifiedVehiclePhotos){
 const missing=[],covered=[]
 for(const [make,models] of Object.entries(catalog))for(const model of Object.keys(models)){
  const count=records.filter(p=>norm(p.make)===norm(make)&&norm(p.model)===norm(model)).length
  ;(count?covered:missing).push({make,model,count})
 }
 return {total:covered.length+missing.length,covered:covered.length,missing:missing.length,missingModels:missing}
}
