import {vehicleCatalog,detailedVehicleCatalog} from '../src/vehicle-catalog.js'
import {photoCoverage,resolveVerifiedVehiclePhoto} from '../src/vehicle-photo-model.mjs'
const coverage=photoCoverage(vehicleCatalog)
const generations=Object.entries(detailedVehicleCatalog).flatMap(([make,models])=>Object.entries(models).flatMap(([model,rows])=>rows.map(({generation,from,to})=>({make,model,generation,from,to}))))
const generationCovered=generations.filter(({make,model,generation,from,to})=>resolveVerifiedVehiclePhoto({make,model,generation,year:Math.ceil((from+to)/2)}))
console.log('AutoLogika - weryfikacja biblioteki fotografii')
console.log('Modele z katalogu:',coverage.total)
console.log('Modele z co najmniej jednym zdjęciem:',coverage.covered)
console.log('Modele bez zdjęcia:',coverage.missing)
console.log('Zdefiniowane generacje:',generations.length)
console.log('Generacje z dopasowaną fotografią:',generationCovered.length)
console.log('UWAGA: pokrycie modelu nie oznacza pokrycia wszystkich generacji.')
console.log('\nBrakujące modele:')
for(const item of coverage.missingModels)console.log(' - '+item.make+' '+item.model)
