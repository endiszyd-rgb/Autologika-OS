import {validateDocumentFile} from './pwa-document-files.mjs'
import review from '../../shared/delivery-review.cjs'
export const validateDelivery=review.validateDelivery
export async function importMobileDelivery(cloud,{file,document}){
 validateDocumentFile(file);const clean=validateDelivery(document),epoch=cloud.epoch,owner=cloud.user?.id
 if(!owner)throw new Error('Zaloguj się ponownie.')
 const bytes=await file.arrayBuffer();cloud.assertSession(epoch)
 const digest=await crypto.subtle.digest('SHA-256',bytes);cloud.assertSession(epoch)
 const hash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')
 const path=`${owner}/delivery-documents/${hash}-${file.name.replace(/[^a-z0-9._-]+/gi,'-')}`
 await cloud.upload('order-files',path,file);cloud.assertSession(epoch)
 let result
 try{result=await cloud.request('/rest/v1/rpc/import_mobile_delivery',{method:'POST',body:JSON.stringify({p_hash:hash,p_document:clean,p_file:{storage_bucket:'order-files',storage_path:path,file_name:file.name,mime:file.type,size_bytes:file.size},p_device:cloud.deviceId})})}
 catch(error){if(/import_mobile_delivery|PGRST202|schema cache|function.*not.*found/i.test(error.message||''))throw new Error('Import magazynowy wymaga jednorazowej aktualizacji bazy Supabase (plik cloud_mobile_delivery.sql). Odczytane pozycje pozostają na ekranie.');throw error}
 cloud.assertSession(epoch);await cloud.sync(true);cloud.assertSession(epoch);return result
}
