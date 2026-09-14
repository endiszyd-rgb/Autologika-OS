const {buildServiceForecast}=require('./service-forecast.cjs')
const fold=value=>String(value||'').toLocaleLowerCase('pl').replaceAll('ł','l').normalize('NFD').replace(/[\u0300-\u036f]/g,'')

const SYSTEMS=[
 {id:'brakes',label:'Hamulce',weight:1.25,terms:['hamul','abs','esp','tarc','klock','zacisk','plyn hamul','przewod hamul']},
 {id:'engine',label:'Silnik',weight:1.2,terms:['silnik','turbo','dpf','egr','wtrysk','rozrzad','olej silnik','kompres','zaplon','paliw','chlodz','temperatur']},
 {id:'suspension',label:'Zawieszenie',weight:1.05,terms:['zawiesz','wahacz','amortyz','sprezyn','lacznik','stabiliz','drazek','geometr','lozysk','piast']},
 {id:'electrical',label:'Elektryka',weight:1,terms:['elektr','akumulator','alternator','rozrusznik','ladowan','can','lin','swiatl','czujnik','sterownik']},
 {id:'tires',label:'Opony',weight:1.15,terms:['opon','kolo','kol ','felg','biezn','cisnien','tpms','wywaz']},
 {id:'fluids',label:'Płyny',weight:.9,terms:['plyn','olej','wyciek','szczeln','smar','chlodz','hamulcowego','przekladni']}
]

const clamp=value=>Math.max(0,Math.min(100,Math.round(value)))
const dateMs=value=>{const ms=new Date(value||'').getTime();return Number.isFinite(ms)?ms:0}
const daysBetween=(later,earlier)=>Math.floor((later-earlier)/86400000)
const systemFor=text=>{const value=fold(text);let best=null,bestHits=0;for(const system of SYSTEMS){const hits=system.terms.filter(term=>value.includes(term)).length;if(hits>bestHits){best=system;bestHits=hits}}return best}
const severityPenalty={CRITICAL:38,HIGH:24,MEDIUM:12,INFO:5}

function stateFor(score){if(score>=90)return{label:'DOBRY',tone:'good'};if(score>=75)return{label:'STABILNY',tone:'stable'};if(score>=55)return{label:'WYMAGA UWAGI',tone:'warn'};return{label:'PILNY',tone:'critical'}}

function reminderUrgency(reminder,vehicle,now){
 const dueDate=dateMs(reminder.due_date),days=dueDate?daysBetween(dueDate,now):Infinity
 const mileageLeft=reminder.due_mileage!=null?Number(reminder.due_mileage)-Number(vehicle.mileage||0):Infinity
 if(days<0||mileageLeft<0)return{penalty:20,label:'termin przekroczony'}
 if(days<=30||mileageLeft<=1000)return{penalty:12,label:'termin bliski'}
 if(days<=90||mileageLeft<=3000)return{penalty:6,label:'zaplanować'}
 return{penalty:0,label:'zaplanowane'}
}

function calculateCoverage({vehicle,orders,findings,reminders,diagnostics},now){
 let value=0
 if(vehicle.vin)value+=8
 if(Number(vehicle.mileage)>0)value+=8
 if(orders.length)value+=12
 if(orders.some(order=>['GOTOWE','WYDANE'].includes(order.status)))value+=14
 if(orders.some(order=>now-dateMs(order.opened_at)<=365*86400000))value+=16
 if(findings.length)value+=16
 if(reminders.length)value+=10
 if(diagnostics.some(item=>String(item.conclusion||'').trim()))value+=16
 return clamp(value)
}

