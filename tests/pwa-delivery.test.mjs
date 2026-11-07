import test from 'node:test'
import assert from 'node:assert/strict'
import {validateDelivery,importMobileDelivery} from '../src/platform/pwa-delivery.mjs'
test('delivery review rejects incomplete, fractional, negative and non-finite rows',()=>{
 const row={part_no:'AB123',name:'Filtr',qty:2,unit_cost:10}
 assert.equal(validateDelivery({items:[row]}).items.length,1)
 for(const patch of [{part_no:''},{qty:1.2},{qty:-1},{unit_cost:NaN},{unit_cost:-1}])assert.throws(()=>validateDelivery({items:[{...row,...patch}]}))
 assert.throws(()=>validateDelivery({items:[{...row,enabled:false}]}))
})
test('mobile import uses a stable photo hash and a server transaction rather than client stock overwrites',async()=>{
 const calls=[],file=new File(['photo'],'test.jpg',{type:'image/jpeg'}),document={items:[{part_no:'AB123',name:'Filtr',qty:2,unit_cost:10}]}
 const cloud={epoch:1,user:{id:'owner'},deviceId:'phone',assertSession(){},async upload(...args){calls.push(['upload',...args])},async request(path,options){calls.push(['rpc',path,JSON.parse(options.body)]);return {quantity:2}},async sync(){}}
 await importMobileDelivery(cloud,{file,document});await importMobileDelivery(cloud,{file,document})
 assert.equal(calls[0][2],calls[2][2]);assert.equal(calls[1][1],'/rest/v1/rpc/import_mobile_delivery');assert.equal(calls[1][2].p_hash,calls[3][2].p_hash);assert.equal(calls[1][2].p_document.items[0].qty,2)
})
