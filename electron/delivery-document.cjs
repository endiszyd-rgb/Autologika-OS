const fs=require('fs')
const path=require('path')
const {wholePartQuantity}=require('./part-quantity.cjs')
const crypto=require('crypto')

const {textKey,roundMoney,polishNumber,normalizeOcrText,parseDeliveryDocument,mergeDocumentRows}=require('../shared/delivery-document-parser.cjs')
function documentHash(filePath){return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}

async function recognizeDeliveryDocument(filePath,{cachePath,onProgress=()=>{},tableRectangle=null}={}){
  const {createWorker,PSM}=require('tesseract.js')
  const language=require('@tesseract.js-data/pol')
  fs.mkdirSync(cachePath,{recursive:true})
  let worker
  try{
    worker=await createWorker(language.code,1,{langPath:language.langPath,gzip:language.gzip,cachePath,logger:message=>onProgress({status:message.status,progress:Number(message.progress||0)})})
    await worker.setParameters({preserve_interword_spaces:'1'})
    const result=await worker.recognize(filePath,{rotateAuto:true},{text:true})
    const primary=parseDeliveryDocument(result.data.text)
    if(tableRectangle?.width>0&&tableRectangle?.height>0){
      onProgress({status:'Ponowna kontrola tabeli',progress:.72})
      await worker.setParameters({preserve_interword_spaces:'1',tessedit_pageseg_mode:PSM.SINGLE_BLOCK})
      const detailResult=await worker.recognize(filePath,{rectangle:tableRectangle},{text:true})
      primary.items=mergeDocumentRows(primary,parseDeliveryDocument(detailResult.data.text))
      const rowsGross=roundMoney(primary.items.reduce((sum,item)=>sum+Number(item.gross_total||0),0))
      primary.warnings=[]
      if(primary.items.some(item=>item.confidence==='CHECK'))primary.warnings.push('Co najmniej jeden numer lub cena wymaga sprawdzenia z dokumentem.')
      if(primary.gross_total>0&&Math.abs(primary.gross_total-rowsGross)>.1)primary.warnings.push(`Suma odczytanych pozycji (${rowsGross.toFixed(2)} zł) różni się od wartości dokumentu (${primary.gross_total.toFixed(2)} zł). Sprawdź, czy OCR nie pominął wiersza.`)
    }
    return{...primary,ocr_confidence:roundMoney(result.data.confidence||0)}
  }finally{if(worker)await worker.terminate()}
}

function defaultMarkup(cost){return cost<50?.45:cost<200?.35:cost<500?.28:.22}

