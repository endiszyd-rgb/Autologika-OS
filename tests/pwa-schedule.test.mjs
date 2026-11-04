import test from 'node:test'
import assert from 'node:assert/strict'
import {createPwaSchedule} from '../src/platform/pwa-schedule.mjs'
import {PWA_RELATIONS,stablePwaLocalId} from '../src/platform/pwa-identifiers.mjs'
function fixture(){
 const records=new Map(),cloud={list:async entity=>[...records.values()].filter(r=>r.entity===entity).map(r=>hydrate(r)),get:async(entity,id)=>hydrate([...records.values()].find(r=>r.entity===entity&&(r.cloud_id===id||same(r.id,id)))),upsertMany:async entries=>entries.map(({entity,cloudId,payload={},remove=false})=>{const key=entity+cloudId;if(remove){records.delete(key);return null}const row={...payload,entity,cloud_id:cloudId,id:stablePwaLocalId(entity,cloudId)};records.set(key,row);return hydrate(row)})}
 const same=(a,b)=>String(a)===String(b),hydrate=row=>{if(!row)return null;const data={...row};for(const [field,entity] of Object.entries(PWA_RELATIONS))if(data[field])data[field.replace('_cloud','')]=stablePwaLocalId(entity,data[field]);return data}
 return {cloud,api:createPwaSchedule(cloud)}
}
const appointment=()=>({title:'Wizyta',bay:'Stanowisko 1',start_at:'2026-11-04T09:00:00Z',end_at:'2026-11-04T10:00:00Z'})
test('appointments create bay and shared resource relations; date range includes overlapping visits',async()=>{
 const {cloud,api}=fixture(),saved=await api.create(appointment())
 assert.equal((await cloud.list('appointment_resources')).length,1)
 const found=await api.list('2026-11-04T09:30:00Z','2026-11-04T09:45:00Z')
 assert.equal(found[0].id,saved.id);assert.equal(found[0].resource_ids.length,1)
 await api.remove(saved.id);assert.equal((await cloud.list('appointment_resources')).length,0)
})
test('conflict requires explicit override with a saved reason',async()=>{
 const {cloud,api}=fixture();await api.create(appointment())
 await assert.rejects(api.create(appointment()),/jawny wyjątek/)
 await api.create({...appointment(),override_conflict:true,override_reason:'Potwierdzono równoległą wizytę'})
 assert.equal((await cloud.list('appointments')).length,2);assert.equal((await cloud.list('schedule_conflict_overrides')).length,1)
})
test('changing bay removes old links and can reselect an earlier bay',async()=>{
 const {cloud,api}=fixture(),saved=await api.create(appointment())
 await api.update(saved.id,{...appointment(),bay:'Stanowisko 2'})
 assert.equal((await cloud.list('appointment_resources')).length,1)
 await api.update(saved.id,{...appointment(),bay:'Stanowisko 1'})
 assert.equal((await cloud.list('appointment_resources')).length,1)
})
