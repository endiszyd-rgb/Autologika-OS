import React,{useEffect,useState} from 'react'
import {Icon} from './ui.jsx'

const money=n=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',maximumFractionDigits:0}).format(Number(n||0))
const stages=[['PRZYJETE','Przyjęte'],['DIAGNOZA','Diagnoza'],['AKCEPTACJA','Akceptacja'],['NAPRAWA','Naprawa'],['GOTOWE','Gotowe']]
const labels=Object.fromEntries([...stages,['WYDANE','Wydane']])
const waits={KLIENT:'Kontakt z klientem',CZESCI:'Oczekiwanie na części',DECYZJA:'Decyzja klienta'}
const positions=[[27,29],[74,35],[34,72],[71,76],[49,17],[18,51],[84,57],[52,86]]

function Counter({value}){
 const [shown,setShown]=useState(value)
 useEffect(()=>{
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){setShown(value);return}
  let frame;const start=performance.now()
  const tick=t=>{const p=Math.min(1,(t-start)/700);setShown(Math.round(value*(1-Math.pow(1-p,3))));if(p<1)frame=requestAnimationFrame(tick)}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[value])
 return shown
}

export function WorkshopDashboard({api,go,openOrder}){
 const [data,setData]=useState(null),[target,setTarget]=useState(50000),[error,setError]=useState(''),[filter,setFilter]=useState('ALL'),[retry,setRetry]=useState(0)
 useEffect(()=>{let alive=true;setError('');Promise.all([api.dashboard(),api.settings?.monthlyTarget?.()||Promise.resolve(50000)]).then(([d,t])=>{if(alive){setData(d);setTarget(Number(t)||50000)}}).catch(e=>alive&&setError(e.message||String(e)));return()=>{alive=false}},[api,retry])
 if(error)return <div className="empty"><p>Nie udało się wczytać pulpitu: {error}</p><button onClick={()=>setRetry(x=>x+1)}>Spróbuj ponownie</button></div>
 if(!data)return <div className="studioSkeleton" aria-label="Ładowanie pulpitu" role="status"><div/><div/><div/></div>
 const revenue=Number(data.month?.revenue||0),cost=Number(data.month?.variableCost||0),hours=Number(data.month?.actualHours||0),open=Number(data.open||0),attention=Number(data.notificationCount||0)
 const recent=data.recent||[],active=recent.filter(x=>x.status!=='WYDANE'),blocked=active.filter(x=>waits[x.wait_state]),timers=data.active||[]
 const percent=Math.max(0,Math.min(100,Math.round(revenue/target*100))),margin=revenue-cost
 const hasMeasuredHours=hours>=1/60
 const visible=filter==='ALL'?recent:recent.filter(o=>o.status===filter)
 return <section className="studioDashboard">
  <div className="studioHeading"><div><div className="sectionEyebrow">TWÓJ WARSZTAT. JEDEN WIDOK.</div><h2>Dobry dzień na <span>dobrą robotę.</span></h2><p>Wszystko, czego potrzebujesz, żeby utrzymać tempo.</p></div><button className="primary studioIntake" onClick={()=>go('intake')}><Icon name="intake"/> Przyjmij pojazd</button></div>
  <div className="studioOverview">
   <div className="studioRadarPanel">
    <div className="radarIntro"><div className="sectionEyebrow"><span className="studioLiveDot"/> RADAR WARSZTATU</div><h3>Każde auto.<br/>Na Twoim radarze.</h3><p>Od pierwszej diagnozy<br/>do ostatniej kontroli.</p><button className="studioTextButton" onClick={()=>go('kanban')}>Otwórz przepływ <Icon name="arrow"/></button><div className="radarLegend"><span><i/>W warsztacie</span><span><i/>Wymaga reakcji</span></div></div>
    <div className="studioRadar" role="group" aria-label="Radar ostatnich aktywnych zleceń">
     <div className="radarCross horizontal"/><div className="radarCross vertical"/>
     <div className="studioRing outer"/><div className="studioRing middle"/><div className="studioRing inner"/><div className="studioSweep"/>
     <span className="radarBearing north">000</span><span className="radarBearing east">090</span><span className="radarBearing south">180</span><span className="radarBearing west">270</span>
     <div className="studioRadarCore"><Icon name="car" size={22}/><strong><Counter value={open}/></strong><span>OTWARTYCH ZLECEŃ</span></div>
     {active.slice(0,8).map((o,i)=><button key={o.id} className={'studioBlip '+(waits[o.wait_state]?'blocked':'')} style={{left:positions[i][0]+'%',top:positions[i][1]+'%','--delay':`${i*-.6}s`}} onClick={()=>openOrder(o.id)} aria-label={`Otwórz ${o.plate||'zlecenie '+o.id}: ${o.title}`}><i/><span>{o.plate||`#${o.id}`}</span><div className="radarTooltip"><b>{o.make} {o.model}</b><small>{waits[o.wait_state]||labels[o.status]}</small></div></button>)}
    </div>
    <div className="radarPanelFooter"><span><i className="studioLiveDot"/>Dane z bazy warsztatu</span><span>{active.length>8?'8 ostatnich aut na radarze':`${Math.min(active.length,8)} aut na radarze`}</span></div>
   </div>
   <div className="studioGoal"><div className="studioPanelTitle"><span>WYNIK MIESIĄCA</span><button className="iconButton" aria-label="Otwórz finanse" onClick={()=>go('finance')}><Icon name="arrow"/></button></div><div className="goalAmount">{money(revenue)}</div><span className="goalCaption">Obrót · {new Date().toLocaleDateString('pl-PL',{month:'long'})}</span><div className="goalVisual"><svg viewBox="0 0 200 110" aria-hidden="true"><path className="goalArcTrack" d="M15 98a85 85 0 0 1 170 0"/><path className="goalArcValue" d="M15 98a85 85 0 0 1 170 0" pathLength="100" strokeDasharray={`${percent} 100`}/></svg><div><strong><Counter value={percent}/><small>%</small></strong><span>celu miesięcznego</span></div></div><div className="goalTarget"><span>Cel warsztatu</span><b>{money(target)}</b></div><div className="goalBottom"><Icon name="bolt"/><span>{percent===100?'Cel osiągnięty. Dobra robota!':`Jeszcze ${money(Math.max(0,target-revenue))} do celu`}</span></div></div>
  </div>
  <div className="studioKpis">
   {[['car','Otwarte zlecenia',open,`${Number(data.today||0)} przyjętych dzisiaj`,'orders'],['notifications','Wymaga uwagi',attention,'Klient, części lub decyzja','notifications'],['finance','Marża brutto',money(margin),`${revenue?Math.round(margin/revenue*100):0}% obrotu miesiąca`,'finance'],['reminders','Efektywna godzina',hasMeasuredHours?money(revenue/hours):'—',hasMeasuredHours?`${hours.toFixed(1)} h zarejestrowanej pracy`:hours?'Zbieranie czasu pracy…':'Uruchom timer w zleceniu','finance']].map(([icon,title,value,sub,page],i)=><button className={'studioKpi '+(i===1&&attention?'warning':'')} key={title} onClick={()=>go(page)}><div className="kpiTop"><span>{title}</span><Icon name={icon}/></div><strong>{typeof value==='number'?<Counter value={value}/>:value}</strong><div className="kpiBottom"><span>{sub}</span><Icon name="arrow" size={16}/></div></button>)}
  </div>
  <div className="studioWorkGrid"><div className="studioWorkMain">
   <section className="studioPanel"><div className="studioPanelHead"><div><span className="sectionEyebrow">OPERACJE</span><h3>Zlecenia w warsztacie <span className="countBadge">{open}</span></h3></div><button className="studioTextButton" onClick={()=>go('orders')}>Wszystkie <Icon name="arrow" size={16}/></button></div><div className="studioFilters" role="group" aria-label="Filtruj ostatnie zlecenia">{[['ALL','Wszystkie'],...stages].map(([s,l])=><button key={s} aria-pressed={filter===s} className={filter===s?'active':''} onClick={()=>setFilter(s)}>{l}</button>)}</div><div className="studioOrderList"><div className="studioOrderLabels"><span>Pojazd / zlecenie</span><span>Status</span><span>Wartość</span><span/></div>{visible.length?visible.slice(0,6).map(o=><button className="studioOrder" key={o.id} onClick={()=>openOrder(o.id)}><div className="studioVehicle"><div className="vehicleMonogram">{(o.make||'AU').slice(0,2).toUpperCase()}</div><div><b>{o.plate||`#${o.id}`} <span>{o.make} {o.model}</span></b><small>{o.title}</small></div></div><span className={'tag '+String(o.status).toLowerCase()}>{labels[o.status]||o.status}</span><strong>{money(o.total)}</strong><Icon name="chevron" size={16}/></button>):<div className="studioEmpty"><Icon name="car" size={28}/><b>Tu jest miejsce na kolejne auto</b><span>{filter==='ALL'?'Przyjmij pojazd, aby rozpocząć pracę.':'Brak ostatnich zleceń na tym etapie.'}</span><button className="studioTextButton" onClick={()=>filter==='ALL'?go('intake'):setFilter('ALL')}>{filter==='ALL'?'Przyjmij pojazd':'Pokaż wszystkie'} <Icon name="arrow"/></button></div>}</div><div className="studioTableFoot">Ostatnie zlecenia · kliknij pojazd, aby otworzyć szczegóły</div></section>
   <section className="studioPanel studioFlow"><div className="studioPanelHead"><h3>Rytm warsztatu</h3><button className="studioTextButton" onClick={()=>go('kanban')}>Workflow <Icon name="arrow" size={16}/></button></div><div className="studioStages">{stages.map(([s,label],i)=><button key={s} onClick={()=>setFilter(s)} className={filter===s?'selected':''}><div><span className={'stageDot '+s.toLowerCase()}/><small>{String(i+1).padStart(2,'0')}</small></div><strong>{data.status?.find(x=>x.status===s)?.c||0}</strong><span>{label}</span></button>)}</div></section>
   {timers.length>0&&<section className="studioPanel"><div className="studioPanelHead"><h3><span className="studioLiveDot"/> Praca w toku</h3><span className="sectionEyebrow">{timers.length} AKTYWNYCH TIMERÓW</span></div>{timers.map(t=><button className="studioTimer" key={t.id} onClick={()=>openOrder(t.order_id)}><span className="studioEqualizer"><i/><i/><i/><i/></span><div><b>{t.plate} · {t.title}</b><small>Start {new Date(t.started_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</small></div><Icon name="arrow"/></button>)}</section>}
  </div><div className="studioWorkSide">
   <section className="studioPanel"><div className="studioPanelHead"><h3>Wymaga reakcji</h3><span className={'countBadge '+(attention?'amber':'')}>{attention}</span></div>{blocked.length?blocked.slice(0,3).map(o=><button className="studioAttention" key={o.id} onClick={()=>openOrder(o.id)}><span className="attentionIcon"><Icon name={o.wait_state==='CZESCI'?'inventory':'notifications'} size={17}/></span><div><b>{waits[o.wait_state]}</b><span>{o.plate} · {o.make} {o.model}</span></div><Icon name="chevron" size={14}/></button>):<div className="studioClear"><span><Icon name="check"/></span><div><b>{attention?'Sprawdź centrum uwagi':'Wszystko na dobrej drodze'}</b><small>{attention?'Pozostałe sprawy są w centrum uwagi.':'Ostatnie zlecenia nie mają blokad.'}</small></div></div>}<button className="studioFullButton" onClick={()=>go('notifications')}>Przejdź do centrum uwagi <Icon name="arrow" size={16}/></button></section>
   <section className="studioPanel"><div className="studioPanelHead"><h3>Najbliższe terminy</h3><Icon name="schedule"/></div>{data.next?.length?data.next.slice(0,4).map(a=><button className="studioAppointment" key={a.id} onClick={()=>a.order_id?openOrder(a.order_id):go('schedule')}><div className="appointmentTime"><b>{new Date(a.start_at).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'})}</b><small>{new Date(a.start_at).toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'})}</small></div><div><b>{a.plate||a.title}</b><span>{a.plate?a.title:a.bay}</span><small>{a.bay}</small></div></button>):<div className="studioEmpty compact"><Icon name="schedule"/><span>Spokojnie w kalendarzu.<br/>Zaplanuj kolejne przyjęcie.</span></div>}<button className="studioFullButton" onClick={()=>go('schedule')}>Otwórz terminarz <Icon name="arrow" size={16}/></button></section>
   <section className="studioPanel studioSources"><div className="studioPanelHead"><h3>Skąd trafiają klienci?</h3></div>{data.sources?.length?data.sources.map(s=><div className="studioSource" key={s.source}><div><span>{s.source||'Nie określono'}</span><b>{s.c}</b></div><div className="studioSourceTrack"><i style={{width:`${Number(s.c)/Math.max(...data.sources.map(x=>Number(x.c)),1)*100}%`}}/></div></div>):<p className="muted">Źródła pojawią się po przyjęciu zleceń.</p>}</section>
  </div></div><div className="studioFooter"><span>AUTOLOGIKA <b>OS</b></span><span>Dobra organizacja. Dobra robota.</span></div>
 </section>
}