function importDeliveryDocument(db,payload,{markup=defaultMarkup}={}){
  const document=payload?.document||{},hash=String(payload?.source_hash||'').trim(),items=(document.items||[]).filter(item=>item?.enabled!==false)
  if(!hash)throw new Error('Brakuje identyfikatora skanowanego dokumentu.')
  if(!items.length)throw new Error('Dokument nie zawiera pozycji wybranych do importu.')
  const duplicate=db.prepare('SELECT id,external_document_no FROM purchase_orders WHERE source_hash=?').get(hash)
  if(duplicate){const error=new Error(`Ten dokument został już przyjęty do magazynu${duplicate.external_document_no?` jako ${duplicate.external_document_no}`:''}.`);error.code='DUPLICATE_DOCUMENT';throw error}
  const cleanItems=items.map((item,index)=>{
    const partNo=String(item.part_no||'').trim(),name=String(item.name||'').trim(),qty=Number(item.qty),unitCost=Number(item.unit_cost),grossTotal=Number(item.gross_total||0)
    if(!partNo)throw new Error(`Pozycja ${index+1}: uzupełnij numer katalogowy.`)
    if(!name)throw new Error(`Pozycja ${index+1}: uzupełnij nazwę części.`)
    wholePartQuantity(qty,{label:`Pozycja ${index+1}: ilość części`})
    if(!Number.isFinite(unitCost)||unitCost<0)throw new Error(`Pozycja ${index+1}: cena zakupu jest niepoprawna.`)
    return{...item,part_no:partNo,name,qty,unit_cost:roundMoney(unitCost),gross_total:roundMoney(grossTotal)}
  })
  return db.transaction(()=>{
    const supplierName=String(document.supplier_name||'').trim()||'Dostawca z dokumentu'
    let supplier=db.prepare('SELECT * FROM suppliers WHERE trim(name)=? COLLATE NOCASE').get(supplierName)
    if(!supplier){const result=db.prepare('INSERT INTO suppliers(name,notes) VALUES (?,?)').run(supplierName,'Utworzono automatycznie podczas importu dokumentu dostawy.');supplier={id:result.lastInsertRowid,name:supplierName}}
    if(String(document.document_no||'').trim()){
      const numberDuplicate=db.prepare('SELECT id FROM purchase_orders WHERE supplier_id=? AND trim(external_document_no)=? COLLATE NOCASE').get(supplier.id,String(document.document_no).trim())
      if(numberDuplicate){const error=new Error(`Dokument ${document.document_no} tego dostawcy został już przyjęty do magazynu.`);error.code='DUPLICATE_DOCUMENT';throw error}
    }
    const order=db.prepare(`INSERT INTO purchase_orders(supplier_id,status,ordered_at,notes,external_document_no,document_date,source_file,source_hash,gross_total)
      VALUES (?,'ODEBRANE',?,?,?,?,?,?,?)`).run(supplier.id,document.document_date||new Date().toISOString(),`Automatyczny import OCR · ${path.basename(payload.source_file||'dokument')}`,document.document_no||'',document.document_date||null,payload.source_file||'',hash,roundMoney(document.gross_total||0))
    const allParts=db.prepare('SELECT * FROM inventory_parts').all(),byNumber=new Map(allParts.filter(part=>textKey(part.part_no)).map(part=>[textKey(part.part_no),part]))
    const insertPart=db.prepare(`INSERT INTO inventory_parts(part_no,name,category,lookup_source,stock,min_stock,unit_cost,sell_price,supplier_id,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    const updatePart=db.prepare(`UPDATE inventory_parts SET stock=?,unit_cost=?,supplier_id=COALESCE(supplier_id,?),updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    const insertItem=db.prepare(`INSERT INTO purchase_order_items(purchase_order_id,inventory_part_id,part_no,name,qty,unit_cost,received_qty) VALUES (?,?,?,?,?,?,?)`)
    let created=0,updated=0
    for(const item of cleanItems){
      let part=byNumber.get(textKey(item.part_no)),partId
      if(part){
        const oldStock=Number(part.stock||0),newStock=oldStock+item.qty
        const weighted=newStock>0?roundMoney((oldStock*Number(part.unit_cost||0)+item.qty*item.unit_cost)/newStock):item.unit_cost
        updatePart.run(newStock,weighted,supplier.id,part.id);partId=part.id;part={...part,stock:newStock,unit_cost:weighted};byNumber.set(textKey(item.part_no),part);updated++
      }else{
        const sellPrice=roundMoney(item.unit_cost*(1+markup(item.unit_cost)))
        const inserted=insertPart.run(item.part_no,item.name,'Części samochodowe','Dokument dostawy OCR',item.qty,0,item.unit_cost,sellPrice,supplier.id,`Dostawa ${document.document_no||'bez numeru'} · ${document.document_date||new Date().toISOString().slice(0,10)}`)
        partId=inserted.lastInsertRowid;part={id:partId,part_no:item.part_no,stock:item.qty,unit_cost:item.unit_cost};byNumber.set(textKey(item.part_no),part);created++
      }
      insertItem.run(order.lastInsertRowid,partId,item.part_no,item.name,item.qty,item.unit_cost,item.qty)
    }
    const quantity=cleanItems.reduce((sum,item)=>sum+item.qty,0)
    const itemsGrossTotal=roundMoney(cleanItems.reduce((sum,item)=>sum+Number(item.gross_total||item.qty*item.unit_cost),0))
    const ext=path.extname(payload.source_file||'').toLowerCase(),mime=ext==='.png'?'image/png':ext==='.webp'?'image/webp':'image/jpeg'
    const history=db.prepare(`INSERT INTO delivery_document_imports(supplier_name,document_no,document_date,gross_total,items_gross_total,item_count,quantity,items_json,file_path,mime,size_bytes,cloud_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(supplier.name,document.document_no||'',document.document_date||null,roundMoney(document.gross_total||itemsGrossTotal),itemsGrossTotal,cleanItems.length,quantity,JSON.stringify(cleanItems),payload.source_file||'',mime,payload.source_file&&fs.existsSync(payload.source_file)?fs.statSync(payload.source_file).size:null,hash)
    return{purchase_id:order.lastInsertRowid,delivery_document_id:history.lastInsertRowid,supplier_id:supplier.id,supplier_name:supplier.name,created,updated,item_count:cleanItems.length,quantity}
  })()
}

module.exports={normalizeOcrText,parseDeliveryDocument,recognizeDeliveryDocument,importDeliveryDocument,documentHash,textKey,polishNumber,mergeDocumentRows}
