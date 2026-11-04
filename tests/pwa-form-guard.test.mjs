import test from 'node:test'
import assert from 'node:assert/strict'
import {createDraftTracker} from '../src/platform/pwa-form-guard.mjs'
test('changing and restoring a field does not leave a false unsaved warning',()=>{
 const tracker=createDraftTracker();tracker.capture('form','old');tracker.change('form','new');assert.equal(tracker.dirty(),true);tracker.change('form','old');assert.equal(tracker.dirty(),false)
})
test('successful save clears only the saved form and preserves changes made during the request',()=>{
 const tracker=createDraftTracker();tracker.capture('form','original');tracker.change('form','save this');tracker.capture('another','old');tracker.change('another','unsaved')
 const saved=tracker.checkpoint(['form']);tracker.change('form','typed while saving');saved();assert.equal(tracker.dirty('form'),true);assert.equal(tracker.dirty('another'),true)
 const next=tracker.checkpoint(['form']);next();assert.equal(tracker.dirty('form'),false);assert.equal(tracker.dirty('another'),true)
})
test('removing a completed modal clears its warning without forgetting another draft',()=>{
 const tracker=createDraftTracker();tracker.capture('modal','a');tracker.change('modal','b');tracker.capture('page','a');tracker.change('page','b');tracker.forget('modal');assert.equal(tracker.dirty(),true);tracker.clear();assert.equal(tracker.dirty(),false)
})
