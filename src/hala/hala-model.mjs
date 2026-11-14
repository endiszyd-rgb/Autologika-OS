// Model ekranu „Hala na żywo” (makieta: design/hala/Hala.dc.html).
// Czysta logika prezentacji: składa stanowiska, powitanie, listę spraw i puls dnia
// z danych, które aplikacja już ma (zlecenia, terminarz, timery pracy, „Do uwagi”).
import halaSettings from '../../shared/hala-settings.cjs'
import {attentionMeta,ageLabel} from '../attention-center.mjs'

export const DEFAULT_ACCENT=halaSettings.HALA_ACCENTS[0]
export const ACCENT_OPTIONS=halaSettings.HALA_ACCENTS
export const RING_LENGTH=239

// Kolory „work” biorą akcent z CSS (--hala-accent), żeby zmiana motywu nie wymagała przeliczeń w JS.
export const BAY_KINDS={
 work:{glow:'var(--hala-accent)',chipBg:'color-mix(in srgb,var(--hala-accent) 18%,transparent)',chipFg:'color-mix(in srgb,var(--hala-accent) 70%,#fff)'},
 wait:{glow:'#F5B544',chipBg:'rgba(245,181,68,.18)',chipFg:'#F5C86E'},
 done:{glow:'#34D399',chipBg:'rgba(52,211,153,.18)',chipFg:'#6EE7B7'},
 free:{glow:'rgba(255,255,255,.28)',chipBg:'rgba(255,255,255,.07)',chipFg:'#9C7F89'}
}

// Ta sama kolejność etapów co w Workshop LIVE
export const ORDER_STAGES=['PRZYJETE','DIAGNOZA','WYCENA','AKCEPTACJA','NAPRAWA','QC_NAPRAWY','QC_WYDANIA','PLATNOSC','GOTOWE']
const WAIT_LABELS={CZESCI:'czeka na części',KLIENT:'czeka na klienta',DECYZJA:'czeka na decyzję'}
const BODY_COLORS=['#C7CBD4','#2B2F3A','#8A1C2B','#3B5B7A','#D9D4C7','#4A4F57','#6B2737']

export const NEWS_CATEGORIES=[['ALL','Wszystko'],['PRZEPISY','Przepisy'],['TUNING','Tuning'],['CZESCI','Części']]

const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0))
export const easeOutCubic=t=>1-Math.pow(1-clamp01(t),3)
const text=value=>String(value??'').trim()
// SQLite CURRENT_TIMESTAMP („2026-11-14 09:00:00”) jest w UTC bez strefy — dopisujemy Z
const SQLITE_UTC=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/
const toDate=value=>{if(value==null||value==='')return null;const date=value instanceof Date?value:new Date(SQLITE_UTC.test(value)?`${value.replace(' ','T')}Z`:value);return Number.isNaN(date.getTime())?null:date}
const sameDay=(a,b)=>a&&b&&a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate()
const hash=value=>[...String(value||'')].reduce((sum,char)=>(sum*31+char.charCodeAt(0))>>>0,7)

const clockFormat=new Intl.DateTimeFormat('pl-PL',{hour:'2-digit',minute:'2-digit'})
const dayFormat=new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long'})
const shortDayFormat=new Intl.DateTimeFormat('pl-PL',{weekday:'short'})
export const clock=date=>clockFormat.format(date)
export const eyebrowDate=date=>dayFormat.format(date).toLocaleUpperCase('pl-PL')
export const initials=name=>String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join('').toUpperCase()
export const money=value=>Math.round(Number(value)||0).toLocaleString('pl-PL',{useGrouping:'always'})

// „12:40” dziś, „jutro 9:00”, „pt. 13:00”, dalej data
export function whenLabel(value,now=new Date()){
 const date=toDate(value)
 if(!date)return '—'
 if(sameDay(date,now))return clock(date)
 const tomorrow=new Date(now);tomorrow.setDate(now.getDate()+1)
 if(sameDay(date,tomorrow))return `jutro ${clock(date)}`
 const days=(date-now)/86400000
 if(days>0&&days<7)return `${shortDayFormat.format(date)} ${clock(date)}`
 return `${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')}`
}

