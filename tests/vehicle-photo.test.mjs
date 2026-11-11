import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveVerifiedVehiclePhoto,isPhotoLicenseAllowed,photoCoverage,vehiclePhotoKey} from '../src/vehicle-photo-model.mjs'
import {vehicleCatalog} from '../src/vehicle-catalog.js'
import {verifiedVehiclePhotos} from '../src/vehicle-photo-manifest.mjs'
import {vehiclePhotoInventory,vehiclePhotoInventorySummary} from '../src/vehicle-photo-inventory.mjs'

test('verified photo matches exact make, model and year',()=>{
 const photo=resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',year:2018,generation:'VII (5G)'})
 assert.equal(photo?.author,'Steinfeld-feld')
 assert.match(photo.src,/Special:FilePath/)
 assert.equal(photo.license,'CC BY-SA 4.0')
})
test('never show Golf VII for Golf IV or Golf VIII',()=>{
 for(const generation of ['IV (1J)','VIII (CD)'])assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',generation,year:2018}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',year:2003}),null)
})
test('strict year window prevents incorrect facelift',()=>{
 assert.equal(resolveVerifiedVehiclePhoto({make:'Ford',model:'Focus',year:2006}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'Ford',model:'Focus',year:2016}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Octavia',year:2018,generation:'III (5E)'}),null)
})
test('do not infer a generation without a year',()=>{
 assert.equal(resolveVerifiedVehiclePhoto({make:'Ford',model:'Focus'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf'}),null)
})
test('license validator only permits supported permissive/reuse licenses',()=>{
 assert.equal(isPhotoLicenseAllowed('CC BY-SA 4.0'),true)
 assert.equal(isPhotoLicenseAllowed('CC BY 3.0'),true)
 assert.equal(isPhotoLicenseAllowed('CC0 1.0'),true)
 assert.equal(isPhotoLicenseAllowed('All rights reserved'),false)
 assert.equal(isPhotoLicenseAllowed('CC BY-NC 4.0'),false)
})
test('photo identity includes generation and year',()=>{
 assert.notEqual(vehiclePhotoKey({make:'Volkswagen',model:'Golf',generation:'IV',year:2001}),vehiclePhotoKey({make:'Volkswagen',model:'Golf',generation:'VII',year:2018}))
})
test('coverage report includes every model defined in catalog',()=>{
 const coverage=photoCoverage(vehicleCatalog)
 const count=Object.values(vehicleCatalog).reduce((n,models)=>n+Object.keys(models).length,0)
 assert.equal(coverage.total,count)
 assert.ok(coverage.covered>0)
 assert.equal(coverage.covered+coverage.missing,coverage.total)
})

test('reject ambiguous overlap of generations if generation was not supplied',()=>{
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',year:2019}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',generation:'VII (5G)',year:2019}))
})
test('unknown year never silently matches the photo',()=>{
 for(const year of ['',null,'unknown',0,2101])assert.equal(resolveVerifiedVehiclePhoto({make:'BMW',model:'Seria 3',generation:'E46',year}),null)
})
test('do not infer Golf from the same name of another manufacturer',()=>{
 assert.equal(resolveVerifiedVehiclePhoto({make:'Toyota',model:'Golf',generation:'VII (5G)',year:2018}),null)
})
test('curated photo cannot show wrong generation',()=>{
 assert.equal(resolveVerifiedVehiclePhoto({make:'Audi',model:'A4',generation:'B9 (8W)',year:2014}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'Audi',model:'A4',generation:'B8 (8K)',year:2014}))
})

