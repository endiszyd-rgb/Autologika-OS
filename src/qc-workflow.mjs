export const QC_PHASES=[
 {id:'repair',step:'01',title:'Kontrola wykonanej naprawy',description:'Sprawdź rezultat pracy zanim pojazd przejdzie do przygotowania do wydania.',checks:[
  ['symptom','Objaw klienta ustąpił lub wynik został opisany'],
  ['dtc','Brak nowych błędów związanych z wykonaną naprawą'],
  ['leaks','Szczelność i poziomy płynów sprawdzone'],
  ['torque','Elementy krytyczne i momenty dokręcenia sprawdzone']
 ]},
 {id:'release',step:'02',title:'Kontrola przed wydaniem',description:'Krótka kontrola końcowa samochodu i informacji przekazywanych klientowi.',checks:[
  ['road','Jazda próbna wykonana, jeżeli była potrzebna'],
  ['warning','Kontrolki i komunikaty sprawdzone'],
  ['clean','Narzędzia usunięte, pojazd przygotowany do wydania'],
  ['recommend','Zalecenia i prace odroczone zapisane dla klienta']
 ]}
]

const RESULTS=new Set(['PASS','ISSUE','NA'])

export function parseQcDecision(row={}){
 const note=String(row?.note||'')
 const match=note.match(/^@qc:(PASS|ISSUE|NA)(?:\n([\s\S]*))?$/)
 if(match)return{result:match[1],detail:match[2]||''}
 return{result:row?.checked?'PASS':'PENDING',detail:note}
}

export function serializeQcDecision(result,detail=''){
 const normalized=RESULTS.has(result)?result:'PENDING'
 return normalized==='PENDING'?String(detail||''):`@qc:${normalized}${detail?`\n${String(detail).trim()}`:''}`
}

export const qcDecisionComplete=result=>result==='PASS'||result==='NA'

export function summarizeQc(rows=[]){
 const map=Object.fromEntries(rows.map(row=>[row.check_key,parseQcDecision(row)]))
 const keys=QC_PHASES.flatMap(phase=>phase.checks.map(([key])=>key))
 const results=keys.map(key=>map[key]?.result||'PENDING')
 return{
  total:keys.length,
  complete:results.filter(qcDecisionComplete).length,
  issues:results.filter(result=>result==='ISSUE').length,
  pending:results.filter(result=>result==='PENDING').length,
  map
 }
}
