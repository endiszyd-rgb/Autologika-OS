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

function mapUpcItemDb(data,scannedCode){
  const item=Array.isArray(data?.items)?data.items[0]:null
  if(data?.code!=='OK'||!item?.title)return null
  return {
    barcode:normalizeBarcode(scannedCode),
    name:String(item.title||'').trim(),
    brand:String(item.brand||'').trim(),
    category:String(item.category||'').trim(),
    part_no:String(item.model||item.mpn||'').trim(),
    description:String(item.description||'').trim(),
    image_url:String(item.images?.[0]||'').trim(),
    lookup_source:'UPCitemDB',
    lookup_url:`https://www.upcitemdb.com/upc/${encodeURIComponent(normalizeBarcode(scannedCode))}`
  }
}

function mapOpenProductsFacts(data,scannedCode){
  const item=data?.product
  if(data?.status!=='success'||!item?.product_name)return null
  return {
    barcode:normalizeBarcode(scannedCode),
    name:String(item.product_name||'').trim(),
    brand:String(item.brands||'').trim(),
    category:String(item.categories||'').trim(),
    part_no:'',
    description:String(item.generic_name||'').trim(),
    image_url:String(item.image_front_url||'').trim(),
    lookup_source:'Open Products Facts',
    lookup_url:`https://world.openproductsfacts.org/product/${encodeURIComponent(normalizeBarcode(scannedCode))}`
  }
}

async function lookupBarcodeOnline(fetchImpl,value,{details=false}={}){
  const barcode=normalizeBarcode(value)
  if(!isGtin(barcode))throw new Error('Kod nie jest poprawnym EAN, UPC ani GTIN.')
  const headers={Accept:'application/json','Content-Type':'application/json','User-Agent':'AutologikaOS/1.0.7 (https://github.com/endiszyd-rgb/Autologika-OS)'}
  const providers=[
    {url:`https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,map:mapUpcItemDb},
    {url:`https://upc.dev/v1/product/${encodeURIComponent(barcode)}`,map:mapUpcDev},
    {url:`https://world.openproductsfacts.org/api/v3/product/${encodeURIComponent(barcode)}?fields=code,product_name,brands,categories,generic_name,image_front_url`,map:mapOpenProductsFacts}
  ]
  let available=false
  const errors=[]
  for(const provider of providers){
    try{
      const response=await fetchImpl(provider.url,{headers,signal:AbortSignal.timeout(4000)})
      if(response.status===404){available=true;continue}
      if(!response.ok){errors.push(`${new URL(provider.url).hostname}: HTTP ${response.status}`);continue}
      available=true
      const item=provider.map(await response.json(),barcode)
      if(item)return details?{item,available:true,errors}:item
    }catch(error){errors.push(error?.message||String(error))}
  }
  return details?{item:null,available,errors}:null
}

module.exports={normalizeBarcode,isGtin,mapUpcDev,mapUpcItemDb,mapOpenProductsFacts,lookupBarcodeOnline}
