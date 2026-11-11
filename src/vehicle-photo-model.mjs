import {verifiedVehiclePhotos} from './vehicle-photo-manifest.mjs'
import {detailedVehicleCatalog} from './vehicle-catalog.js'

export const normalizeVehicleText=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const norm=normalizeVehicleText
export const isPhotoLicenseAllowed=value=>/^(?:CC BY(?:-SA)?(?: [0-9]+(?:\.[0-9]+)?)?(?: DE)?|CC0(?: [0-9]+(?:\.[0-9]+)?)?|Public domain|PD(?:-[A-Za-z0-9-]+)?)$/i.test(String(value||'').replace(/<[^>]+>/g,'').trim())
export const vehiclePhotoKey=v=>[v?.make,v?.model,v?.generation,v?.year,v?.bodyType||v?.body_type||v?.body_style].map(norm).join('|')
const validYear=value=>String(value??'').trim()!==''&&Number.isInteger(Number(value))&&Number(value)>=1900&&Number(value)<=2100
function matchingGenerationForYear(make,model,year){
 const known=Object.entries(detailedVehicleCatalog).find(([name])=>norm(name)===norm(make))?.[1]
 const generations=Object.entries(known||{}).find(([name])=>norm(name)===norm(model))?.[1]||[]
 return generations.filter(item=>Number(item.from)<=year&&Number(item.to)>=year)
}
export function resolveVerifiedVehiclePhoto(vehicle,records=verifiedVehiclePhotos){
 if(!vehicle?.make||!vehicle?.model||!validYear(vehicle?.year))return null
 const year=Number(vehicle.year),generation=norm(vehicle.generation)
 const candidates=records.filter(p=>norm(p.make)===norm(vehicle.make)&&norm(p.model)===norm(vehicle.model)
  &&isPhotoLicenseAllowed(p.license)&&p.file&&p.source&&p.author
  &&Number.isInteger(p.from)&&Number.isInteger(p.to)&&year>=p.from&&year<=p.to)
 const knownForYear=matchingGenerationForYear(vehicle.make,vehicle.model,year)
 const requestedBody=norm(vehicle.bodyType||vehicle.body_type||vehicle.body_style||'')
 const bodyAliases={estate:'wagon',combi:'wagon',kombi:'wagon',touring:'wagon',sedan:'sedan',limousine:'sedan',hatch:'hatchback',hatchback:'hatchback',suv:'suv',mpv:'mpv',van:'mpv'}
 const canonicalBody=value=>bodyAliases[norm(value)]||norm(value)
 const compatible=candidates.filter(p=>{
  if(requestedBody&&(!p.bodyType||canonicalBody(requestedBody)!==canonicalBody(p.bodyType)))return false
  if(generation){
   // Do not present a generation-specific image for a different generation.
   return !p.generation||norm(p.generation)===generation
  }
  // Unknown generation: refuse a photo when model-year overlaps generations.
  if(knownForYear.length>1)return false
  if(knownForYear.length===1&&p.generation&&norm(p.generation)!==norm(knownForYear[0].generation))return false
  return true
 })
 compatible.sort((a,b)=>Number(Boolean(b.generation))-Number(Boolean(a.generation))||(a.to-a.from)-(b.to-b.from))
 const photo=compatible[0]
 return photo?{...photo,src:'https://commons.wikimedia.org/wiki/Special:FilePath/'+encodeURIComponent(photo.file)}:null
}
export function photoCoverage(catalog,records=verifiedVehiclePhotos){
 const covered=[],missing=[]
 for(const [make,models] of Object.entries(catalog))for(const model of Object.keys(models)){
  const count=records.filter(p=>norm(p.make)===norm(make)&&norm(p.model)===norm(model)).length
  ;(count?covered:missing).push({make,model,count})
 }
 return {total:covered.length+missing.length,covered:covered.length,missing:missing.length,missingModels:missing}
}
