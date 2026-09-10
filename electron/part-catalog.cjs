function normalizeBarcode(value=''){
  return String(value||'').trim().replace(/^\][A-Za-z][0-9]/,'').replace(/[\r\n\t ]+/g,'')
}

function isGtin(value=''){
  const code=normalizeBarcode(value)
  if(!/^\d{8}$|^\d{12,14}$/.test(code))return false
  const digits=[...code].map(Number),check=digits.pop()
  let sum=0,weight=3
  for(let i=digits.length-1;i>=0;i--){sum+=digits[i]*weight;weight=weight===3?1:3}
  return (10-(sum%10))%10===check
}

function mapUpcDev(data,scannedCode){
  const item=data?.data
  if(!data?.ok||!item?.name)return null
  return {
    barcode:normalizeBarcode(scannedCode),
    name:String(item.name||'').trim(),
    brand:String(item.brand||'').trim(),
    category:String(item.category||'').trim(),
    part_no:String(item.mpn||item.model||'').trim(),
    description:String(item.description||'').trim(),
    image_url:String(item.image_url||'').trim(),
    lookup_source:'upc.dev',
    lookup_url:`https://upc.dev/v1/product/${encodeURIComponent(normalizeBarcode(scannedCode))}`
  }
}

async function lookupBarcodeOnline(fetchImpl,value){
  const barcode=normalizeBarcode(value)
  if(!isGtin(barcode))throw new Error('Kod nie jest poprawnym EAN, UPC ani GTIN.')
  let response
  try{response=await fetchImpl(`https://upc.dev/v1/product/${encodeURIComponent(barcode)}`,{headers:{Accept:'application/json'}})}
  catch(error){throw new Error(`Brak połączenia z internetową bazą części: ${error?.message||error}`)}
  if(response.status===404)return null
  if(!response.ok){const detail=await response.text().catch(()=>'');throw new Error(`Internetowa baza kodów zwróciła błąd HTTP ${response.status}${detail?`: ${detail.slice(0,160)}`:''}.`)}
  return mapUpcDev(await response.json(),barcode)
}

module.exports={normalizeBarcode,isGtin,mapUpcDev,lookupBarcodeOnline}
