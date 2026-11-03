import test from 'node:test'
import assert from 'node:assert/strict'
import {bytesToBase64,cameraErrorMessage} from '../src/aztec-camera-utils.mjs'

test('camera raw bytes are converted to base64 without truncation',()=>{
 const bytes=Uint8Array.from({length:70000},(_,index)=>index%251)
 assert.equal(Buffer.from(bytesToBase64(bytes),'base64').equals(Buffer.from(bytes)),true)
})

test('camera permission error has an actionable Polish message',()=>{
 assert.match(cameraErrorMessage({name:'NotAllowedError'}),/ustawieniach witryny/i)
})