test('every curated image has complete attribution and a unique source',()=>{
 const seen=new Set()
 for(const item of verifiedVehiclePhotos){
  assert.ok(vehicleCatalog[item.make]?.[item.model], 'Unknown model '+item.make+' '+item.model)
  assert.ok(item.file&&item.source&&item.author&&item.license&&item.licenseUrl)
  assert.equal(isPhotoLicenseAllowed(item.license),true,'Not permitted: '+item.license)
  assert.ok(item.source.startsWith('https://commons.wikimedia.org/wiki/File:'))
  assert.ok(item.licenseUrl.startsWith('https://creativecommons.org/licenses/')||item.license==='Public domain')
  assert.ok(Number.isInteger(item.from)&&Number.isInteger(item.to)&&item.from<=item.to)
  assert.ok(!seen.has(item.source),'Duplicate source '+item.source)
  seen.add(item.source)
 }
})
test('new workshop models resolve only within their photo generation year ranges',()=>{
 const examples=[
  ['Opel','Astra',2008,1998],
  ['Skoda','Fabia',2008,2022],
  ['Peugeot','308',2014,2009],
  ['Renault','Clio',2014,2001],
  ['Renault','Megane',2009,2018],
  ['Ford','Fiesta',2019,2006]
 ]
 for(const [make,model,correctYear,wrongYear] of examples){
  assert.ok(resolveVerifiedVehiclePhoto({make,model,year:correctYear}),make+' '+model)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year:wrongYear}),null,make+' '+model)
 }
 assert.ok(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Passat',generation:'B6 (3C)',year:2008}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Passat',generation:'B7 (36)',year:2012}),null)
})

test('new historical generation photos match the intended catalog entries',()=>{
 const examples=[
  {make:'Volkswagen',model:'Golf',generation:'IV (1J)',year:2001},
  {make:'Volkswagen',model:'Golf',generation:'V (1K)',year:2006},
  {make:'Audi',model:'A3',generation:'8P',year:2006},
  {make:'BMW',model:'Seria 5',generation:'E60/E61',year:2008},
  {make:'Skoda',model:'Octavia',generation:'II (1Z)',year:2006},
  {make:'Opel',model:'Corsa',year:2008}
 ]
 for(const vehicle of examples)assert.ok(resolveVerifiedVehiclePhoto(vehicle),'Missing photo for '+JSON.stringify(vehicle))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',generation:'IV (1J)',year:2018}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Audi',model:'A3',generation:'8V',year:2006}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Octavia',generation:'III (5E)',year:2006}),null)
})

test('country-specific CC BY-SA licenses are accepted without accepting NC or ND',()=>{
 assert.equal(isPhotoLicenseAllowed('CC BY-SA 2.0 DE'),true)
 assert.equal(isPhotoLicenseAllowed('CC BY-SA 3.0 DE'),true)
 assert.equal(isPhotoLicenseAllowed('CC BY-SA 3.0 ND'),false)
 assert.equal(isPhotoLicenseAllowed('CC BY-SA 4.0 NC'),false)
})
test('new reference photos match their year and generation',()=>{
 const yes=[
  {make:'Volkswagen',model:'Golf',generation:'VI (5K)',year:2010},
  {make:'Opel',model:'Astra',year:2014},
  {make:'Ford',model:'Focus',year:2009},
  {make:'Ford',model:'Focus',year:2012},
  {make:'BMW',model:'Seria 3',generation:'E90/E91/E92/E93',year:2007},
  {make:'Kia',model:'Ceed',year:2008},
  {make:'Hyundai',model:'i30',year:2013},
  {make:'Toyota',model:'Yaris',year:2012}
 ]
 for(const v of yes)assert.ok(resolveVerifiedVehiclePhoto(v),JSON.stringify(v))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',generation:'VIII (CD)',year:2010}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'BMW',model:'Seria 3',generation:'G20/G21',year:2007}),null)
})

