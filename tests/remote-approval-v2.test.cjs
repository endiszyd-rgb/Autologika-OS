const test=require('node:test')
const assert=require('node:assert/strict')
const path=require('path')
const fs=require('fs')
const os=require('os')
const {DatabaseSync}=require('node:sqlite')
const {canonicalJson,sha256,quoteIdFromScope,buildApprovalSnapshot,TERMS_VERSION}=require('../electron/remote-approval.cjs')
const {safeSegment,ensureInside,approvalFileName,vehicleArchiveFolder,approvalArchiveState,fileHash}=require('../electron/approval-archive.cjs')

test('canonical JSON and SHA-256 are deterministic',()=>{
 const first=canonicalJson({z:1,a:{y:2,x:[3,{b:2,a:1}]}}),second=canonicalJson({a:{x:[3,{a:1,b:2}],y:2},z:1})
 assert.equal(first,second);assert.equal(sha256(first),sha256(second));assert.equal(sha256(first).length,64)
})

test('quote scope requires the complete exact identifier',()=>{
 assert.equal(quoteIdFromScope('Wycena #12 · Hamulce'),12)
 assert.equal(quoteIdFromScope('Inna Wycena #12'),0)
 assert.equal(quoteIdFromScope('Wycena #12x'),0)
})

test('snapshot freezes vehicle, customer, items, terms and an additional scope',()=>{
 const db=new DatabaseSync(':memory:');db.exec(`
  CREATE TABLE approvals(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT,amount REAL,scope TEXT,note TEXT);
  CREATE TABLE quotes(id INTEGER PRIMARY KEY,order_id INTEGER,status TEXT);
  CREATE TABLE quote_items(id INTEGER PRIMARY KEY,quote_id INTEGER,kind TEXT,name TEXT,qty REAL,unit_price REAL,labor_hours REAL,labor_rate REAL,work_name TEXT,variant_name TEXT,customer_description TEXT,notes TEXT);
  CREATE TABLE orders(id INTEGER PRIMARY KEY,cloud_id TEXT,vehicle_id INTEGER,title TEXT,complaint TEXT,opened_at TEXT);
  CREATE TABLE vehicles(id INTEGER PRIMARY KEY,cloud_id TEXT,customer_id INTEGER,plate TEXT,vin TEXT,make TEXT,model TEXT,year INTEGER,engine TEXT);
  CREATE TABLE customers(id INTEGER PRIMARY KEY,name TEXT,company TEXT,email TEXT);
  INSERT INTO customers VALUES(1,'Jan Kowalski','','jan@example.com');
  INSERT INTO vehicles VALUES(2,'vc',1,'ZPL 12345','WVWZZZ1KZBW000001','VW','Touran',2011,'2.0 TDI');
  INSERT INTO orders VALUES(3,'oc',2,'Naprawa','Stuki','2026-09-25');
  INSERT INTO quotes VALUES(10,3,'ZAAKCEPTOWANA'),(11,3,'ROBOCZA');
  INSERT INTO approvals VALUES(20,3,'APPROVED',900,'Wycena #10 · pierwszy',''),(21,3,'PENDING',680,'Wycena #11 · wahacz','Warunki');
  INSERT INTO quote_items VALUES(1,11,'CZESC','Wahacz',1,500,NULL,NULL,NULL,'','',''),(2,11,'ROBOCIZNA','Montaż',1,NULL,1,180,'Montaż wahacza','','Opis','');
 `)
 const result=buildApprovalSnapshot(db,21);db.close()
 assert.equal(result.snapshot.approvalSequence,2);assert.equal(result.snapshot.previouslyApprovedTotal,900);assert.equal(result.snapshot.additionalTotal,680);assert.equal(result.snapshot.newCombinedTotal,1580);assert.equal(result.snapshot.terms.version,TERMS_VERSION);assert.equal(result.snapshot.items.length,2);assert.equal(result.snapshotHash.length,64)
})

test('archive names block traversal and preserve a readable registration',()=>{
 assert.equal(safeSegment(' zpl 12345 '),'ZPL 12345')
 assert.equal(safeSegment('../CON'),'POJAZD')
 const base=path.resolve('C:/archive');assert.throws(()=>ensureInside(base,path.resolve(base,'../escape')),/Nieprawidłowa/)
 assert.equal(approvalFileName({documentNo:'AL-00481',approvalSequence:2,additionalScope:true},'2026-09-24T19:41:00Z'),'2026-09-24_AL-00481_Akceptacja-02_Dodatkowy-zakres.pdf')
})

test('vehicle archive keeps one folder after registration number changes',()=>{
 const db=new DatabaseSync(':memory:'),base=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-archive-'))
 db.exec('CREATE TABLE vehicles(id INTEGER PRIMARY KEY);CREATE TABLE approval_archive_vehicles(vehicle_id INTEGER PRIMARY KEY,vin TEXT,folder_name TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP)')
 const first=vehicleArchiveFolder(db,base,{id:7,plate:'ZPL 12345',vin:'VIN7'}),second=vehicleArchiveFolder(db,base,{id:7,plate:'ZS 99999',vin:'VIN7'})
 assert.equal(first.folderName,'ZPL 12345');assert.equal(second.folderName,first.folderName);assert.equal(second.folder,first.folder)
 db.close();fs.rmSync(base,{recursive:true,force:true})
})

test('local approval archive distinguishes missing, valid and modified PDFs',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-pdf-state-')),file=path.join(dir,'approval.pdf')
 assert.equal(approvalArchiveState({local_pdf_path:'',pdf_hash:''}),'MISSING')
 fs.writeFileSync(file,'signed evidence');const hash=fileHash(file)
 assert.equal(approvalArchiveState({local_pdf_path:file,pdf_hash:hash}),'VALID')
 fs.writeFileSync(file,'modified evidence')
 assert.equal(approvalArchiveState({local_pdf_path:file,pdf_hash:hash}),'CORRUPT')
 fs.rmSync(dir,{recursive:true,force:true})
})
