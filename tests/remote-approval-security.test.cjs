const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const zlib=require('node:zlib')
const sql=fs.readFileSync('supabase/migrations/20260925_remote_approval_2.sql','utf8')
const edge=fs.readFileSync('supabase/functions/approval/index.ts','utf8')
const pdf=fs.readFileSync('supabase/functions/approval/pdf.ts','utf8')
const fonts=fs.readFileSync('supabase/functions/approval/fonts.generated.ts','utf8')
const desktop=fs.readFileSync('electron/cloud-sync.cjs','utf8')
const client=fs.readFileSync('docs/approval/index.html','utf8')
function embeddedFont(name){
 const body=fonts.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\]\\.join`))?.[1]||''
 const base64=[...body.matchAll(/'([^']+)'/g)].map(match=>match[1]).join('')
 return zlib.gunzipSync(Buffer.from(base64,'base64'))
}

test('remote approval migration bootstraps an older Cloud schema and ships with the installer',()=>{
 const createAt=sql.indexOf('create table if not exists public.customer_approval_links')
 const alterAt=sql.indexOf('alter table public.customer_approval_links add column')
 assert.ok(createAt>=0&&createAt<alterAt)
 assert.match(sql,/alter table public\.customer_approval_links enable row level security/i)
 const packaged=JSON.parse(fs.readFileSync('package.json','utf8')).build.files
 assert.ok(packaged.includes('cloud_schema_supabase.sql'))
 assert.ok(packaged.includes('REMOTE_APPROVAL_SETUP.md'))
})

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

test('client API checks its fixed origin, expiry, consent, signature and snapshot integrity',()=>{
 for(const expected of ["origin===clientOrigin","record.expires_at","termsAccepted","signaturePoints","snapshotHashMatches(record.snapshot,record.snapshot_hash)","SNAPSHOT_HASH_MISMATCH"])assert.ok(edge.includes(expected),expected)
 assert.match(edge,/eq\('status','PENDING'\)\.select\('id'\)[\s\S]*expired\.data\?\.length[\s\S]*APPROVAL_EXPIRED/)
})

test('public approval page keeps the token in the URL fragment and talks only to the approval API',()=>{
 assert.match(desktop,/github\.io\/Autologika-OS\/approval\/#t=\$\{tokenValue\}/)
 assert.match(edge,/Response\.redirect\(`\$\{clientUrl\}#t=\$\{encodeURIComponent\(legacyToken\)\}`/)
 assert.match(client,/new URLSearchParams\(location\.hash\.slice\(1\)\)/)
 assert.match(client,/connect-src https:\/\/aeikhyntzrynpypleqqe\.supabase\.co/)
 assert.doesNotMatch(client,/location\.search/)
 const script=client.match(/<script>([\s\S]*)<\/script>/)?.[1]||''
 assert.doesNotThrow(()=>new Function(script))
})

test('public approval page presents customer-facing labels and exact approval identity',()=>{
 assert.match(client,/approval\.approvalDocumentNo\|\|approval\.documentNo/)
 assert.match(client,/ROBOCIZNA:'Robocizna'/)
 assert.match(client,/CZESC:'Część'/)
 assert.match(client,/item\.quantity[\s\S]*item\.unit[\s\S]*item\.unitPrice/)
 assert.match(client,/approval\.customer\?\.name/)
 assert.match(client,/approval\.scope/)
})

test('approved evidence uploads a signature and printable PDF and removes orphaned uploads',()=>{
 assert.match(edge,/upload\(signaturePath,signatureBytes/)
 assert.match(edge,/upload\(pdfPath,pdfBytes/)
 assert.match(edge,/remove\(uploadedPaths\)/)
 for(const expected of ['snapshot.items','snapshot.customer','snapshot.vehicle','evidence.approvalId','evidence.snapshotHash','evidence.signatureHash','embedPng'])assert.ok(pdf.includes(expected),expected)
 for(const expected of ['drawRectangle','POTWIERDZENIE AKCEPTACJI NAPRAWY','DANE DOKUMENTU','INTEGRALNOŚĆ DOKUMENTU','Strona ${index+1} z ${pages.length}'])assert.ok(pdf.includes(expected),expected)
 assert.match(pdf,/registerFontkit\(fontkit\)/)
 assert.match(pdf,/loadApprovalFonts\(\)/)
 assert.match(fonts,/DecompressionStream\('gzip'\)/)
})

test('approval function embeds Unicode fonts for API deployment and remains public only through its signed token',()=>{
 const config=fs.readFileSync('supabase/config.toml','utf8')
 assert.match(config,/\[functions\.approval\]/)
 assert.match(config,/verify_jwt\s*=\s*false/)
 assert.doesNotMatch(config,/static_files/)
 assert.ok(fs.statSync('supabase/functions/approval/fonts.generated.ts').size>500000)
 assert.deepEqual(embeddedFont('regularGzip'),fs.readFileSync('supabase/functions/approval/assets/NotoSans-Regular.ttf'))
 assert.deepEqual(embeddedFont('boldGzip'),fs.readFileSync('supabase/functions/approval/assets/NotoSans-Bold.ttf'))
 assert.match(fs.readFileSync('supabase/functions/approval/assets/OFL.txt','utf8'),/SIL OPEN FONT LICENSE/i)
})

test('desktop synchronization downloads and verifies missing approval PDFs',()=>{
 for(const expected of ['scanRemoteApprovals','archiveApprovalPdf','approval-evidence','fileHash(dest)','syncApprovalArchive','APPROVAL_SYNCED'])assert.ok(desktop.includes(expected),expected)
})