export function orderProgress(status){
 const index=ORDER_STAGES.indexOf(status)
 if(index<0)return 0
 return Math.round(index/(ORDER_STAGES.length-1)*100)
}

export function orderKind(order){
 if(!order)return'free'
 if(order.wait_state&&order.wait_state!=='BRAK')return'wait'
 if(['GOTOWE','PLATNOSC'].includes(order.status))return'done'
 return'work'
}

// Wygląd stanowiska z jego nazwy w ustawieniach: diagnostyka → skaner, plac → bez podnośnika
export function bayEquipment(name){
 const value=String(name||'')
 const scan=/diagno|tuning|obd|elektr|geometri/i.test(value)
 const yard=/plac|oczek|parking|zewn/i.test(value)
 return{scan,lift:!scan&&!yard}
}

// „Stanowisko 2” → „STANOWISKO 02”; inne nazwy dostają numer z kolejności: „03 · DIAGNOSTYKA”
export function bayLabel(name,index){
 const value=text(name),own=value.match(/^stanowisko\s*(\d+)$/i)
 if(own)return`STANOWISKO ${own[1].padStart(2,'0')}`
 return`${String(index+1).padStart(2,'0')} · ${value.toLocaleUpperCase('pl-PL')}`
}

const vehicleName=row=>[row?.make,row?.model].map(text).filter(Boolean).join(' ')

export function buildBays({bayNames=[],settings={},orders=[],appointments=[],active=[],labels={},now=new Date()}={}){
 const assignments=settings.assignments||{}
 return bayNames.map((name,index)=>{
  const assignment=assignments[halaSettings.bayKey(name)]
  const order=assignment?orders.find(row=>halaSettings.sameOrder(assignment,row)&&row.status!=='WYDANE'&&!row.archived_at):null
  const upcoming=appointments
   .filter(row=>row.bay===name&&toDate(row.start_at)>=now&&!(order&&(String(row.order_id)===String(order.id))))
   .sort((a,b)=>toDate(a.start_at)-toDate(b.start_at))[0]
  const base={
   id:`bay-${index}`,name,
   label:bayLabel(name,index),
   ...bayEquipment(name),
   nextCar:upcoming?[vehicleName(upcoming),upcoming.title||upcoming.order_title].filter(Boolean).join(' · '):'',
   nextAt:upcoming?whenLabel(upcoming.start_at,now):'',
   stale:Boolean(assignment&&!order)
  }
  if(!order)return{...base,kind:'free',free:true,status:'Wolne',car:'Stanowisko wolne',plate:'',job:'Kliknij, aby przypisać zlecenie',pct:0,eta:'—',mech:'',ini:'',story:base.stale?'Przypisane zlecenie zostało wydane lub zarchiwizowane. Wybierz kolejne z Centrum zlecenia.':'Na tym stanowisku nie ma teraz zlecenia. Wybierz je z Centrum zlecenia.',body:'#3A2A30',tail:'#5A3A44',orderId:null}
  const kind=orderKind(order)
  const log=active.find(row=>String(row.order_id)===String(order.id))
  const visit=appointments.filter(row=>String(row.order_id)===String(order.id)).sort((a,b)=>(a.bay===name?0:1)-(b.bay===name?0:1)||toDate(a.start_at)-toDate(b.start_at))[0]
  const statusLabel=labels[order.status]||order.status||'W pracy'
  return{
   ...base,kind,free:false,
   status:kind==='wait'?(WAIT_LABELS[order.wait_state]?`${statusLabel} · ${WAIT_LABELS[order.wait_state]}`:`${statusLabel} · blokada`):statusLabel,
   car:vehicleName(order)||order.title||`Zlecenie #${order.id}`,
   plate:text(order.plate),
   job:text(order.title)||'Zlecenie bez tytułu',
   pct:orderProgress(order.status),
   eta:visit?.end_at?whenLabel(visit.end_at,now):order.due_at?whenLabel(order.due_at,now):'—',
   mech:log?text(log.worker):'',
   ini:log?initials(log.worker):'',
   story:text(order.complaint)||text(order.items_summary)||'Brak opisu usterki w zleceniu.',
   body:BODY_COLORS[hash(order.plate||order.id)%BODY_COLORS.length],
   tail:'#FF5A6E',
   orderId:order.id,
   phone:text(order.phone)
  }
 })
}