test('eight newly verified models resolve for intended conservative model years',()=>{
 const rows=[
 ['Toyota','Auris',2008,2001],
 ['Honda','Civic',2013,2004],
 ['Peugeot','207',2008,2016],
 ['Volkswagen','Polo',2022,2017],
 ['Nissan','Qashqai',2008,2018],
 ['Fiat','Panda',2014,2005],
 ['Renault','Scenic',2008,2018],
 ['Dacia','Duster',2022,2010]
 ]
 for(const [make,model,year,wrongYear] of rows){
  assert.ok(resolveVerifiedVehiclePhoto({make,model,year}),make+' '+model+' '+year)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year:wrongYear}),null,make+' '+model+' '+wrongYear)
 }
})
test('photo with declared body style must not match a conflicting known body style',()=>{
 assert.ok(resolveVerifiedVehiclePhoto({make:'Toyota',model:'Auris',year:2008,bodyType:'hatchback'}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Toyota',model:'Auris',year:2008,bodyType:'wagon'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Dacia',model:'Duster',year:2022,bodyType:'sedan'}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'Dacia',model:'Duster',year:2022,bodyType:'suv'}))
})

test('four new verified models resolve only for their conservatively matched years',()=>{
 const examples=[
  {make:'Volkswagen',model:'Touran',generation:'I (1T1/1T2)',year:2007,bodyType:'mpv'},
  {make:'Mazda',model:'3',year:2007,bodyType:'hatchback'},
  {make:'Hyundai',model:'Tucson',year:2007,bodyType:'suv'},
  {make:'Toyota',model:'RAV4',year:2004,bodyType:'suv'}
 ]
 for(const v of examples)assert.ok(resolveVerifiedVehiclePhoto(v),JSON.stringify(v))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Touran',generation:'II (5T)',year:2017}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Mazda',model:'3',year:2018,bodyType:'hatchback'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Hyundai',model:'Tucson',year:2007,bodyType:'sedan'}),null)
})
test('vehicle photo cache key changes with body style and aliases',()=>{
 const hatch=vehiclePhotoKey({make:'Toyota',model:'Auris',year:2008,bodyType:'hatchback'})
 const wagon=vehiclePhotoKey({make:'Toyota',model:'Auris',year:2008,bodyType:'wagon'})
 assert.notEqual(hatch,wagon)
})
test('unknown photo body is not presented as a verified match for known vehicle body',()=>{
 const generic={make:'Example',model:'Sedan',from:2010,to:2019,file:'some.jpg',source:'https://commons.wikimedia.org/wiki/File:some.jpg',author:'Tester',license:'CC BY-SA 4.0'}
 assert.equal(resolveVerifiedVehiclePhoto({make:'Example',model:'Sedan',year:2016,bodyType:'sedan'},[generic]),null)
})

test('new Ibiza, Punto and Accord reference photos are correctly bounded',()=>{
 const examples=[
  {make:'SEAT',model:'Ibiza',year:2007,bodyType:'hatchback'},
  {make:'Fiat',model:'Punto',year:2001,bodyType:'hatchback'},
  {make:'Honda',model:'Accord',year:2006}
 ]
 for(const vehicle of examples)assert.ok(resolveVerifiedVehiclePhoto(vehicle),JSON.stringify(vehicle))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Fiat',model:'Punto',year:2007}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Honda',model:'Accord',year:2015}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'SEAT',model:'Ibiza',year:2022}),null)
})

test('new Superb II liftback and Mondeo Mk3 wagon match only declared body/year',()=>{
 assert.ok(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Superb',year:2010,bodyType:'liftback'}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Superb',year:2010,bodyType:'wagon'}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'Ford',model:'Mondeo',year:2004,bodyType:'kombi'}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Ford',model:'Mondeo',year:2004,bodyType:'sedan'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Ford',model:'Mondeo',year:2014,bodyType:'wagon'}),null)
})

test('new C4, Swift and Insignia B photos match model and conservative year limits',()=>{
 const examples=[
  {make:'Citroen',model:'C4',year:2006,bodyType:'hatchback'},
  {make:'Suzuki',model:'Swift',year:2007,bodyType:'hatchback'},
  {make:'Opel',model:'Insignia',year:2018}
 ]
 for(const v of examples)assert.ok(resolveVerifiedVehiclePhoto(v),JSON.stringify(v))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Citroen',model:'C4',year:2017}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Suzuki',model:'Swift',year:2021}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Opel',model:'Insignia',year:2010}),null)
 // Metadata does not prove the Insignia's body type: no body-specific match allowed.
 assert.equal(resolveVerifiedVehiclePhoto({make:'Opel',model:'Insignia',year:2018,bodyType:'wagon'}),null)
})

