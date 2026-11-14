import React,{useEffect,useRef,useState} from 'react'
import {VehiclePhoto} from './vehicle-photo.jsx'
import {Icon,StatusBadge} from './ui.jsx'
import {MetricCard,PageIntro} from './design-system.jsx'
import {effectiveHourlyRate,workLogTimestamp} from './workshop-metrics.mjs'

const moneyFormatter=new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',maximumFractionDigits:0})
const money=n=>moneyFormatter.format(Number(n||0))
const stages=[['PRZYJETE','Przyjęte'],['DIAGNOZA','Diagnoza'],['WYCENA','Wycena'],['AKCEPTACJA','Akceptacja'],['NAPRAWA','Naprawa'],['QC_NAPRAWY','Kontrola naprawy'],['QC_WYDANIA','Kontrola wydania'],['PLATNOSC','Płatność'],['GOTOWE','Gotowe']]
const labels=Object.fromEntries([...stages,['WYDANE','Wydane']])
const waits={KLIENT:'Kontakt z klientem',CZESCI:'Oczekiwanie na części',DECYZJA:'Decyzja klienta'}

function Counter({value}){
 const [shown,setShown]=useState(value),shownRef=useRef(Number(value)||0)
 useEffect(()=>{
  const target=Number(value)||0,from=shownRef.current
  if(target===from)return
  if(document.hidden||window.matchMedia('(prefers-reduced-motion: reduce)').matches){shownRef.current=target;setShown(target);return}
  let frame;const start=performance.now()
  const tick=t=>{const p=Math.min(1,(t-start)/700),next=Math.round(from+(target-from)*(1-Math.pow(1-p,3)));shownRef.current=next;setShown(next);if(p<1)frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[value])
 return shown
}

export function WorkshopDashboard({api,go,openOrder,scanDocument,refresh}){
 const [data,setData]=useState(null),[target,setTarget]=useState(50000),[error,setError]=useState(''),[filter,setFilter]=useState('ALL'),[retry,setRetry]=useState(0)
 useEffect(()=>{let alive=true;setError('');Promise.all([api.dashboard(),api.settings?.monthlyTarget?.()||Promise.resolve(50000)]).then(([d,t])=>{if(alive){setData(d);setTarget(Number(t)||50000)}}).catch(e=>alive&&setError(e.message||String(e)));return()=>{alive=false}},[api,retry,refresh])
 if(error)return <div className="empty"><p>Nie udało się wczytać pulpitu: {error}</p><button onClick={()=>setRetry(x=>x+1)}>Spróbuj ponownie</button></div>
 if(!data)return <div className="studioSkeleton" aria-label="Ładowanie pulpitu" role="status"><div/><div/><div/></div>
 const revenue=Number(data.month?.revenue||0),cost=Number(data.month?.variableCost||0),hours=Number(data.month?.actualHours||0),productiveRevenue=Number(data.month?.productiveRevenue||0),hourlyRate=effectiveHourlyRate(productiveRevenue,hours),open=Number(data.open||0),attention=Number(data.notificationCount||0)
 const recent=data.recent||[],active=recent.filter(x=>x.status!=='WYDANE'),blocked=active.filter(x=>waits[x.wait_state]),timers=data.active||[]
 const percent=Math.max(0,Math.min(100,Math.round(revenue/target*100))),margin=revenue-cost
 const hasMeasuredHours=hourlyRate!==null,maxSource=Math.max(...(data.sources||[]).map(x=>Number(x.c)),1)
 const stageCounts=Object.fromEntries(stages.map(([stage])=>[stage,Number(data.status?.find(row=>row.status===stage)?.c||0)])),maxStage=Math.max(...Object.values(stageCounts),1)
 const visible=filter==='ALL'?recent:recent.filter(o=>o.status===filter)
 return <section className="studioDashboard">
  <PageIntro eyebrow="TWÓJ WARSZTAT · W JEDNYM MIEJSCU" title="Dobry plan na każdy dzień" actions={<button className="studioDocumentScan" title="Odczytaj części, ilości i ceny ze zdjęcia faktury / WZ i przyjmij dostawę do magazynu" onClick={scanDocument}><Icon name="documents"/> Skanuj dokument</button>}><p className="dashSummary"><b><Counter value={open}/></b> aut w warsztacie · obrót {new Date().toLocaleDateString('pl-PL',{month:'long'})} <b>{money(revenue)}</b> ({percent}% celu)</p></PageIntro>
  <div className="studioKpis">
   {[['car','Otwarte zlecenia',open,`${Number(data.today||0)} przyjętych dzisiaj`,'orders'],['notifications','Wymaga uwagi',attention,'Klient, części lub decyzja','notifications'],['finance','Marża brutto',money(margin),`${revenue?Math.round(margin/revenue*100):0}% obrotu miesiąca`,'finance'],['reminders','Efektywna godzina',hasMeasuredHours?money(hourlyRate):'—',hasMeasuredHours?`${hours.toFixed(1)} h · robocizna i usługi`:hours?'Zbieranie co najmniej 15 min pracy…':'Uruchom timer w zleceniu','finance']].map(([icon,title,value,sub,page],i)=><MetricCard key={title} icon={icon} title={title} value={typeof value==='number'?<Counter value={value}/>:value} description={sub} tone={i===1&&attention?'warning':'default'} onClick={()=>go(page)}/>)}
  </div>
  <div className="studioOverview">
   <section className="studioPanel flowPanel" aria-labelledby="flowTitle">
    <div className="studioPanelHead"><div><h3 id="flowTitle">Przepływ zleceń</h3><span className="flowHint">Ile aut jest na każdym etapie · kliknij etap, aby przefiltrować listę</span></div><button className="studioTextButton" onClick={()=>go('kanban')}>Workflow <Icon name="arrow" size={16}/></button></div>
    <div className="flowBars" role="group" aria-label="Etapy zleceń">{stages.map(([s,label],i)=><button key={s} className={'flowStage '+(filter===s?'selected':'')} aria-pressed={filter===s} onClick={()=>setFilter(filter===s?'ALL':s)} style={{'--h':Math.max(.06,stageCounts[s]/maxStage),'--i':i}}><span className="flowLabel">{String(i+1).padStart(2,'0')} · {label}</span><strong>{stageCounts[s]}</strong><span className="flowTrack"><i/></span></button>)}</div>
   </section>
   <div className="studioGoal"><div className="studioPanelTitle"><span>WYNIK MIESIĄCA</span><button className="iconButton" aria-label="Otwórz finanse" onClick={()=>go('finance')}><Icon name="arrow"/></button></div><div className="goalAmount">{money(revenue)}</div><span className="goalCaption">Obrót · {new Date().toLocaleDateString('pl-PL',{month:'long'})}</span><div className="goalVisual"><svg viewBox="0 0 200 110" aria-hidden="true"><defs><linearGradient id="analyticsGoalGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#a3203f"/><stop offset="1" stopColor="#ff8fab"/></linearGradient></defs><path className="goalArcTrack" d="M15 98a85 85 0 0 1 170 0"/><path className="goalArcValue" d="M15 98a85 85 0 0 1 170 0" pathLength="100" strokeDasharray={`${percent} 100`}/></svg><div><strong><Counter value={percent}/><small>%</small></strong><span>celu miesięcznego</span></div></div><div className="goalTarget"><span>Cel warsztatu</span><b>{money(target)}</b></div><div className="goalBottom"><Icon name="bolt"/><span>{percent===100?'Cel osiągnięty. Dobra robota!':`Jeszcze ${money(Math.max(0,target-revenue))} do celu`}</span></div></div>
  </div>
  <div className="studioWorkGrid"><div className="studioWorkMain">
   <section className="studioPanel"><div className="studioPanelHead"><div><span className="sectionEyebrow">OPERACJE</span><h3>Zlecenia w warsztacie <span className="countBadge">{open}</span></h3></div><button className="studioTextButton" onClick={()=>go('orders')}>Wszystkie <Icon name="arrow" size={16}/></button></div><div className="studioFilters" role="group" aria-label="Filtruj ostatnie zlecenia">{[['ALL','Wszystkie'],...stages].map(([s,l])=><button key={s} aria-pressed={filter===s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{l}</button>)}</div><div className="studioOrderList"><div className="studioOrderLabels"><span>Pojazd / zlecenie</span><span>Status</span><span>Wartość</span><span/></div>{visible.length?visible.slice(0,6).map(o=><button className="studioOrder" key={o.id} onClick={()=>openOrder(o.id)}><div className="studioVehicle"><VehiclePhoto vehicle={o} size="small"/><div><b>{o.plate||`#${o.id}`} <span>{o.make} {o.model}</span></b><small>{o.title}</small></div></div><StatusBadge status={o.status} label={labels[o.status]||o.status}/><strong>{money(o.total)}</strong><Icon name="chevron" size={16}/></button>):<div className="studioEmpty"><Icon name="car" size={28}/><b>Tu jest miejsce na kolejne auto</b><span>{filter==='ALL'?'Przyjmij pojazd, aby rozpocząć pracę.':'Brak ostatnich zleceń na tym etapie.'}</span><button className="studioTextButton" onClick={()=>filter==='ALL'?go('intake'):setFilter('ALL')}>{filter==='ALL'?'Przyjmij pojazd':'Pokaż wszystkie'} <Icon name="arrow"/></button></div>}</div><div className="studioTableFoot">Ostatnie zlecenia · kliknij pojazd, aby otworzyć szczegóły</div></section>
   {timers.length>0&&<section className="studioPanel"><div className="studioPanelHead"><h3><span className="studioLiveDot"/> Praca w toku</h3><span className="sectionEyebrow">{timers.length} AKTYWNYCH TIMERÓW</span></div>{timers.map(t=><button className="studioTimer" key={t.id} onClick={()=>openOrder(t.order_id)}><span className="studioEqualizer"><i/><i/><i/><i/></span><div><b>{t.plate} · {t.title}</b><small>Start {new Date(workLogTimestamp(t.started_at)).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</small></div><Icon name="arrow"/></button>)}</section>}
  </div><div className="studioWorkSide">
   <section className="studioPanel"><div className="studioPanelHead"><h3>Wymaga reakcji</h3><span className={'countBadge '+(attention?'amber':'')}>{attention}</span></div>{blocked.length?blocked.slice(0,3).map(o=><button className="studioAttention" key={o.id} onClick={()=>openOrder(o.id)}><span className="attentionIcon"><Icon name={o.wait_state==='CZESCI'?'inventory':'notifications'} size={17}/></span><div><b>{waits[o.wait_state]}</b><span>{o.make} {o.model} · {o.plate||'bez rejestracji'}</span></div><Icon name="chevron" size={14}/></button>):<div className="studioClear"><span><Icon name="check"/></span><div><b>{attention?'Sprawdź centrum uwagi':'Wszystko na dobrej drodze'}</b><small>{attention?'Pozostałe sprawy są w centrum uwagi.':'Ostatnie zlecenia nie mają blokad.'}</small></div></div>}<button className="studioFullButton" onClick={()=>go('notifications')}>Przejdź do centrum uwagi <Icon name="arrow" size={16}/></button></section>
   <section className="studioPanel"><div className="studioPanelHead"><h3>Najbliższe terminy</h3><Icon name="schedule"/></div>{data.next?.length?data.next.slice(0,4).map(a=><button className="studioAppointment" key={a.id} onClick={()=>a.order_id?openOrder(a.order_id):go('schedule')}><div className="appointmentTime"><b>{new Date(a.start_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</b><small>{new Date(a.start_at).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})}</small></div><div><b>{a.plate||a.title}</b><span>{a.plate?a.title:a.bay}</span><small>{a.bay}</small></div></button>):<div className="studioEmpty compact"><Icon name="schedule"/><span>Spokojnie w kalendarzu.<br/>Zaplanuj kolejne przyjęcie.</span></div>}<button className="studioFullButton" onClick={()=>go('schedule')}>Otwórz terminarz <Icon name="arrow" size={16}/></button></section>
   <section className="studioPanel studioSources"><div className="studioPanelHead"><h3>Skąd trafiają klienci?</h3></div>{data.sources?.length?data.sources.map(s=><div className="studioSource" key={s.source}><div><span>{s.source||'Nie określono'}</span><b>{s.c}</b></div><div className="studioSourceTrack"><i style={{width:`${Number(s.c)/maxSource*100}%`}}/></div></div>):<p className="muted">Źródła pojawią się po przyjęciu zleceń.</p>}</section>
  </div></div><div className="studioFooter"><span>AUTOLOGIKA <b>OS</b></span><span>Dobra organizacja. Dobra robota.</span></div>
 </section>
}
