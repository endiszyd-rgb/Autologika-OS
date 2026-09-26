const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const sql=fs.readFileSync('supabase/migrations/20260925_remote_approval_2.sql','utf8')
const edge=fs.readFileSync('supabase/functions/approval/index.ts','utf8')
const pdf=fs.readFileSync('supabase/functions/approval/pdf.ts','utf8')
const desktop=fs.readFileSync('electron/cloud-sync.cjs','utf8')

test('approval evidence stays private and scoped to its workshop owner',()=>{
 assert.match(sql,/approval-evidence','approval-evidence',false/)
 assert.match(sql,/bucket_id='approval-evidence'.*auth\.uid\(\)::text/s)
 assert.doesNotMatch(sql,/create policy \"approval_evidence_.*(?:insert|update|delete)/i)
})

test('only the service role can execute the atomic decision function',()=>{
 assert.match(sql,/select \* into target[\s\S]*for update/i)
 assert.match(sql,/where id=target\.id and status='PENDING'/i)
 assert.match(sql,/revoke all on function public\.decide_customer_approval[\s\S]*authenticated/i)
 assert.match(sql,/grant execute on function public\.decide_customer_approval[\s\S]*service_role/i)
 assert.match(sql,/protect_finished_approval_trigger/)
 assert.match(sql,/supersede_previous_approval_links_trigger/)
})

test('client endpoint checks origin, expiry, consent, signature and snapshot integrity',()=>{
 for(const expected of ["origin!==url.origin","record.expires_at","termsAccepted","signaturePoints","snapshotHashMatches(record.snapshot,record.snapshot_hash)","SNAPSHOT_HASH_MISMATCH"])assert.ok(edge.includes(expected),expected)
 assert.match(edge,/eq\('status','PENDING'\)\.select\('id'\)[\s\S]*expired\.data\?\.length[\s\S]*APPROVAL_EXPIRED/)
})

test('approved evidence uploads a signature and printable PDF and removes orphaned uploads',()=>{
 assert.match(edge,/upload\(signaturePath,signatureBytes/)
 assert.match(edge,/upload\(pdfPath,pdfBytes/)
 assert.match(edge,/remove\(uploadedPaths\)/)
 for(const expected of ['snapshot.items','snapshot.customer','snapshot.vehicle','evidence.approvalId','evidence.snapshotHash','evidence.signatureHash','embedPng'])assert.ok(pdf.includes(expected),expected)
 for(const expected of ['drawRectangle','POTWIERDZENIE AKCEPTACJI NAPRAWY','DANE DOKUMENTU','INTEGRALNOŚĆ DOKUMENTU','Strona ${index+1} z ${pages.length}'])assert.ok(pdf.includes(expected),expected)
 assert.match(pdf,/registerFontkit\(fontkit\)/)
 assert.match(pdf,/NotoSans-Regular\.ttf/)
 assert.match(pdf,/NotoSans-Bold\.ttf/)
})

test('approval function bundles Unicode fonts and remains public only through its signed token',()=>{
 const config=fs.readFileSync('supabase/config.toml','utf8')
 assert.match(config,/\[functions\.approval\]/)
 assert.match(config,/verify_jwt\s*=\s*false/)
 assert.match(config,/static_files\s*=\s*\[\s*"\.\/functions\/approval\/assets\/\*"\s*\]/)
 assert.ok(fs.statSync('supabase/functions/approval/assets/NotoSans-Regular.ttf').size>100000)
 assert.ok(fs.statSync('supabase/functions/approval/assets/NotoSans-Bold.ttf').size>100000)
 assert.match(fs.readFileSync('supabase/functions/approval/assets/OFL.txt','utf8'),/SIL OPEN FONT LICENSE/i)
})

test('desktop synchronization downloads and verifies missing approval PDFs',()=>{
 for(const expected of ['scanRemoteApprovals','archiveApprovalPdf','approval-evidence','fileHash(dest)','syncApprovalArchive','APPROVAL_SYNCED'])assert.ok(desktop.includes(expected),expected)
})


