import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {base64Candidates,decodeRegistrationPayloadBrowser} from '../src/registration-decoder-browser.js'

const dirname=path.dirname(fileURLToPath(import.meta.url))
const sample=fs.readFileSync(path.join(dirname,'fixtures','polish-registration-base64.txt'),'utf8').trim()

test('browser decoder maps Polish registration AZTEC to Quick Intake',async()=>{
 const result=await decodeRegistrationPayloadBrowser({raw:`]z0${sample}`})
 assert.equal(result.ok,true)
 assert.equal(result.form.plate,'DMI 1PNK')
 assert.equal(result.form.vin,'JTDKM28E100089120')
 assert.equal(result.form.make,'TOYOTA')
 assert.equal(result.form.model,'COROLLA')
 assert.equal(result.form.year,'2005')
 assert.equal(result.form.power_hp,97)
 assert.match(result.form.customer_name,/KOWALSKI/)
})

test('browser decoder accepts binary camera result encoded as base64',()=>{
 assert.equal(base64Candidates({base64:sample})[0],sample)
})
