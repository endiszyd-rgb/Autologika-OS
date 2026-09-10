const test=require('node:test')
const assert=require('node:assert/strict')
const {DEFAULT_UPDATE_REPOSITORY,resolveUpdateRepository}=require('../electron/update-repository.cjs')

test('packaged app uses the built-in public update repository',()=>{
  assert.deepEqual(resolveUpdateRepository({name:'autologika-os'}),DEFAULT_UPDATE_REPOSITORY)
})

test('explicit build publish settings can override the built-in repository',()=>{
  assert.deepEqual(resolveUpdateRepository({build:{publish:[{provider:'github',owner:'example',repo:'workshop'}]}}),{owner:'example',repo:'workshop'})
})
