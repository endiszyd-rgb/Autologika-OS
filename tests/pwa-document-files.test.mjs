import test from 'node:test'
import assert from 'node:assert/strict'
import {saveDocumentFile,validateDocumentFile} from '../src/platform/pwa-document-files.mjs'
const file={name:'dokument zdjęcie.jpg',type:'image/jpeg',size:1000}
const fixture=()=>{const calls=[];return {calls,epoch:1,user:{id:'workshop'},assertSession(epoch){if(epoch!==this.epoch)throw new Error('Sesja została zmieniona')},async upload(...args){calls.push(['upload',...args])},async upsert(...args){calls.push(['metadata',...args]);return {id:args[2],...args[1]}}}}
test('accepts photos, HEIC from iPhone, and PDF; refuses oversized and unrelated files',()=>{
 assert.equal(validateDocumentFile(file),file);validateDocumentFile({...file,name:'IMG.HEIC',type:''});validateDocumentFile({...file,name:'scan.pdf',type:'application/pdf'})
 for(const bad of [{...file,size:0},{...file,size:26*1024*1024},{...file,name:'file.exe',type:'application/octet-stream'}])assert.throws(()=>validateDocumentFile(bad))
})
test('saves standalone scan after upload and keeps a stable ID and path on retry',async()=>{
 const cloud=fixture(),payload={file,id:'same-id',title:'Faktura 123'}
 const first=await saveDocumentFile(cloud,payload);await saveDocumentFile(cloud,payload)
 assert.equal(first.document_no,'Faktura 123');assert.equal(cloud.calls[0][0],'upload');assert.equal(cloud.calls[1][1],'delivery_document_imports');assert.equal(cloud.calls[0][2],cloud.calls[2][2]);assert.equal(cloud.calls[1][3],cloud.calls[3][3]);assert.equal(first.storage_bucket,'order-files')
})
test('order attachments retain category and cloud relation',async()=>{
 const cloud=fixture(),saved=await saveDocumentFile(cloud,{file,id:'id',orderId:42,category:'DIAGNOZA'})
 assert.equal(cloud.calls[1][1],'attachments');assert.equal(saved.order_cloud_id,'42');assert.equal(saved.category,'DIAGNOZA')
})
test('failed upload and changed session cannot publish document metadata',async()=>{
 const cloud=fixture();cloud.upload=async()=>{throw new Error('Offline')};await assert.rejects(saveDocumentFile(cloud,{file,id:'id'}),/Offline/);assert.equal(cloud.calls.length,0)
 cloud.upload=async()=>{cloud.epoch++};await assert.rejects(saveDocumentFile(cloud,{file,id:'id'}),/Sesja/);assert.equal(cloud.calls.length,0)
})