export function bayView(bay,{t=1,picked=false}={}){
 const kind=BAY_KINDS[bay.kind]||BAY_KINDS.work
 const pct=Math.max(0,Math.min(100,Number(bay.pct)||0))
 return{
  ...bay,...kind,
  pctValue:pct,
  pctLabel:Math.round(pct*clamp01(t))+'%',
  dash:Math.round(RING_LENGTH-RING_LENGTH*(pct/100)*clamp01(t)),
  carClass:bay.free?'':bay.lift?'halaCarLift':'halaCarIdle',
  carY:bay.lift&&!bay.free?'translate(0,-34)':'translate(0,0)',
  picked
 }
}

export function greeting({settings={},bays=[],orders=[],closedToday=[],now=new Date()}={}){
 const name=text(settings.greetingName)
 const hello=now.getHours()>=18?'Dobry wieczór':'Dzień dobry'
 const busy=bays.filter(bay=>!bay.free).length
 const occupancy=!bays.length?'Brak stanowisk w ustawieniach':busy===0?'Wszystkie stanowiska wolne':busy===bays.length?(bays.length===2?'Oba stanowiska zajęte':'Wszystkie stanowiska zajęte'):`Zajęte ${busy} z ${bays.length} stanowisk`
 const pickup=orders
  .map(row=>toDate(row.due_at))
  .filter(date=>date&&sameDay(date,now)&&date>=now)
  .sort((a,b)=>a-b)[0]
 const revenue=closedToday.reduce((sum,row)=>sum+(Number(row.final_price??row.total??row.calculated_total)||0),0)
 return{
  title:name?`${hello}, ${name}`:hello,
  workshop:(text(settings.workshopName)||'AutoLogika').toLocaleUpperCase('pl-PL'),
  occupancy,
  nextPickup:pickup?clock(pickup):null,
  revenue
 }
}

export function closedOn(orders=[],now=new Date()){
 const seen=new Set()
 return orders.filter(row=>{
  const key=String(row.cloud_id||row.id)
  if(seen.has(key))return false
  seen.add(key)
  return sameDay(toDate(row.closed_at),now)
 })
}

const TONE_BY_META={critical:'rose',decision:'rose',warning:'amber',positive:'green',neutral:'amber'}
const ICON_BY_TONE={rose:'clock',amber:'warning',green:'check'}
const ACTION_TEXT={
 WAIT:row=>`${WAIT_LABELS[row.text]?WAIT_LABELS[row.text][0].toUpperCase()+WAIT_LABELS[row.text].slice(1):'Blokada'}`,
 REPLY:()=>'Klient czeka na odpowiedź',
 PART_LATE:row=>`Spóźniona część: ${text(row.text)}`,
 APPROVAL:row=>row.text==='DECLINED'?'Klient odrzucił kosztorys':'Klient zaakceptował kosztorys',
 VEHICLE_FINDING:row=>text(row.text)||'Usterka do omówienia'
}
// „Co wymaga Ciebie”: najpilniejsze sprawy z modułu „Do uwagi”
export function buildActions(rows=[],{now=Date.now(),limit=3}={}){
 return[...rows]
  .sort((a,b)=>attentionMeta(a).rank-attentionMeta(b).rank||String(a.created_at).localeCompare(String(b.created_at)))
  .slice(0,limit)
  .map((row,index)=>{
   const meta=attentionMeta(row),tone=TONE_BY_META[meta.tone]||'amber'
   const vehicle=[vehicleName(row),text(row.plate)].filter(Boolean).join(' · ')
   return{id:`${row.kind}-${row.order_id||''}-${row.communication_id||''}-${index}`,tone,icon:ICON_BY_TONE[tone],title:`${vehicle||text(row.title)||'Zlecenie'} — ${(ACTION_TEXT[row.kind]||(()=>meta.label))(row)}`,detail:[meta.label,text(row.customer),ageLabel(row.created_at,now)].filter(Boolean).join(' · '),orderId:row.order_id||null}
  })
}

