import test from 'node:test'
import assert from 'node:assert/strict'
import {effectiveHourlyRate,workLogMinutes,workLogTimestamp} from '../src/workshop-metrics.mjs'

test('effective hour uses productive revenue and rejects incomplete samples',()=>{
 assert.equal(effectiveHourlyRate(600,2),300)
 assert.equal(effectiveHourlyRate(600,.1),null)
 assert.equal(effectiveHourlyRate(0,4),null)
 assert.equal(effectiveHourlyRate(600,0),null)
 assert.equal(effectiveHourlyRate(Number.NaN,2),null)
})

test('active work time reads SQLite timestamps as UTC',()=>{
 const now=Date.parse('2026-10-15T10:35:00Z')
 assert.equal(workLogTimestamp('2026-10-15 10:00:00'),Date.parse('2026-10-15T10:00:00Z'))
 assert.equal(workLogMinutes({started_at:'2026-10-15 10:00:00',ended_at:null,duration_minutes:null},now),35)
 assert.equal(workLogMinutes({started_at:'bad',ended_at:null},now),0)
 assert.equal(workLogMinutes({started_at:'2026-10-15 10:00:00',ended_at:'2026-10-15 10:20:00',duration_minutes:20},now),20)
})
