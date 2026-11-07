import {validateDocumentFile} from './pwa-document-files.mjs'
export function validateDelivery(document){
 const items=(document?.items||[]).filter(item=>item.enabled!==false)
 if(!items.length)throw new Error('Nie rozpoznano części. Popraw zdjęcie albo dodaj pozycje ręcznie.')
 if(items.length>200)throw new Error('Jedna dostawa może zawierać maksymalnie 200 pozycji.')
 return {...document,items:items.map((item,index)=>{const qty=Number(item.qty),cost=Number(item.unit_cost);if(!String(item.part_no||'').trim()||!String(item.name||'').trim()||!Number.isInteger(qty)||qty<=0||qty>100000||!Number.isFinite(cost)||cost<0||cost>100000000)throw new Error(`Pozycja ${index+1}: sprawdź numer, nazwę, ilość i cenę netto.`);return {...item,part_no:String(item.part_no).trim(),name:String(item.name).trim(),qty,unit_cost:cost}})}
}
export async function importMobileDelivery(cloud,{file,document}){
 validateDocumentFile(file);const clean=validateDelivery(document),epoch=cloud.epoch,owner=cloud.user?.id
 if(!owner)throw new Error('Zaloguj się ponownie.')
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(byte=>byte.toString(16).padStart(2,'0')).join('')
 const path=`${owner}/delivery-documents/${hash}-${file.name.replace(/[^a-z0-9._-]+/gi,'-')}`
 await cloud.upload('order-files',path,file);cloud.assertSession(epoch)
 let result
 try{result=await cloud.request('/rest/v1/rpc/import_mobile_delivery',{method:'POST',body:JSON.stringify({p_hash:hash,p_document:clean,p_file:{storage_bucket:'order-files',storage_path:path,file_name:file.name,mime:file.type,size_bytes:file.size},p_device:cloud.deviceId})})}
 catch(error){if(/import_mobile_delivery|PGRST202|schema cache|function.*not.*found/i.test(error.message||''))throw new Error('Import magazynowy wymaga jednorazowej aktualizacji bazy Supabase (plik cloud_mobile_delivery.sql). Odczytane pozycje pozostają na ekranie.');throw error}
 cloud.assertSession(epoch);await cloud.sync(true);return result
}