test('Tiguan II, Kodiaq I, Captur I and XC60 II photos respect year and body',()=>{
 const entries=[
  {make:'Volkswagen',model:'Tiguan',generation:'II (AD/BW)',year:2018,bodyType:'suv'},
  {make:'Skoda',model:'Kodiaq',year:2018,bodyType:'suv'},
  {make:'Renault',model:'Captur',year:2018,bodyType:'suv'},
  {make:'Volvo',model:'XC60',year:2019,bodyType:'suv'}
 ]
 for(const entry of entries){
  assert.ok(resolveVerifiedVehiclePhoto(entry),'No photograph for '+JSON.stringify(entry))
  assert.equal(resolveVerifiedVehiclePhoto({...entry,bodyType:'sedan'}),null,'Wrong body should not match')
 }
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Tiguan',generation:'I (5N)',year:2018,bodyType:'suv'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Renault',model:'Captur',year:2023,bodyType:'suv'}),null)
})

test('Sportage QL, Mazda CX-5 KF and Peugeot 3008 II use conservative year ranges',()=>{
 const vehicles=[
  {make:'Kia',model:'Sportage',year:2019,bodyType:'suv'},
  {make:'Mazda',model:'CX-5',year:2018,bodyType:'suv'},
  {make:'Peugeot',model:'3008',year:2018,bodyType:'suv'}
 ]
 for(const vehicle of vehicles){
  assert.ok(resolveVerifiedVehiclePhoto(vehicle),JSON.stringify(vehicle))
  assert.equal(resolveVerifiedVehiclePhoto({...vehicle,bodyType:'hatchback'}),null)
 }
 assert.equal(resolveVerifiedVehiclePhoto({make:'Kia',model:'Sportage',year:2007,bodyType:'suv'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Mazda',model:'CX-5',year:2014,bodyType:'suv'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Peugeot',model:'3008',year:2013,bodyType:'suv'}),null)
})

test('all 171 model pairs are in the photo inventory with no duplicates',()=>{
 const catalogPairs=Object.entries(vehicleCatalog).flatMap(([make,models])=>Object.keys(models).map(model=>make+'::'+model))
 const indexedPairs=vehiclePhotoInventory.map(row=>row.key)
 assert.deepEqual(indexedPairs.slice().sort(),catalogPairs.slice().sort())
 assert.equal(indexedPairs.length,new Set(indexedPairs).size)
 assert.equal(vehiclePhotoInventorySummary.total,indexedPairs.length)
 assert.equal(vehiclePhotoInventorySummary.withPhotos+vehiclePhotoInventorySummary.withoutPhotos,indexedPairs.length)
 assert.equal(vehiclePhotoInventorySummary.referencedImages,verifiedVehiclePhotos.length)
})
test('new generation photographs identify model without inventing a body type',()=>{
 assert.ok(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',generation:'VIII (CD)',year:2021,bodyType:'hatchback'}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Volkswagen',model:'Golf',generation:'VII (5G)',year:2021,bodyType:'hatchback'}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Octavia',generation:'IV (NX)',year:2021}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Octavia',generation:'III (5E)',year:2021}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Octavia',generation:'IV (NX)',year:2021,bodyType:'wagon'}),null)
 assert.ok(resolveVerifiedVehiclePhoto({make:'BMW',model:'Seria 3',generation:'F30/F31/F34',year:2015,bodyType:'sedan'}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'BMW',model:'Seria 3',generation:'F30/F31/F34',year:2015,bodyType:'wagon'}),null)
})

