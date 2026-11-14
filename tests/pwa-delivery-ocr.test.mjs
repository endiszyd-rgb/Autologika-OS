import test from 'node:test'
import assert from 'node:assert/strict'
import {recognizeDeliveryPhoto} from '../src/platform/pwa-delivery-ocr.mjs'

test('unreadable photos explain manual recovery and release the object URL',async()=>{
 const originalImage=globalThis.Image,originalRevoke=URL.revokeObjectURL
 let released=0
 globalThis.Image=class {async decode(){throw new Error('Unsupported image')}}
 URL.revokeObjectURL=url=>{released++;originalRevoke(url)}
 try{
  await assert.rejects(recognizeDeliveryPhoto(new File(['bad'],'photo.heic',{type:'image/heic'})),/JPEG lub PNG/)
  assert.equal(released,1)
  const controller=new AbortController();controller.abort()
  await assert.rejects(recognizeDeliveryPhoto(new File(['bad'],'photo.jpg',{type:'image/jpeg'}),{signal:controller.signal}),{name:'AbortError'})
  assert.equal(released,2)
 }finally{if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage;URL.revokeObjectURL=originalRevoke}
})
