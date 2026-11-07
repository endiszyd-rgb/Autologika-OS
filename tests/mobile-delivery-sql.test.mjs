import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {PGlite} from '@electric-sql/pglite'
test('mobile delivery transaction validates, updates stock, rolls back, deduplicates, and isolates workshops',async()=>{
 const db=new PGlite(),owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002'
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table sync_records(id bigint generated always as identity primary key,workshop_id uuid not null,entity_type text not null,cloud_id text not null,payload jsonb not null default '{}',updated_at timestamptz not null default now(),deleted_at timestamptz,version bigint not null default 1,device_id text,unique(workshop_id,entity_type,cloud_id));alter table sync_records enable row level security;create policy own on sync_records to authenticated using(workshop_id=auth.uid()) with check(workshop_id=auth.uid());grant usage on schema public,auth to authenticated;grant select,insert,update on sync_records to authenticated;grant usage,select on sequence sync_records_id_seq to authenticated;`)
  await db.exec(await readFile(new URL('../cloud_mobile_delivery.sql',import.meta.url),'utf8'))
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);await db.exec('set role authenticated')
  await db.query("insert into sync_records(workshop_id,entity_type,cloud_id,payload) values($1,'inventory_parts','existing',$2)",[owner,JSON.stringify({part_no:'AB-123',name:'Filtr',stock:2,unit_cost:10})])
  const doc=(no,items)=>({supplier_name:'Hurtownia',document_no:no,items}),row={part_no:'AB123',name:'Filtr',qty:3,unit_cost:20},file=who=>({storage_bucket:'order-files',storage_path:who+'/delivery-documents/a.jpg',file_name:'a.jpg'})
  const receive=async(hash,document,who=owner)=>(await db.query('select import_mobile_delivery($1,$2,$3,$4) as result',[hash.repeat(64),JSON.stringify(document),JSON.stringify(file(who)),'test'])).rows[0].result
  const stock=async()=>(await db.query("select (payload->>'stock')::numeric stock,(payload->>'unit_cost')::numeric cost from sync_records where cloud_id='existing'")).rows[0]
  const imported=await receive('a',doc('FV/1',[row]));assert.equal(imported.item_count,1);assert.equal(imported.updated,1);assert.deepEqual(await stock(),{stock:'5',cost:'16.00'})
  const retry=await receive('a',doc('FV/1',[row]));assert.equal(retry.already_imported,true);assert.equal((await stock()).stock,'5')
  await assert.rejects(receive('b',doc('FV/1',[row])),/już przyjęty/)
  await assert.rejects(receive('c',doc('FV/2',[row,{...row,qty:-1}])),/Nieprawidłowy/);assert.equal((await stock()).stock,'5')
  assert.equal((await db.query("select count(*)::int count from sync_records where entity_type='delivery_document_imports'")).rows[0].count,1)
  await assert.rejects(receive('d',doc('FV/3',[row]),other),/należeć/)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);const isolated=await receive('a',doc('FV/1',[row]),other);assert.equal(isolated.created,1);assert.equal((await db.query("select count(*)::int count from sync_records where cloud_id='existing'")).rows[0].count,0)
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner]);assert.equal((await stock()).stock,'5')
 }finally{await db.close()}
})
