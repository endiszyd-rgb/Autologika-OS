const ENTITY_TABLES={customer:'customers',vehicle:'vehicles',order:'orders'}

function requiredId(value){
 const id=Number(value)
 if(!Number.isInteger(id)||id<1)throw new Error('Nieprawidłowy identyfikator rekordu.')
 return id
}

function count(db,sql,...params){return Number(db.prepare(sql).get(...params)?.n||0)}

function deletionPreview(db,entity,value){
 const table=ENTITY_TABLES[entity],id=requiredId(value)
 if(!table)throw new Error('Nieobsługiwany typ rekordu.')
 const row=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id)
 if(!row)throw new Error(entity==='customer'?'Klient już nie istnieje.':entity==='vehicle'?'Pojazd już nie istnieje.':'Zlecenie już nie istnieje.')
 let vehicles=0,orders=0,attachments=0,appointments=0,files=[]
 if(entity==='customer'){
  vehicles=count(db,'SELECT COUNT(*) n FROM vehicles WHERE customer_id=?',id)
  orders=count(db,'SELECT COUNT(*) n FROM orders o JOIN vehicles v ON v.id=o.vehicle_id WHERE v.customer_id=?',id)
  attachments=count(db,'SELECT COUNT(*) n FROM attachments a JOIN orders o ON o.id=a.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE v.customer_id=?',id)
  appointments=count(db,'SELECT COUNT(DISTINCT a.id) n FROM appointments a LEFT JOIN orders o ON o.id=a.order_id LEFT JOIN vehicles v ON v.id=COALESCE(a.vehicle_id,o.vehicle_id) WHERE v.customer_id=?',id)
  files=db.prepare("SELECT a.file_path FROM attachments a JOIN orders o ON o.id=a.order_id JOIN vehicles v ON v.id=o.vehicle_id WHERE v.customer_id=? AND COALESCE(a.file_path,'')!=''").all(id)
 }else if(entity==='vehicle'){
  vehicles=1
  orders=count(db,'SELECT COUNT(*) n FROM orders WHERE vehicle_id=?',id)
  attachments=count(db,'SELECT COUNT(*) n FROM attachments a JOIN orders o ON o.id=a.order_id WHERE o.vehicle_id=?',id)
  appointments=count(db,'SELECT COUNT(DISTINCT a.id) n FROM appointments a LEFT JOIN orders o ON o.id=a.order_id WHERE a.vehicle_id=? OR o.vehicle_id=?',id,id)
  files=db.prepare("SELECT a.file_path FROM attachments a JOIN orders o ON o.id=a.order_id WHERE o.vehicle_id=? AND COALESCE(a.file_path,'')!=''").all(id)
 }else{
  orders=1
  attachments=count(db,'SELECT COUNT(*) n FROM attachments WHERE order_id=?',id)
  appointments=count(db,'SELECT COUNT(*) n FROM appointments WHERE order_id=?',id)
  files=db.prepare("SELECT file_path FROM attachments WHERE order_id=? AND COALESCE(file_path,'')!=''").all(id)
 }
 const label=entity==='customer'?row.name:entity==='vehicle'?[row.plate,row.make,row.model].filter(Boolean).join(' · '):`#${row.id} · ${row.title}`
 return {entity,id,label,counts:{customers:entity==='customer'?1:0,vehicles,orders,attachments,appointments},files:files.map(x=>x.file_path)}
}

function removeEntity(db,entity,value,{unlink=()=>{}}={}){
 const preview=deletionPreview(db,entity,value),table=ENTITY_TABLES[entity]
 const execute=()=>{
  const result=db.prepare(`DELETE FROM ${table} WHERE id=?`).run(preview.id)
  if(!result.changes)throw new Error('Rekord nie został usunięty.')
 }
 if(typeof db.transaction==='function')db.transaction(execute)()
 else{
  db.exec('BEGIN')
  try{execute();db.exec('COMMIT')}catch(error){db.exec('ROLLBACK');throw error}
 }
 let filesRemoved=0
 for(const file of preview.files)try{unlink(file);filesRemoved++}catch{}
 return {ok:true,...preview,filesRemoved}
}

module.exports={deletionPreview,removeEntity}
