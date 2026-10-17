import test from 'node:test'
import assert from 'node:assert/strict'
import {QC_PHASES,parseQcDecision,qcDecisionComplete,serializeQcDecision,summarizeQc} from '../src/qc-workflow.mjs'

test('QC separates repair verification from release preparation',()=>{
 assert.equal(QC_PHASES.length,2)
 assert.deepEqual(QC_PHASES.map(phase=>phase.checks.length),[4,4])
 assert.deepEqual(QC_PHASES.flatMap(phase=>phase.checks.map(([key])=>key)),['symptom','dtc','leaks','torque','road','warning','clean','recommend'])
})

test('QC decisions preserve result and workshop note',()=>{
 assert.deepEqual(parseQcDecision({checked:0,note:'@qc:ISSUE\nNieszczelność przy opasce'}),{result:'ISSUE',detail:'Nieszczelność przy opasce'})
 assert.equal(serializeQcDecision('NA','brak jazdy próbnej'),'@qc:NA\nbrak jazdy próbnej')
 assert.equal(qcDecisionComplete('PASS'),true)
 assert.equal(qcDecisionComplete('NA'),true)
 assert.equal(qcDecisionComplete('ISSUE'),false)
})

test('legacy checked rows remain completed after the QC redesign',()=>{
 const rows=QC_PHASES.flatMap(phase=>phase.checks.map(([check_key,label])=>({check_key,label,checked:1,note:''})))
 assert.deepEqual(summarizeQc(rows),{total:8,complete:8,issues:0,pending:0,map:Object.fromEntries(rows.map(row=>[row.check_key,{result:'PASS',detail:''}]))})
})
