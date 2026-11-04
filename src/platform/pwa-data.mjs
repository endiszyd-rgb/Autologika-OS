import {workLogMinutes,workLogTimestamp} from '../workshop-metrics.mjs'
export const round=value=>Math.round((Number(value)||0)*100)/100
export const sameId=(left,right)=>left!=null&&right!=null&&String(left)===String(right)
export const localDay=value=>{const d=value?new Date(value):new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
const amount=item=>Number(item.qty??item.labor_hours??0)*Number(item.unit_price??item.labor_rate??0)
export function orderMoney(order,allItems=[],payments=[]){
 const items=allItems.filter(item=>sameId(item.order_id,order.id)),hasItems=items.length>0,labor=items.filter(item=>item.kind==='ROBOCIZNA'),parts=items.filter(item=>item.kind==='CZESC'),other=items.filter(item=>item.kind!=='CZESC')
 const parts_sale=hasItems?round(parts.reduce((s,i)=>s+amount(i),0)):Number(order.parts_sale||0),parts_cost=hasItems?round(parts.reduce((s,i)=>s+Number(i.qty||0)*Number(i.unit_cost||0),0)):Number(order.parts_cost||0)
 const other_sale=hasItems?round(other.reduce((s,i)=>s+amount(i),0)):Number(order.other_sale||0),other_cost=hasItems?round(other.reduce((s,i)=>s+Number(i.qty||0)*Number(i.unit_cost||0),0)):Number(order.other_cost||0)
 const legacy_labor=labor.length?0:Number(order.labor_hours||0)*Number(order.labor_rate||0),item_labor=round(labor.reduce((s,i)=>s+amount(i),0)),service_sale=round(other.filter(i=>i.kind!=='ROBOCIZNA').reduce((s,i)=>s+amount(i),0))
 const total=round(order.final_price!=null&&order.final_price!==''?order.final_price:legacy_labor+parts_sale+other_sale+Number(order.diagnosis_fee||0)-Number(order.discount||0)),paid=round(payments.filter(p=>sameId(p.order_id,order.id)).reduce((s,p)=>s+Number(p.amount||0),0)),cost=round(parts_cost+other_cost)
 return {...order,total,paid,balance:round(Math.max(0,total-paid)),parts_sale,parts_cost,other_sale,other_cost,cost,contribution:round(total-cost),legacy_labor,item_labor,service_sale,diagnosis_sale:Number(order.diagnosis_fee||0)}
}
export function financeData(orders,payments=[],logs=[],today=new Date()){
 const month=localDay(today).slice(0,7),previous=new Date(today.getFullYear(),today.getMonth()-1,1),details=orders.filter(o=>localDay(o.opened_at||o.created_at).startsWith(month)),prev=orders.filter(o=>localDay(o.opened_at||o.created_at).startsWith(localDay(previous).slice(0,7))),sum=(rows,key)=>round(rows.reduce((s,row)=>s+Number(row[key]||0),0))
 const actual_hours=round(logs.filter(log=>localDay(new Date(workLogTimestamp(log.started_at))).startsWith(month)).reduce((s,log)=>s+Math.min(960,workLogMinutes(log)),0)/60)
 const current={revenue:sum(details,'total'),orders:details.length,avg_ticket:details.length?round(sum(details,'total')/details.length):0,parts_sale:sum(details,'parts_sale'),parts_cost:sum(details,'parts_cost'),paid:sum(payments.filter(p=>localDay(p.paid_at||p.created_at).startsWith(month)),'amount'),receivables:sum(details,'balance'),previous_revenue:sum(prev,'total'),parts_margin:round(sum(details,'parts_sale')-sum(details,'parts_cost')),actual_hours,labor_services_revenue:round(sum(details,'legacy_labor')+sum(details,'item_labor')+sum(details,'service_sale')+sum(details,'diagnosis_sale'))}
 const daily=Array.from({length:30},(_,index)=>{const day=new Date(today);day.setDate(day.getDate()-29+index);const key=localDay(day);return {day:key,revenue:sum(orders.filter(o=>localDay(o.opened_at||o.created_at)===key),'total')}})
 const groups=new Map();for(const order of details){const category=order.parts_sale?'Naprawa + części':order.diagnosis_sale?'Diagnostyka':'Robocizna / usługa',row=groups.get(category)||{category,count:0,revenue:0};row.count++;row.revenue=round(row.revenue+order.total);groups.set(category,row)}
 return {current,daily,mix:[...groups.values()],details}
}
export function reminderState(row,today=new Date()){
 const date=localDay(today),due=String(row.due_date||'').slice(0,10),remaining=row.due_mileage?Number(row.due_mileage)-Number(row.current_mileage||0):null,days=due?Math.round((new Date(`${due}T12:00:00`)-new Date(`${date}T12:00:00`))/86400000):null
 return {...row,mileage_remaining:remaining,days_remaining:days,urgency:row.status==='DONE'?'DONE':(days!=null&&days<0)||(remaining!=null&&remaining<=0)?'OVERDUE':(days!=null&&days<=30)||(remaining!=null&&remaining<=1500)?'SOON':'PLANNED'}
}
export function orderReadiness({order,diagnosis={},approvals=[],parts=[],logs=[],qc=[],notes={},procedures=[]}){
 const last=[...approvals].sort((a,b)=>String(b.decided_at||b.created_at).localeCompare(String(a.decided_at||a.created_at)))[0],diagnosis_documented=Boolean(diagnosis.symptom_confirmed||diagnosis.conclusion||diagnosis.recommendation),customer_approved=diagnosis_documented&&last?.status==='APPROVED',parts_documented=customer_approved&&parts.every(p=>['ZAMONTOWANE','ZWROT_ZAKONCZONY','ANULOWANE'].includes(p.status)),work_logged=parts_documented&&logs.some(l=>l.ended_at),qc_done=work_logged&&['symptom','dtc','leaks','torque','road','warning','clean','recommend'].every(key=>qc.some(row=>row.check_key===key&&row.checked)),payment_checked=qc_done&&Number(order.balance)<=.01
 const procedures_done=procedures.every(p=>['pre','steps','qc'].every(key=>(p[key]||[]).every((_,i)=>p.progress?.[`${key}:${i}`])))
 return {diagnosis_documented,customer_approved,parts_documented,work_logged,qc_done,payment_checked,release_notes_done:payment_checked&&Boolean(notes.release_notes),procedures_present:procedures.length>0,procedures_done}
}
