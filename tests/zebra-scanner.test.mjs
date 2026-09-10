import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeScan,parseZebraSdkXml} from '../src/zebra-scanner.js'

test('Zebra BarcodeEvent XML preserves RAW bytes and extracts VIN',()=>{
 const vin='WVWZZZ1JZXW000001'
 const raw=[...new TextEncoder().encode(vin)].map(x=>`0x${x.toString(16).padStart(2,'0')}`).join(' ')
 const xml=`<scandata><scannerID>1</scannerID><modelnumber>DS2208</modelnumber><serialnumber>TEST123</serialnumber><datatype>11</datatype><rawdata>${raw}</rawdata></scandata>`
 const parsed=parseZebraSdkXml(xml),scan=analyzeScan(xml)
 assert.equal(parsed.model,'DS2208')
 assert.equal(parsed.bytes.length,17)
 assert.equal(parsed.text,vin)
 assert.equal(scan.vin,vin)
 assert.equal(scan.byteLength,17)
})

test('scanner analysis distinguishes encoded AZTEC payload candidates',()=>{
 assert.equal(analyzeScan('G'.repeat(48)).kind,'BASE64')
 assert.equal(analyzeScan('10FF'.repeat(20)).kind,'HEX')
})
