export function validateDocumentFile(file){
 if(!file||!file.size)throw new Error('Wybrany plik jest pusty. Wybierz inne zdjęcie lub PDF.')
 if(file.size>25*1024*1024)throw new Error('Plik jest większy niż 25 MB. Wybierz mniejsze zdjęcie lub PDF.')
 if(!/^image\//.test(file.type||'')&&file.type!=='application/pdf'&&!/\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name||''))throw new Error('Wybierz zdjęcie dokumentu lub plik PDF.')
 return file
}
export async function saveDocumentFile(cloud,{file,id,orderId=null,category='PRZYJECIE',title=''}){
 validateDocumentFile(file)
 const epoch=cloud.epoch,owner=cloud.user?.id
 if(!owner)throw new Error('Zaloguj się ponownie, aby zapisać dokument.')
 const name=file.name||'dokument.jpg',safe=name.replace(/[^a-z0-9._-]+/gi,'-'),path=`${owner}/${orderId?`orders/${orderId}`:'documents'}/${id}-${safe}`
 await cloud.upload('order-files',path,file)
 cloud.assertSession(epoch)
 const metadata={name,original_name:name,file_name:name,mime:file.type||'application/octet-stream',mime_type:file.type||'application/octet-stream',size_bytes:file.size,size:file.size,storage_bucket:'order-files',storage_path:path,created_at:new Date().toISOString()}
 return orderId?cloud.upsert('attachments',{...metadata,order_cloud_id:String(orderId),category},id):cloud.upsert('delivery_document_imports',{...metadata,document_no:String(title||name).trim(),supplier_name:'Dokument z telefonu',item_count:0,quantity:0,items_json:'[]',source:'PWA_SCAN'},id)
}
