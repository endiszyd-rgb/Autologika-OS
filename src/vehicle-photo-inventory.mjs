// AutoLogika model photo coverage: every catalog make/model has an inventory row.
// This is a complete INDEX, not a claim that all models have verified photos.
import {vehicleCatalog,detailedVehicleCatalog} from './vehicle-catalog.js'
import {verifiedVehiclePhotos} from './vehicle-photo-manifest.mjs'
import {normalizeVehicleText as norm} from './vehicle-photo-model.mjs'

export const vehiclePhotoInventory=Object.entries(vehicleCatalog).flatMap(([make,models])=>
 Object.keys(models).map(model=>{
  const photos=verifiedVehiclePhotos.filter(photo=>norm(photo.make)===norm(make)&&norm(photo.model)===norm(model))
  const generations=detailedVehicleCatalog[make]?.[model]||[]
  return {
   key:`${make}::${model}`,
   make,model,
   status:photos.length?'partial':'missing',
   photoCount:photos.length,
   photoSources:photos.map(photo=>photo.source),
   generationCount:generations.length,
   generations:generations.map(generation=>({
    generation:generation.generation,from:generation.from,to:generation.to,
    photoCount:photos.filter(photo=>
     norm(photo.generation)===norm(generation.generation) &&
     photo.from<=generation.to&&photo.to>=generation.from
    ).length
   }))
  }
 }))
export const vehiclePhotoInventorySummary={
 total:vehiclePhotoInventory.length,
 withPhotos:vehiclePhotoInventory.filter(item=>item.photoCount).length,
 withoutPhotos:vehiclePhotoInventory.filter(item=>!item.photoCount).length,
 referencedImages:verifiedVehiclePhotos.length,
 generationCount:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generationCount,0),
 generationWithPhotos:vehiclePhotoInventory.reduce((sum,item)=>sum+item.generations.filter(g=>g.photoCount>0).length,0)
}
