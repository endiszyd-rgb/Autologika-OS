const test=require('node:test')
const assert=require('node:assert/strict')
const {DatabaseSync}=require('node:sqlite')
const {readBarcodeCache,writeBarcodeHit,writeBarcodeMiss,pruneBarcodeCache}=require('../electron/barcode-cache.cjs')

function database(){
  const db=new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE barcode_lookup_cache (
    barcode TEXT PRIMARY KEY,status TEXT NOT NULL,source TEXT,lookup_url TEXT,payload_json TEXT,
    expires_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
  )`)
  return db
}

test('stores and restores a successful product lookup',()=>{
  const db=database(),now=Date.parse('2026-09-11T10:00:00.000Z')
  const item={barcode:'4006381333931',name:'Filtr oleju',brand:'MANN-FILTER',lookup_source:'UPCitemDB',lookup_url:'https://example.test/item'}
  writeBarcodeHit(db,item.barcode,item,{now,ttlMs:1000})
  const result=readBarcodeCache(db,item.barcode,{now:now+500})
  assert.equal(result.found,true)
  assert.equal(result.cached,true)
  assert.equal(result.originalSource,'UPCitemDB')
  assert.deepEqual(result.item,item)
  db.close()
})

test('removes an expired cached result',()=>{
  const db=database(),now=Date.parse('2026-09-11T10:00:00.000Z')
  writeBarcodeMiss(db,'4006381333931',{now,ttlMs:1000})
  assert.equal(readBarcodeCache(db,'4006381333931',{now:now+1001}),null)
  assert.equal(db.prepare('SELECT COUNT(*) count FROM barcode_lookup_cache').get().count,0)
  db.close()
})

test('negative cache avoids repeated online lookups and can be pruned',()=>{
  const db=database(),now=Date.parse('2026-09-11T10:00:00.000Z')
  const result=writeBarcodeMiss(db,'4006381333931',{now,ttlMs:1000})
  assert.deepEqual({found:result.found,cached:result.cached,source:result.source},{found:false,cached:true,source:'cache'})
  assert.equal(pruneBarcodeCache(db,{now:now+1001}),1)
  db.close()
})
