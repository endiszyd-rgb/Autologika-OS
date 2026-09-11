const HIT_TTL_MS=180*24*60*60*1000
const MISS_TTL_MS=24*60*60*1000

const iso=value=>new Date(value).toISOString()

function readBarcodeCache(db,barcode,{now=Date.now()}={}){
  const row=db.prepare('SELECT * FROM barcode_lookup_cache WHERE barcode=?').get(String(barcode||''))
  if(!row)return null
  if(Date.parse(row.expires_at)<=Number(now)){
    db.prepare('DELETE FROM barcode_lookup_cache WHERE barcode=?').run(row.barcode)
    return null
  }
  if(row.status==='MISS')return{found:false,barcode:row.barcode,cached:true,source:'cache',originalSource:row.source||'',cachedAt:row.updated_at}
  try{
    const item=JSON.parse(row.payload_json||'')
    if(!item?.name)throw new Error('empty item')
    return{found:true,barcode:row.barcode,cached:true,source:'cache',originalSource:row.source,item,cachedAt:row.updated_at}
  }catch{
    db.prepare('DELETE FROM barcode_lookup_cache WHERE barcode=?').run(row.barcode)
    return null
  }
}

function writeBarcodeHit(db,barcode,item,{now=Date.now(),ttlMs=HIT_TTL_MS}={}){
  const savedAt=iso(now),expiresAt=iso(Number(now)+ttlMs)
  db.prepare(`INSERT INTO barcode_lookup_cache(barcode,status,source,lookup_url,payload_json,expires_at,created_at,updated_at)
    VALUES (?,'FOUND',?,?,?,?,?,?)
    ON CONFLICT(barcode) DO UPDATE SET status='FOUND',source=excluded.source,lookup_url=excluded.lookup_url,payload_json=excluded.payload_json,expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
    .run(String(barcode||''),String(item?.lookup_source||''),String(item?.lookup_url||''),JSON.stringify(item||{}),expiresAt,savedAt,savedAt)
  return readBarcodeCache(db,barcode,{now})
}

function writeBarcodeMiss(db,barcode,{now=Date.now(),ttlMs=MISS_TTL_MS,source='catalog-web-v2'}={}){
  const savedAt=iso(now),expiresAt=iso(Number(now)+ttlMs)
  db.prepare(`INSERT INTO barcode_lookup_cache(barcode,status,source,lookup_url,payload_json,expires_at,created_at,updated_at)
    VALUES (?,'MISS',?,'','',?,?,?)
    ON CONFLICT(barcode) DO UPDATE SET status='MISS',source=excluded.source,lookup_url='',payload_json='',expires_at=excluded.expires_at,updated_at=excluded.updated_at`)
    .run(String(barcode||''),source,expiresAt,savedAt,savedAt)
  return readBarcodeCache(db,barcode,{now})
}

function pruneBarcodeCache(db,{now=Date.now()}={}){
  return db.prepare('DELETE FROM barcode_lookup_cache WHERE expires_at<=?').run(iso(now)).changes
}

module.exports={HIT_TTL_MS,MISS_TTL_MS,readBarcodeCache,writeBarcodeHit,writeBarcodeMiss,pruneBarcodeCache}
