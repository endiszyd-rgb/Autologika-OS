import test from 'node:test'
import assert from 'node:assert/strict'
import {collectSpeechResults,formatVoiceTranscript,joinVoiceText,speechErrorMessage} from '../src/voice-entry.mjs'

test('formats Polish punctuation commands without damaging normal words',()=>{
 assert.equal(formatVoiceTranscript('silnik szarpie przecinek na zimno kropka nowa linia kontrolka miga'),'silnik szarpie, na zimno.\nkontrolka miga')
})

test('appends a dictated fragment to existing workshop notes',()=>{
 assert.equal(joinVoiceText('DTC P0401.','sprawdzić podciśnienie'),'DTC P0401. sprawdzić podciśnienie')
 assert.equal(joinVoiceText('','nierówna praca silnika'),'Nierówna praca silnika')
})

test('collects final and interim browser recognition results',()=>{
 const results=[Object.assign([{transcript:'stuki z przodu'}],{isFinal:true}),Object.assign([{transcript:'na nierównościach'}],{isFinal:false})]
 assert.deepEqual(collectSpeechResults(results),{transcript:'stuki z przodu na nierównościach',final:false})
})

test('returns an actionable Polish microphone error',()=>{
 assert.match(speechErrorMessage('not-allowed'),/mikrofonu/i)
 assert.match(speechErrorMessage('unknown'),/rozpoznać mowy/i)
})
