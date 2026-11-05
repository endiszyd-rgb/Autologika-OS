import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createConfirmationQueue} from '../src/confirmation-queue.mjs'

test('confirmation queue keeps a request made before the UI host is ready',async()=>{
 const queue=createConfirmationQueue(),result=queue.request({title:'Usuń zlecenie'})
 assert.equal(queue.pending(),1)
 let received
 const unsubscribe=queue.subscribe(request=>{received=request})
 assert.equal(queue.pending(),0)
 assert.equal(received.options.title,'Usuń zlecenie')
 received.resolve(true)
 assert.equal(await result,true)
 unsubscribe()
})

test('confirmation queue sends string messages to an active host',async()=>{
 const queue=createConfirmationQueue()
 let received
 const unsubscribe=queue.subscribe(request=>{received=request})
 const result=queue.request('Czy kontynuować?')
 assert.equal(received.options.message,'Czy kontynuować?')
 received.resolve(false)
 assert.equal(await result,false)
 unsubscribe()
})

test('native confirmation debt cannot grow while screens migrate to the shared dialog',()=>{
 const files=['main.jsx','operations-screens.jsx','parts-workspace.jsx','technical-manual.jsx']
 const nativeCount=files.reduce((sum,file)=>sum+(readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8').match(/\bconfirm\(/g)||[]).length,0)
 assert.ok(nativeCount<=7,`Pozostało ${nativeCount} natywnych potwierdzeń; dozwolony limit migracji to 7.`)
})
