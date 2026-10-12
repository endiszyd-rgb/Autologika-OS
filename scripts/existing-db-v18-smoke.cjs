const {app}=require('electron')
const fs=require('fs')
const os=require('os')
const path=require('path')

const source=process.argv[2]||path.join(process.env.APPDATA||'', 'autologika-os','autologika.db')
if(!source||!fs.existsSync(source)){console.error('Podaj ścieżkę do istniejącej bazy autologika.db.');process.exit(2)}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-existing-v18-'))
fs.copyFileSync(source,path.join(temp,'autologika.db'))
app.setPath('userData',temp)

app.whenReady().then(()=>{
 const {getDb,SCHEMA_VERSION}=require('../electron/db.cjs'),db=getDb(),integrity=db.pragma('integrity_check',{simple:true}),tables=['order_repair_operations','repair_parts','dvi_inspections','dvi_items','work_resources','appointment_resources']
 const missing=tables.filter(table=>!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))
 if(integrity!=='ok'||missing.length||db.pragma('user_version',{simple:true})!==SCHEMA_VERSION)throw new Error(`Weryfikacja nieudana: integrity=${integrity}, missing=${missing.join(',')}`)
 console.log(JSON.stringify({ok:true,source,size:fs.statSync(source).size,tempCopy:path.join(temp,'autologika.db'),schemaVersion:SCHEMA_VERSION,integrity,tables:tables.length}))
 app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
