const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const WINDOWS_RESERVED=/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i
function safeSegment(value,fallback='POJAZD'){
  const raw=String(value||'');if(/[\/\\]/.test(raw))return fallback
  let name=raw.normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').trim().replace(/[. ]+$/g,'').toUpperCase()
  if(!name||name==='.'||name==='..'||WINDOWS_RESERVED.test(name))name=fallback
  return name.slice(0,80)
}
function safeFileSegment(value,fallback='DOKUMENT'){return safeSegment(value,fallback).replace(/\s+/g,'-')}
function ensureInside(base,candidate){const root=path.resolve(base),target=path.resolve(candidate);if(target!==root&&!target.startsWith(root+path.sep))throw new Error('Nieprawidłowa ścieżka archiwum.');return target}
function archiveBasePath(app,db){const row=db.prepare("SELECT value FROM sync_meta WHERE key='approval_archive_path' LIMIT 1").get();return path.resolve(String(row?.value||'').trim()||path.join(app.getPath('desktop'),'AutoLogika - Akceptacje'))}
function vehicleArchiveFolder(db,base,vehicle){
  const existing=db.prepare('SELECT * FROM approval_archive_vehicles WHERE vehicle_id=?').get(vehicle.id)
  const folderName=existing?.folder_name||safeSegment(vehicle.plate,vehicle.vin?safeSegment(vehicle.vin):`POJAZD-${vehicle.id}`)
  if(!existing)db.prepare('INSERT INTO approval_archive_vehicles(vehicle_id,vin,folder_name) VALUES (?,?,?)').run(vehicle.id,vehicle.vin||'',folderName)
  else if(String(existing.vin||'')!==String(vehicle.vin||''))db.prepare('UPDATE approval_archive_vehicles SET vin=?,updated_at=CURRENT_TIMESTAMP WHERE vehicle_id=?').run(vehicle.vin||'',vehicle.id)
  fs.mkdirSync(base,{recursive:true});const root=fs.realpathSync(base),folder=ensureInside(root,path.join(root,folderName));fs.mkdirSync(folder,{recursive:true});const realFolder=ensureInside(root,fs.realpathSync(folder));return {folder:realFolder,folderName}
}
function approvalFileName(snapshot,decidedAt){
  const date=new Date(decidedAt||Date.now()).toISOString().slice(0,10),orderNo=safeFileSegment(snapshot.documentNo||`AL-${snapshot.orderId}`,'ZLECENIE')
  return `${date}_${orderNo}_Akceptacja-${String(snapshot.approvalSequence||1).padStart(2,'0')}${snapshot.additionalScope?'_Dodatkowy-zakres':''}.pdf`
}
function fileHash(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function approvalArchiveState(row={}){
  if(!row.local_pdf_path||!fs.existsSync(row.local_pdf_path))return 'MISSING'
  if(!row.pdf_hash)return 'VALID'
  try{return fileHash(row.local_pdf_path)===String(row.pdf_hash).toLowerCase()?'VALID':'CORRUPT'}catch{return 'CORRUPT'}
}
function approvalEvidencePaths(pdfFile){
  const folder=path.dirname(pdfFile),stem=path.basename(pdfFile,path.extname(pdfFile));return {pdf:pdfFile,signature:path.join(folder,`${stem}_Podpis.png`),manifest:path.join(folder,`${stem}_Dowod.json`)}
}
function writeApprovalManifest(pdfFile,approval={},snapshot={},signatureFile=''){
  const files=approvalEvidencePaths(pdfFile),pdfSha256=fileHash(pdfFile),signatureExists=!!signatureFile&&fs.existsSync(signatureFile),signatureSha256=signatureExists?fileHash(signatureFile):''
  const manifest={schema:'autologika.approval-evidence.v1',archivedAt:new Date().toISOString(),approval:{localId:Number(approval.id)||null,remoteId:approval.remote_id||null,orderId:Number(approval.order_id)||null,status:approval.status||'',documentNo:approval.document_no||snapshot.documentNo||'',decidedAt:approval.decided_at||null,approvalSequence:Number(approval.approval_sequence||snapshot.approvalSequence||1),termsVersion:approval.terms_version||snapshot.terms?.version||''},integrity:{algorithm:approval.hash_algorithm||'SHA-256',snapshotSha256:approval.snapshot_hash||'',signatureSha256:approval.signature_hash||signatureSha256,pdfSha256:approval.pdf_hash||pdfSha256},files:{pdf:{name:path.basename(pdfFile),bytes:fs.statSync(pdfFile).size,sha256:pdfSha256},signature:signatureExists?{name:path.basename(signatureFile),bytes:fs.statSync(signatureFile).size,sha256:signatureSha256}:null},snapshot}
  const temp=`${files.manifest}.part-${process.pid}-${Date.now()}`;fs.writeFileSync(temp,JSON.stringify(manifest,null,2),'utf8');fs.renameSync(temp,files.manifest);return {...files,data:manifest}
}
function approvalEvidenceInspection(row={}){
  const files=row.local_pdf_path?approvalEvidencePaths(row.local_pdf_path):{pdf:'',signature:'',manifest:''}
  const inspectFile=(file,expected='')=>{const exists=!!file&&fs.existsSync(file);let actualHash='',bytes=0;try{if(exists){actualHash=fileHash(file);bytes=fs.statSync(file).size}}catch{}const normalized=String(expected||'').toLowerCase();return{path:file,exists,bytes,expectedHash:normalized,actualHash,valid:exists&&!!actualHash&&(!normalized||actualHash===normalized)}}
  const pdf=inspectFile(files.pdf,row.pdf_hash),signature=inspectFile(files.signature,row.signature_hash),signatureRequired=!!row.signature_storage_path
  let manifestData=null,manifestError='';if(files.manifest&&fs.existsSync(files.manifest))try{manifestData=JSON.parse(fs.readFileSync(files.manifest,'utf8'))}catch(error){manifestError=String(error.message||error)}
  const manifestExists=!!files.manifest&&fs.existsSync(files.manifest),manifestValid=!!manifestData&&manifestData.schema==='autologika.approval-evidence.v1'&&manifestData.files?.pdf?.sha256===pdf.actualHash&&(!row.pdf_hash||manifestData.integrity?.pdfSha256===String(row.pdf_hash).toLowerCase())&&(!row.snapshot_hash||manifestData.integrity?.snapshotSha256===String(row.snapshot_hash).toLowerCase())&&(!row.signature_hash||manifestData.integrity?.signatureSha256===String(row.signature_hash).toLowerCase())
  let state='COMPLETE';if(!pdf.exists)state='MISSING';else if(!pdf.valid||signatureRequired&&signature.exists&&!signature.valid||manifestExists&&!manifestValid)state='CORRUPT';else if(signatureRequired&&!signature.exists||!manifestExists)state='INCOMPLETE'
  return{state,checkedAt:new Date().toISOString(),pdf,signature:{...signature,required:signatureRequired},manifest:{path:files.manifest,exists:manifestExists,bytes:manifestExists?fs.statSync(files.manifest).size:0,valid:manifestValid,error:manifestError,schema:manifestData?.schema||''}}
}
function approvalEvidenceState(row={}){return approvalEvidenceInspection(row).state}
function chooseDestination(folder,name,expectedHash=''){
  const preferred=ensureInside(folder,path.join(folder,name));if(!fs.existsSync(preferred)||expectedHash&&fileHash(preferred)===expectedHash)return preferred
  const ext=path.extname(name),stem=path.basename(name,ext);for(let index=2;index<1000;index++){const candidate=ensureInside(folder,path.join(folder,`${stem}_Kopia-${String(index).padStart(2,'0')}${ext}`));if(!fs.existsSync(candidate))return candidate}
  throw new Error('Nie można wybrać bezpiecznej nazwy pliku archiwum.')
}

module.exports={safeSegment,safeFileSegment,ensureInside,archiveBasePath,vehicleArchiveFolder,approvalFileName,fileHash,approvalArchiveState,approvalEvidencePaths,writeApprovalManifest,approvalEvidenceInspection,approvalEvidenceState,chooseDestination}