function recommendationFor(system){
 const map={brakes:'Zweryfikuj układ hamulcowy i zapisz pomiary elementów ciernych.',engine:'Dokończ diagnostykę silnika i potwierdź przyczynę pomiarami.',suspension:'Wykonaj kontrolę luzów zawieszenia i układu kierowniczego.',electrical:'Sprawdź zasilanie, błędy sterowników i instalację elektryczną.',tires:'Sprawdź stan, ciśnienie, wiek i głębokość bieżnika opon.',fluids:'Sprawdź poziom, stan i szczelność wszystkich płynów eksploatacyjnych.'}
 return map[system.id]
}

function buildVehicleHealth(input={},options={}){
 const now=dateMs(options.now)||Date.now(),vehicle=input.vehicle||{},orders=input.orders||[],findings=input.findings||[],reminders=input.reminders||[],diagnostics=input.diagnostics||[]
 const penalties=Object.fromEntries(SYSTEMS.map(system=>[system.id,[]]))
 for(const finding of findings.filter(item=>item.status!=='RESOLVED')){
   const system=systemFor([finding.category,finding.title,finding.details].join(' '))
   if(!system)continue
   const multiplier=finding.status==='MONITOR'?.7:1,points=Math.round((severityPenalty[finding.severity]||5)*multiplier)
   penalties[system.id].push({kind:'finding',points,title:finding.title||finding.category,detail:`${finding.severity||'INFO'} · ${finding.status||'OPEN'}`,sourceId:finding.id})
 }
 for(const reminder of reminders.filter(item=>item.status==='OPEN')){
   const urgency=reminderUrgency(reminder,vehicle,now);if(!urgency.penalty)continue
   const system=systemFor([reminder.title,reminder.note].join(' '))||SYSTEMS.find(item=>item.id==='fluids')
   penalties[system.id].push({kind:'reminder',points:urgency.penalty,title:reminder.title,detail:urgency.label,sourceId:reminder.id})
 }
 const activeOrders=orders.filter(order=>!['GOTOWE','WYDANE'].includes(order.status))
 for(const order of activeOrders){
   const related=diagnostics.find(item=>Number(item.order_id)===Number(order.id)),unresolved=!String(related?.conclusion||'').trim()
   if(!unresolved)continue
   const system=systemFor([order.title,order.complaint,related?.symptom_confirmed,related?.dtcs].join(' '));if(!system)continue
   penalties[system.id].push({kind:'active-order',points:6,title:order.title||`Zlecenie #${order.id}`,detail:'diagnoza w toku',sourceId:order.id})
 }
 const subsystems=SYSTEMS.map(system=>{const issues=penalties[system.id],score=clamp(100-issues.reduce((sum,item)=>sum+item.points,0)),state=stateFor(score);return{id:system.id,label:system.label,score,issues,state:state.label,tone:state.tone,weight:system.weight,recommendation:issues.length?recommendationFor(system):''}})
 const weight=subsystems.reduce((sum,item)=>sum+item.weight,0),score=clamp(subsystems.reduce((sum,item)=>sum+item.score*item.weight,0)/weight),coverage=calculateCoverage({vehicle,orders,findings,reminders,diagnostics},now),state=coverage<20?{label:'DO OCENY',tone:'unknown'}:stateFor(score)
 const actions=subsystems.filter(item=>item.issues.length).sort((a,b)=>a.score-b.score).map(item=>({system:item.id,title:item.recommendation,score:item.score,priority:item.tone})).slice(0,4)
 if(coverage<50)actions.push({system:'data',title:'Uzupełnij kontrolę pojazdu, przebieg, terminy serwisowe i wnioski diagnostyczne.',score:coverage,priority:'unknown'})
 const forecast=buildServiceForecast({vehicle,orders,reminders},{now})
 return{score,displayScore:coverage<20?null:score,coverage,state:state.label,tone:state.tone,subsystems,actions,forecast,issueCount:subsystems.reduce((sum,item)=>sum+item.issues.length,0),calculatedAt:new Date(now).toISOString(),version:'vehicle-health-v2'}
}

module.exports={buildVehicleHealth,systemFor,reminderUrgency,SYSTEMS}
