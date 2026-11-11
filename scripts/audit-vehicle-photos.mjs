import {vehicleCatalog} from '../src/vehicle-catalog.js'
import {photoCoverage} from '../src/vehicle-photo-model.mjs'
import {vehiclePhotoInventory,vehiclePhotoInventorySummary} from '../src/vehicle-photo-inventory.mjs'
const coverage=photoCoverage(vehicleCatalog),summary=vehiclePhotoInventorySummary
console.log('AutoLogika — audyt zdjęć modeli i generacji (rocznik po roczniku)')
console.log('Modele z katalogu:',coverage.total)
console.log('Modele z co najmniej jednym zdjęciem:',coverage.covered)
console.log('Modele bez zdjęcia:',coverage.missing)
console.log('Fotografie:',summary.referencedImages)
console.log('Zdefiniowane generacje:',summary.generationCount)
console.log('Generacje z fotografią w co najmniej jednym roku:',summary.generationWithPhotos)
console.log('Generacje z fotografią we wszystkich latach katalogu:',summary.generationFullyCovered)
console.log('Generacje ze zdjęciami tylko w części lat:',summary.generationPartial)
console.log('Generacje bez dopasowania w żadnym roku:',summary.generationMissing)
console.log('Uwaga: zgodność lat nie gwarantuje pokrycia każdego typu nadwozia.')
console.log('\nBrakujące modele:')
for(const item of coverage.missingModels)console.log(' - '+item.make+' '+item.model)
console.log('\nLuki szczegółowych generacji:')
for(const model of vehiclePhotoInventory)for(const g of model.generations.filter(g=>g.status!=='covered'))
 console.log(' - '+model.make+' '+model.model+' '+g.generation+
  ': '+(g.status==='missing'?'brak zdjęcia':'brakuje roczników '+g.missingYears.join(',')))
