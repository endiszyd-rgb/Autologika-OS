import {createClient} from 'https://esm.sh/@supabase/supabase-js@2'
import {approvalRecordState,parseSignatureDataUrl,publicApproval,sha256Hex,snapshotHashMatches,validApprovalToken,validateDecision} from './model.mjs'
import {approvalPdf} from './pdf.ts'

const clientOrigin='https://endiszyd-rgb.github.io'
const clientUrl=`${clientOrigin}/Autologika-OS/approval/`
const baseHeaders={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}
const corsHeaders={'access-control-allow-origin':clientOrigin,'access-control-allow-methods':'POST, OPTIONS','access-control-allow-headers':'content-type','access-control-max-age':'86400','vary':'Origin'}
const json=(body:unknown,status=200,cors=false)=>new Response(JSON.stringify(body),{status,headers:{...baseHeaders,...(cors?corsHeaders:{})}})
const storagePath=(row:any,name:string)=>`${row.workshop_id}/${row.order_local_id}/${row.id}/${name}`
const errorMessage=(code:string)=>code.includes('TERMS_REQUIRED')?'Zaznacz zgodę na przedstawiony zakres i koszty.':code.includes('SIGNATURE')?'Podpisz się w polu podpisu.':code.includes('EVIDENCE_BUSY')?'Decyzja jest już przetwarzana. Odśwież stronę za chwilę.':code.includes('SNAPSHOT_HASH_MISMATCH')?'Kontrola integralności dokumentu nie powiodła się. Warsztat został poinformowany.':'Spróbuj ponownie lub poproś warsztat o nowy link.'