test('four more verified models match exact years, generation and body style',()=>{
 const examples=[
  {make:'BMW',model:'X3',year:2019,bodyType:'suv'},
  {make:'Mercedes-Benz',model:'Klasa C',generation:'W205',year:2016,bodyType:'sedan'},
  {make:'Skoda',model:'Scala',year:2020,bodyType:'hatchback'},
  {make:'Ford',model:'Kuga',year:2009,bodyType:'suv'}
 ]
 for(const entry of examples){
  assert.ok(resolveVerifiedVehiclePhoto(entry),JSON.stringify(entry))
  assert.equal(resolveVerifiedVehiclePhoto({...entry,bodyType:'wagon'}),null)
 }
 assert.equal(resolveVerifiedVehiclePhoto({make:'Mercedes-Benz',model:'Klasa C',generation:'W204',year:2016}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Skoda',model:'Scala',year:2017}),null)
})

test('all reviewed discovery models appear with correct make and bounded year',()=>{
 const examples=[
  ['Audi','A1',2012],['Audi','A5',2021],['Audi','A7',2019],['Audi','A8',2007],
  ['Audi','Q2',2018],['Audi','Q3',2014],['Audi','Q5',2022],['Audi','Q7',2012],
  ['Audi','Q8',2019],['Audi','TT',2012],['BMW','X5',2020],['BMW','X6',2021],
  ['Renault','Kadjar',2016],['Fiat','Doblo',2017],['Toyota','Avensis',1999],
  ['Honda','CR-V',2019],['Nissan','Micra',2012],['Nissan','Navara',2018]
 ]
 for(const [make,model,year] of examples){
  assert.ok(resolveVerifiedVehiclePhoto({make,model,year}),make+' '+model+' '+year)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year:1990}),null,make+' '+model+' wrongly matched 1990')
 }
 assert.ok(resolveVerifiedVehiclePhoto({make:'Audi',model:'A7',year:2019,bodyType:'liftback'}))
 assert.equal(resolveVerifiedVehiclePhoto({make:'Audi',model:'A7',year:2019,bodyType:'wagon'}),null)
 assert.equal(resolveVerifiedVehiclePhoto({make:'Audi',model:'A5',generation:'8T/8F',year:2021}),null)
})

test('five new Fiat Honda Toyota entries have right years and body types',()=>{
 const examples=[
  ['Fiat','Tipo',2017,'hatchback'],
  ['Fiat','500',2017,'hatchback'],
  ['Fiat','Ducato',2011,'van'],
  ['Honda','Jazz',2016,'hatchback'],
  ['Toyota','Land Cruiser',2018,'suv']
 ]
 for(const [make,model,year,bodyType] of examples){
  assert.ok(resolveVerifiedVehiclePhoto({make,model,year,bodyType}),make+' '+model)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year,bodyType:'sedan'}),null,make+' '+model+' wrong body')
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year:1995,bodyType}),null,make+' '+model+' wrong year')
 }
})

test('C3, 208, Vitara and A-Class W176 have conservative photo matching',()=>{
 const values=[
  ['Citroen','C3',2018,'hatchback'],
  ['Peugeot','208',2018,'hatchback'],
  ['Suzuki','Vitara',2017,'suv'],
  ['Mercedes-Benz','Klasa A',2014,'hatchback']
 ]
 for(const [make,model,year,bodyType] of values){
  assert.ok(resolveVerifiedVehiclePhoto({make,model,year,bodyType}),make+' '+model)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year,bodyType:'wagon'}),null,make+' '+model+' mismatch')
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year:2001,bodyType}),null,make+' '+model+' ancient model')
 }
})

test('Hyundai i20, Dacia Logan MCV and Mitsubishi ASX reflect correct body and year',()=>{
 const entries=[
  ['Hyundai','i20',2019,'hatchback'],
  ['Dacia','Logan',2018,'wagon'],
  ['Mitsubishi','ASX',2017,'suv']
 ]
 for(const [make,model,year,bodyType] of entries){
  assert.ok(resolveVerifiedVehiclePhoto({make,model,year,bodyType}),make+' '+model)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year,bodyType:'sedan'}),null)
  assert.equal(resolveVerifiedVehiclePhoto({make,model,year:2003,bodyType}),null)
 }
})