// Puls dnia: obłożenie stanowisk w godzinach pracy (wizyty z terminarza), 0–1 na godzinę
export function buildPulse({appointments=[],bayCount=1,openingHour=8,closingHour=18,now=new Date()}={}){
 const open=Math.max(0,Math.min(23,Number(openingHour)||0)),close=Math.max(open+1,Math.min(24,Number(closingHour)||open+1))
 const capacity=Math.max(1,Number(bayCount)||1)
 const day=new Date(now);day.setHours(0,0,0,0)
 const points=[]
 for(let hour=open;hour<=close;hour++){
  const from=new Date(day);from.setHours(hour)
  const to=new Date(from);to.setHours(hour+1)
  const busy=appointments.filter(row=>{const start=toDate(row.start_at),end=toDate(row.end_at);return start&&end&&start<to&&end>from&&row.status!=='ANULOWANA'}).length
  points.push(Math.min(1,busy/capacity))
 }
 const hourNow=now.getHours()+now.getMinutes()/60
 const nowPos=(hourNow-open)/(close-open)
 const current=points[Math.max(0,Math.min(points.length-1,Math.floor(hourNow)-open))]||0
 const label=hourNow<open||hourNow>close?'Poza godzinami pracy':current>=.9?'Pełne obłożenie':current>=.4?'Tempo dobre':'Spokojnie'
 const tone=current>=.9?'rose':current>=.4?'green':'amber'
 const middle=Math.round((open+close)/2)
 return{points,now:nowPos>=0&&nowPos<=1?nowPos:null,label,tone,axis:[open,middle,close].map(hour=>String(hour).padStart(2,'0'))}
}

// Ścieżka wykresu „Puls dnia” w układzie 400×90 (linia + wypełnienie), oś odwrócona: 1 = góra
export function pulsePaths(points=[],{width=400,height=90,top=8,bottom=70}={}){
 if(points.length<2)return{line:'',area:''}
 const step=width/(points.length-1)
 const coords=points.map((value,index)=>[Math.round(index*step),Math.round(bottom-(bottom-top)*clamp01(value))])
 const line=coords.map(([x,y],index)=>`${index?'L':'M'}${x} ${y}`).join(' ')
 return{line,area:`${line} L${width} ${height} L0 ${height}Z`}
}

// --- Wiadomości --------------------------------------------------------------

const NEWS_TONES={PRZEPISY:'rose',TUNING:'blue',CZESCI:'amber',OGOLNE:'green'}
const NEWS_ICONS={PRZEPISY:'lines',TUNING:'chip',CZESCI:'gear',OGOLNE:'car'}
const newsDate=new Intl.DateTimeFormat('pl-PL',{day:'numeric',month:'short'})
export function newsView(item,now=new Date()){
 const date=toDate(item.publishedAt)
 return{...item,tone:NEWS_TONES[item.category]||'green',icon:NEWS_ICONS[item.category]||'car',date:date?(sameDay(date,now)?'dziś':newsDate.format(date)):''}
}

export function filterNews(items=[],category='ALL'){
 return category==='ALL'?items:items.filter(item=>item.category===category)
}

const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII']
export function rateDate(value){
 const date=toDate(value)
 return date?`${date.getDate()} ${ROMAN[date.getMonth()]}`:''
}

export function tickerItems(feed={}){
 const rates=(feed.rates||[]).map(rate=>({label:`${rate.code}/PLN`,value:rate.mid.toLocaleString('pl-PL',{minimumFractionDigits:4,maximumFractionDigits:4}),note:`NBP ${rateDate(rate.date)}`,noteTone:'muted'}))
 const headlines=(feed.items||[]).slice(0,4).map(item=>({label:item.label||'NEWS',note:item.title,noteTone:'warn'}))
 return[...rates,...headlines]
}

export function refreshedLabel(value){
 const date=toDate(value)
 if(!date)return'brak danych'
 return`odświeżono ${String(date.getDate()).padStart(2,'0')}.${String(date.getMonth()+1).padStart(2,'0')} · ${clock(date)}`
}