Deno.serve(async req=>{
 const url=new URL(req.url),origin=req.headers.get('origin')||'',cors=origin===clientOrigin
 if(req.method==='OPTIONS')return cors?new Response(null,{status:204,headers:corsHeaders}):json({ok:false,error:'Niedozwolone źródło żądania.'},403)
 if(req.method==='GET'){
  const legacyToken=url.searchParams.get('t')||''
  if(validApprovalToken(legacyToken))return Response.redirect(`${clientUrl}#t=${encodeURIComponent(legacyToken)}`,302)
  return json({ok:false,error:'Link jest nieprawidłowy.'},400)
 }
 if(req.method!=='POST')return json({ok:false,error:'Metoda nie jest obsługiwana.'},405,cors)
 if(!cors)return json({ok:false,error:'Niedozwolone źródło żądania.'},403)

 let input:any
 try{input=await req.json()}catch{return json({ok:false,error:'Nieprawidłowe dane żądania.'},400,true)}
 const rawToken=String(input?.token||'')
 if(!validApprovalToken(rawToken))return json({ok:false,error:'Link jest nieprawidłowy. Poproś warsztat o nowy link.'},400,true)

 const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!),tokenHash=await sha256Hex(rawToken)
 let {data:record}=await sb.from('customer_approval_links').select('*').eq('token_hash',tokenHash).maybeSingle()
 if(!record){const legacy=await sb.from('customer_approval_links').select('*').eq('token',rawToken).maybeSingle();record=legacy.data}
 if(!record)return json({ok:false,error:'Link jest nieprawidłowy. Poproś warsztat o nowy link.'},404,true)
 if(approvalRecordState(record)==='EXPIRED'){
  const expired=await sb.from('customer_approval_links').update({status:'EXPIRED',decided_at:new Date().toISOString()}).eq('id',record.id).eq('status','PENDING').select('id')
  if(expired.data?.length)await sb.from('customer_approval_events').insert({workshop_id:record.workshop_id,approval_id:record.id,event_type:'APPROVAL_EXPIRED'})
  record.status='EXPIRED';record.decided_at=record.decided_at||new Date().toISOString()
 }
 if(record.status==='PENDING'&&!record.opened_at){
  const opened=new Date().toISOString(),result=await sb.from('customer_approval_links').update({opened_at:opened}).eq('id',record.id).is('opened_at',null).select('id')
  if(result.data?.length)await sb.from('customer_approval_events').insert({workshop_id:record.workshop_id,approval_id:record.id,event_type:'APPROVAL_OPENED'})
  record.opened_at=opened
 }

 if(input.action==='load')return json({ok:true,approval:publicApproval(record.snapshot),status:record.status,expiresAt:record.expires_at,decidedAt:record.decided_at||null,customerNote:record.customer_note||''},200,true)
 if(input.action!=='decide')return json({ok:false,error:'Nieprawidłowa operacja.'},400,true)
 if(record.status!=='PENDING')return json({ok:true,status:record.status,decidedAt:record.decided_at||null},200,true)

 const uploadedPaths:string[]=[]
 try{
  const decision=String(input.decision||''),note=String(input.note||''),signature=String(input.signature||''),signaturePoints=Number(input.signaturePoints||0),termsAccepted=input.termsAccepted===true
  validateDecision({decision,note,signature,signaturePoints,termsAccepted})
  if(!await snapshotHashMatches(record.snapshot,record.snapshot_hash)){
   await sb.from('customer_approval_links').update({status:'SUPERSEDED',decided_at:new Date().toISOString(),security_event:'SNAPSHOT_HASH_MISMATCH'}).eq('id',record.id).eq('status','PENDING')
   await sb.from('customer_approval_events').insert({workshop_id:record.workshop_id,approval_id:record.id,event_type:'APPROVAL_SECURITY_REJECTED',details:{reason:'SNAPSHOT_HASH_MISMATCH'}})
   throw new Error('SNAPSHOT_HASH_MISMATCH')
  }
  let signaturePath=null,signatureHash=null,pdfPath=null,pdfHash=null
  if(decision==='APPROVED'){
   const signatureBytes=parseSignatureDataUrl(signature);signatureHash=await sha256Hex(signatureBytes);signaturePath=storagePath(record,'signature.png');pdfPath=storagePath(record,'approval-confirmation.pdf')
   const pdfBytes=await approvalPdf(record.snapshot,{approvalId:record.id,signedAt:new Date().toISOString(),snapshotHash:record.snapshot_hash,signatureHash,signatureBytes});pdfHash=await sha256Hex(pdfBytes)
   const signatureUpload=await sb.storage.from('approval-evidence').upload(signaturePath,signatureBytes,{contentType:'image/png',upsert:false,cacheControl:'0'});if(signatureUpload.error)throw new Error('EVIDENCE_BUSY');uploadedPaths.push(signaturePath)
   const pdfUpload=await sb.storage.from('approval-evidence').upload(pdfPath,pdfBytes,{contentType:'application/pdf',upsert:false,cacheControl:'0'});if(pdfUpload.error)throw new Error('EVIDENCE_BUSY');uploadedPaths.push(pdfPath)
  }
  const {data,error}=await sb.rpc('decide_customer_approval',{p_token_hash:record.token_hash,p_decision:decision,p_note:note,p_snapshot_hash:record.snapshot_hash,p_signature_path:signaturePath,p_signature_hash:signatureHash,p_signature_points:decision==='APPROVED'?signaturePoints:null,p_pdf_path:pdfPath,p_pdf_hash:pdfHash,p_user_agent:req.headers.get('user-agent')||''})
  if(error)throw error
  const decided=Array.isArray(data)?data[0]:data
  if(decided?.security_event)throw new Error('SNAPSHOT_HASH_MISMATCH')
  if(decided?.status!==decision)throw new Error('EVIDENCE_BUSY')
  return json({ok:true,status:decided.status,decidedAt:decided.decided_at||new Date().toISOString()},200,true)
 }catch(error){
  if(uploadedPaths.length)await sb.storage.from('approval-evidence').remove(uploadedPaths)
  const code=String((error as Error)?.message||error)
  return json({ok:false,error:errorMessage(code),code:code.includes('SNAPSHOT_HASH_MISMATCH')?'SNAPSHOT_HASH_MISMATCH':'DECISION_FAILED'},400,true)
 }
})
