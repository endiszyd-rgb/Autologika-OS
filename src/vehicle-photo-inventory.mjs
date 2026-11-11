// Complete catalog inventory. A model with a reference photo is NOT necessarily
// covered for every generation, year and body variant.
import {vehicleCatalog,detailedVehicleCatalog} from './vehicle-catalog.js'
import {verifiedVehiclePhotos} from './vehicle-photo-manifest.mjs'
import {normalizeVehicleText as norm,resolveVerifiedVehiclePhoto} from './vehicle-photo-model.mjs'

const yearsForGeneration=(from,to)=>Array.from(
 {length:Math.max(0,Math.min(2100,Number(to))-Math.max(1900,Number(from))+1)},
 (_,i)=>Math.max(1900,Number(from))+i
)
const generationStatus=({make,model,generation,from,to})=>{
 const years=yearsForGeneration(from,to)
 const matchedYears=years.filter(year=>{
  const candidates=verifiedVehiclePhotos.filter(p=>norm(p.make)===norm(make)&&norm(p.model)===norm(model)&&
   Number(p.from)<=year&&Number(p.to)>=year)
  const knownBodies=[...new Set(candidates.map(p=>p.bodyType).filter(Boolean))]
  // A photo exists for this generation/year if at least ONE known body can
  // resolve. This does not imply coverage of all possible body types.
  return [undefined,...knownBodies].some(bodyType=>Boolean(resolveVerifiedVehiclePhoto({make,model,generation,year,bodyType})))
 })
 const photoCount=verifiedVehiclePhotos.filter(photo=>
  norm(photo.make)===norm(make)&&norm(photo.model)===norm(model)&&
  (!photo.generation||norm(photo.generation)===norm(generation))&&
  Number(photo.from)<=Number(to)&&Number(photo.to)>=Number(from)
 ).length
 return {generation,from,to,photoCount,matchedYearCount:matchedYears.length,
  yearCount:years.length,missingYears:years.filter(year=>!matchedYears.includes(year)),
  status:!matchedYears.length?'missing':matchedYears.length===years.length?'covered':'partial'}
}
export const vehiclePhotoInventory=Object.entries(vehicleCatalog).flatMap(([make,models])=>
 Object.keys(models).map(model=>{
  const photos=verifiedVehiclePhotos.filter(p=>norm(p.make)===norm(make)&&norm(p.model)===norm(model))
  const generations=(detailedVehicleCatalog[make]?.[model]||[]).map(row=>generationStatus({make,model,...row}))
  return {
   key:`${make}::${model}`,make,model,
   status:photos.length?'partial':'missing',photoCount:photos.length,
   photoSources:photos.map(p=>p.source),
   generationCount:generations.length,generations
  }
 }))
export const vehiclePhotoInventorySummary={
 total:vehiclePhotoInventory.length,
 withPhotos:vehiclePhotoInventory.filter(item=>item.photoCount).length,
 withoutPhotos:vehiclePhotoInventory.filter(item=>!item.photoCount).length,
 referencedImages:verifiedVehiclePhotos.length,
 generationCount:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generationCount,0),
 generationWithPhotos:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generations.filter(g=>g.matchedYearCount>0).length,0),
 generationFullyCovered:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generations.filter(g=>g.status==='covered').length,0),
 generationPartial:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generations.filter(g=>g.status==='partial').length,0),
 generationMissing:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generations.filter(g=>g.status==='missing').length,0)
}
