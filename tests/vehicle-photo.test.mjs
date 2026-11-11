import test from 'node:test'
import assert from 'node:assert/strict'
import {resolveVerifiedVehiclePhoto,isPhotoLicenseAllowed,photoCoverage,vehiclePhotoKey} from '../src/vehicle-photo-model.mjs'
import {vehicleCatalog} from '../src/vehicle-catalog.js'

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
