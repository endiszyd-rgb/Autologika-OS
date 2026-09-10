const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const {base64Candidates,decodeRegistrationPayload}=require('../electron/registration-decoder.cjs')

// Public decoder fixture from dex4er/js-polish-vehicle-registration-certificate-decoder (GPL-2.0).
const sample=fs.readFileSync(path.join(__dirname,'fixtures','polish-registration-base64.txt'),'utf8').trim()

test('Polish registration AZTEC is decoded into Quick Intake fields',async()=>{
 const result=await decodeRegistrationPayload({raw:`]z0${sample}`})
 assert.equal(result.ok,true)
 assert.equal(result.format,'XXC1')
 assert.equal(result.form.plate,'DMI 1PNK')
 assert.equal(result.form.vin,'JTDKM28E100089120')
 assert.equal(result.form.make,'TOYOTA')
 assert.equal(result.form.model,'COROLLA')
 assert.equal(result.form.year,'2005')
 assert.equal(result.form.power_hp,97)
 assert.match(result.form.customer_name,/KOWALSKI/)
})

test('Zebra SDK binary bytes are accepted as a base64 decode candidate',()=>{
 const hex=Buffer.from(sample,'utf8').toString('hex')
 assert.equal(base64Candidates({hex})[0],sample)
})
