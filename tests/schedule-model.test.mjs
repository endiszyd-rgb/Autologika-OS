import test from 'node:test'
import assert from 'node:assert/strict'
import {addDays,onDay,segmentOnDay,moveToDay,conflicts} from '../src/schedule-model.mjs'

test('overnight appointment is split into readable daily segments',()=>{
 const firstDay=new Date(2026,8,9),secondDay=addDays(firstDay,1)
 const start=new Date(2026,8,9,22,30),end=new Date(2026,8,10,0,30)
 const row={id:1,start_at:start.toISOString(),end_at:end.toISOString(),bay:'Stanowisko 1',status:'PLAN'}
 assert.equal(onDay(row,firstDay),true)
 assert.equal(onDay(row,secondDay),true)
 const first=segmentOnDay(row,firstDay),second=segmentOnDay(row,secondDay)
 assert.equal(first.minutes,90)
 assert.equal(first.endsAtDayBoundary,true)
 assert.equal(first.continuesAfter,true)
 assert.equal(second.minutes,30)
 assert.equal(second.continuesBefore,true)
})

test('moving an appointment preserves local start time and duration',()=>{
 const start=new Date(2026,8,9,10,15),end=new Date(2026,8,9,12,45)
 const moved=moveToDay({start_at:start.toISOString(),end_at:end.toISOString()},new Date(2026,8,12))
 const movedStart=new Date(moved.start_at),movedEnd=new Date(moved.end_at)
 assert.equal(movedStart.getDate(),12)
 assert.equal(movedStart.getHours(),10)
 assert.equal(movedStart.getMinutes(),15)
 assert.equal(movedEnd-movedStart,end-start)
})

test('collision detection ignores completed and cancelled visits',()=>{
 const base={start_at:'2026-09-09T08:00:00Z',end_at:'2026-09-09T10:00:00Z',bay:'Stanowisko 1'}
 const rows=[{...base,id:1,status:'PLAN'},{...base,id:2,status:'POTWIERDZONY'},{...base,id:3,status:'ZAKONCZONY'},{...base,id:4,status:'ANULOWANY'}]
 assert.deepEqual([...conflicts(rows)].sort(),[1,2])
})
