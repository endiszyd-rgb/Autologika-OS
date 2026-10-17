import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
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

test('keeps hands-free notes available in intake and schedule workflows',async()=>{
 const [main,schedule]=await Promise.all([
  readFile(new URL('../src/main.jsx',import.meta.url),'utf8'),
  readFile(new URL('../src/schedule.jsx',import.meta.url),'utf8')
 ])
 assert.match(main,/ariaLabel="Objaw lub zgłoszenie klienta"/)
 assert.doesNotMatch(main,/zg\?oszenie klienta/)
 assert.match(schedule,/ariaLabel="Notatka do wizyty"/)
 assert.doesNotMatch(schedule,/Notatka<textarea/)
 assert.doesNotMatch(schedule,/cz\?+ci\?/)
})

test('keeps the vehicle identity hierarchy and dialog controls consistent',async()=>{
 const [workspace,manual]=await Promise.all([
  readFile(new URL('../src/order-workspace.jsx',import.meta.url),'utf8'),
  readFile(new URL('../src/technical-manual.jsx',import.meta.url),'utf8')
 ])
 assert.match(workspace,/join\(' '\)\|\|'Pojazd bez opisu'/)
 assert.match(workspace,/<span>\{order\.plate\|\|'Bez rejestracji'\}<\/span>/)
 assert.match(manual,/aria-label=\{'Zamknij: '\+title\}[^>]*>&times;<\/button>/)
})
