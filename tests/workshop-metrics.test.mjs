import test from 'node:test'
import assert from 'node:assert/strict'
import {effectiveHourlyRate} from '../src/workshop-metrics.mjs'

test('effective hour uses productive revenue and rejects incomplete samples',()=>{
 assert.equal(effectiveHourlyRate(600,2),300)
 assert.equal(effectiveHourlyRate(600,.1),null)
 assert.equal(effectiveHourlyRate(0,4),null)
 assert.equal(effectiveHourlyRate(600,0),null)
 assert.equal(effectiveHourlyRate(Number.NaN,2),null)
})
