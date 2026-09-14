import test from 'node:test'
import assert from 'node:assert/strict'
import {analyzeDiagnostic,diagnosticTokens} from '../src/diagnostic-assistant.mjs'

const catalog=[
 {group:'EGR, DPF/GPF i emisje spalin',job:{id:'dpf-test',name:'Diagnostyka czujnika różnicy ciśnień',scope:'Pomiary czujnika i przewodów'},variant:{id:'standard',name:'standard',customer_description:'Diagnostyka DPF'}},
 {group:'Układ hamulcowy',job:{id:'pads',name:'Wymiana klocków hamulcowych',scope:'Wymiana'},variant:{id:'front',name:'przód',customer_description:'Wymiana klocków'}}
]

test('normalizuje polskie objawy do tokenów',()=>{
 assert.deepEqual(diagnosticTokens('Różnica ciśnień i błędy doładowania'),['roznica','cisnien','doladowania'])
})

test('łączy DTC i objaw DPF z właściwą procedurą',()=>{
 const result=analyzeDiagnostic({order:{complaint:'Brak mocy i częste wypalanie DPF'},diagnostic:{dtcs:'P2453',measurements:'35 mbar na biegu jałowym'},catalog,knowledge:{results:[{id:7,title:'DPF'}],hints:[]}})
 assert.equal(result.confidence,'ŚREDNIA')
 assert.equal(result.hypotheses[0].id,'dpf')
 assert.equal(result.suggestions[0].workId,'dpf-test')
 assert.ok(result.checklist.some(item=>item.includes('różnicę ciśnień')))
 assert.deepEqual(result.codes,['P2453'])
})

test('bez danych nie zgaduje przyczyny',()=>{
 const result=analyzeDiagnostic({catalog})
 assert.equal(result.confidence,'NISKA')
 assert.equal(result.hypotheses[0].id,'general')
 assert.equal(result.suggestions.length,0)
})
