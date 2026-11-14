import React,{useEffect,useId,useMemo,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useHala,useNewsFeed} from './use-hala.js'
import {DEFAULT_ACCENT,NEWS_CATEGORIES,RING_LENGTH,clock,eyebrowDate,filterNews,money,newsView,pulsePaths,refreshedLabel,tickerItems} from './hala-model.mjs'
import './hala.css'

// Ikony stroke z makiety (bez emoji)
const ICONS={
 scan:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
 plus:<path d="M12 5v14M5 12h14"/>,
 sms:<path d="M4 5h16v11H8l-4 4z"/>,
 lines:<path d="M4 7h16M4 12h16M4 17h10"/>,
 gear:<><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></>,
 car:<><path d="M3 13l2-5h14l2 5v6H3z"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/></>,
 chip:<><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>,
 warning:<><path d="M12 3l10 18H2z"/><path d="M12 10v4M12 18h.01"/></>,
 clock:<><path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/></>,
 check:<path d="M5 12l5 5L20 7"/>,
 refresh:<><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
 search:<><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></>
}
const Glyph=({name,size=20,width=2})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[name]}</svg>

export function HalaPage({api,go,openOrder,scanDocument,labels,refresh}){
 const hala=useHala({api,labels,refresh})
 const[pickerBay,setPickerBay]=useState(null)
 const[notice,setNotice]=useState('')
 const accent=hala.settings.accent||DEFAULT_ACCENT
 const openJob=id=>id?openOrder?.(id):go?.('center')
 const pickBay=(bay,index)=>{hala.pick(index);if(bay.free)setPickerBay(bay.name)}
 const assign=async(bayName,order)=>{
  try{await hala.assign(bayName,order);setPickerBay(null);setNotice(order?`Przypisano zlecenie do: ${bayName}`:`Zwolniono: ${bayName}`)}
  catch(error){setNotice(`Nie udało się zapisać stanowiska: ${error?.message||error}`)}
 }
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer)},[notice])
 const revenue=money(hala.hello.revenue*hala.t)
 return <div id="hala" className="halaPage" style={{'--hala-accent':accent}}>
  <div className="halaGridBg" aria-hidden="true"/>
  <div className="halaHeader halaRise">
   <div className="halaGreeting">
    <div className="halaEyebrow"><span className="halaDot" aria-hidden="true"/>{hala.hello.workshop} · {eyebrowDate(hala.now)} · {clock(hala.now)}</div>
    <h2>{hala.hello.title}</h2>
    <p>{hala.hello.occupancy}{hala.hello.nextPickup&&<> · najbliższy odbiór o <span className="halaMono">{hala.hello.nextPickup}</span></>} · obrót dziś <span className="halaMono">{revenue} zł</span></p>
   </div>
   <div className="halaHeaderActions">
    <button className="halaBtn halaScanDocument" type="button" onClick={()=>scanDocument?.()}><Glyph name="scan" size={16}/>Skanuj dokument</button>
    <button className="halaBtn halaPrimary" type="button" onClick={()=>go?.('intake')}><Glyph name="plus" size={16} width={2.4}/>Przyjmij auto</button>
   </div>
  </div>
  {hala.error&&<div className="halaAlert" role="alert"><span>{hala.error}</span><button className="halaBtn" type="button" onClick={hala.reload}><Glyph name="refresh" size={16}/>Spróbuj ponownie</button></div>}
  <p className="visuallyHidden" role="status" aria-live="polite">{notice}</p>
  {notice&&<div className="halaToast" aria-hidden="true">{notice}</div>}
  <section className="halaGrid">
   <BayMap bays={hala.bays} loading={hala.loading&&!hala.updated} pick={pickBay} goSettings={()=>go?.('settings')}/>
   <BayDetails bay={hala.selected} api={api} workshop={hala.hello.workshop} openJob={openJob} choose={name=>setPickerBay(name)} release={name=>assign(name,null)}/>
   <NewsFeed api={api}/>
   <ActionList actions={hala.actions} total={hala.attentionCount} pulse={hala.pulse} openJob={openJob} openAll={()=>go?.('notifications')}/>
  </section>
  {pickerBay&&<OrderPicker accent={accent} bayName={pickerBay} orders={hala.orders} bays={hala.bays} labels={labels} close={()=>setPickerBay(null)} choose={order=>assign(pickerBay,order)} goIntake={()=>{setPickerBay(null);go?.('intake')}}/>}
 </div>
}

function BayMap({bays,loading,pick,goSettings}){
 return <div className="halaPanel halaBayMap halaRise d1">
  <div className="halaRadar" aria-hidden="true"/>
  <div className="halaPanelHead">
   <div><h3>Hala</h3><p>Kliknij stanowisko — szczegóły po prawej, wolne przypiszesz do zlecenia</p></div>
   <div className="halaLegend"><span><i style={{background:'var(--hala-accent)'}}/>W pracy</span><span><i style={{background:'#F5B544'}}/>Czeka</span><span><i style={{background:'#34D399'}}/>Gotowe</span></div>
  </div>
  <div className="halaBays" aria-busy={loading}>
   {loading?[0,1].map(index=><span key={index} className="halaBay halaBaySkeleton" aria-hidden="true"/>):bays.map((bay,index)=><button key={bay.id} className={'halaBay'+(bay.picked?' picked':'')+(bay.free?' free':'')} type="button" aria-pressed={bay.picked} aria-label={bay.free?`${bay.label}: wolne, przypisz zlecenie`:`${bay.label}: ${bay.car} ${bay.plate}, ${bay.status}, ${bay.pctLabel}, koniec ${bay.eta}`} onClick={()=>pick(bay,index)} style={{'--bay-glow':bay.glow}}>
    <span className="halaBayTop"><span className="halaMono">{bay.label}</span><span className="halaChip" style={{background:bay.chipBg,color:bay.chipFg}}>{bay.status}</span></span>
    <span className="halaFloor" aria-hidden="true"/>
    {bay.scan&&!bay.free&&<span className="halaScanline" aria-hidden="true"/>}
    <span className="halaBayStage">{bay.free?<span className="halaBayEmpty"><Glyph name="plus" size={26} width={2.2}/><em>Przypisz zlecenie</em></span>:<BayCar bay={bay}/>}</span>
    <span className="halaBayFoot">
     <span><b>{bay.car}</b><small>{bay.free?bay.job:[bay.plate,bay.job].filter(Boolean).join(' · ')}</small></span>
     {!bay.free&&<span className="halaBayPct"><strong className="halaMono">{bay.pctLabel}</strong><small>koniec {bay.eta}</small></span>}
    </span>
    <span className="halaBayBar" aria-hidden="true"><i style={{width:bay.pctLabel}}/></span>
   </button>)}
  </div>
  {!loading&&<button type="button" className="halaLink" onClick={goSettings}>Liczbę i nazwy stanowisk zmienisz w Ustawieniach → Organizacja warsztatu</button>}
 </div>
}

// Profil auta z makiety (SVG 300×170); podnośnik i unoszenie dla stanowiska z liftem
function BayCar({bay}){
 const shine='hala-shine'+useId().replace(/:/g,'')
 const body='M36 112 L44 86 Q70 78 100 74 L126 48 Q140 40 170 40 L206 42 Q222 44 236 60 L250 80 Q272 84 272 100 L272 112 Q272 120 262 120 L46 120 Q36 120 36 112 Z'
 return <svg className="halaCar" viewBox="0 0 300 170" aria-hidden="true" focusable="false">
  {bay.lift&&<g>
   <rect x="40" y="10" width="10" height="150" rx="3" fill="#2A1119"/><rect x="250" y="10" width="10" height="150" rx="3" fill="#2A1119"/>
   <rect x="40" y="10" width="10" height="150" rx="3" fill="none" stroke="rgba(255,255,255,.12)"/><rect x="250" y="10" width="10" height="150" rx="3" fill="none" stroke="rgba(255,255,255,.12)"/>
  </g>}
  {/* W makiecie animacja CSS nadpisywała atrybut transform, więc auto nie było uniesione.
      Tu przesunięcie i animacja są na osobnych grupach: auto stoi na ramionach podnośnika. */}
  <g transform={bay.carY}><g className={bay.carClass}>
   {bay.lift&&<g><rect x="50" y="118" width="200" height="8" rx="3" style={{fill:bay.glow}} opacity=".85"/><rect x="60" y="126" width="30" height="5" rx="2" fill="#3A1A24"/><rect x="210" y="126" width="30" height="5" rx="2" fill="#3A1A24"/></g>}
   <ellipse cx="150" cy="142" rx="110" ry="6" fill="rgba(0,0,0,.55)"/>
   <path d={body} fill={bay.body}/>
   <path d={body} fill={`url(#${shine})`} opacity=".35"/>
   <path d="M130 52 Q142 46 168 46 L200 48 Q212 50 224 62 L236 78 L132 78 Z" fill="#0E0B14" opacity=".9"/>
   <path d="M134 56 Q144 50 166 50 L176 50 L176 76 L136 76 Z" fill="rgba(255,255,255,.14)"/>
   <path d="M184 50 L200 51 Q210 53 222 64 L232 76 L184 76 Z" fill="rgba(255,255,255,.1)"/>
   <rect x="150" y="84" width="40" height="3" rx="1.5" fill="rgba(0,0,0,.35)"/>
   <rect x="40" y="90" width="26" height="9" rx="4" fill="#FFF3B0" opacity=".95"/>
   <rect x="254" y="92" width="18" height="8" rx="4" fill={bay.tail}/>
   <rect x="30" y="108" width="240" height="4" rx="2" fill="rgba(0,0,0,.25)"/>
   <circle cx="86" cy="118" r="22" fill="#120A0E"/><circle cx="86" cy="118" r="13" fill="#2C2731"/><circle cx="86" cy="118" r="5" fill="#6B6470"/>
   <circle cx="220" cy="118" r="22" fill="#120A0E"/><circle cx="220" cy="118" r="13" fill="#2C2731"/><circle cx="220" cy="118" r="5" fill="#6B6470"/>
  </g></g>
  <defs><linearGradient id={shine} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#fff"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient></defs>
 </svg>
}

function BayDetails({bay,api,workshop,openJob,choose,release}){
 if(!bay)return <section className="halaPanel halaDetails halaRise d2"><p className="halaMuted">Wczytuję stanowiska…</p></section>
 const sms=()=>api?.system?.openSms?.(bay.phone,`Dzień dobry, ${workshop}: ${bay.car} ${bay.plate} — ${bay.status.toLocaleLowerCase('pl-PL')}.`)
 return <section className="halaPanel halaDetails halaRise d2" aria-label={`Szczegóły: ${bay.label}`} style={{'--bay-glow':bay.glow}}>
  <div className="halaSparkle" aria-hidden="true"/><div className="halaSparkle late" aria-hidden="true"/>
  <div className="halaEyebrow plain">{bay.label}</div>
  <div className="halaDetailsCar">{bay.car}</div>
  <div className="halaChips">{bay.plate&&<span className="halaChip halaMono plate">{bay.plate}</span>}<span className="halaChip" style={{background:bay.chipBg,color:bay.chipFg}}>{bay.status}</span></div>
  <p className="halaStory">{bay.story}</p>
  {!bay.free&&<div className="halaProgress">
   <svg width="92" height="92" viewBox="0 0 92 92" role="img" aria-label={`Postęp zlecenia ${bay.pctLabel}`}>
    <circle cx="46" cy="46" r="38" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="8"/>
    <circle className="halaRing" cx="46" cy="46" r="38" fill="none" strokeWidth="8" strokeLinecap="round" strokeDasharray={RING_LENGTH} strokeDashoffset={bay.dash} transform="rotate(-90 46 46)"/>
    <text x="46" y="51" textAnchor="middle" className="halaRingText">{bay.pctLabel}</text>
   </svg>
   <div>
    <small>Mechanik</small>
    <div className="halaMechanic">{bay.mech?<><span aria-hidden="true">{bay.ini}</span><b>{bay.mech}</b></>:<em>nikt nie ma włączonego timera</em>}</div>
    <small>Szacowany koniec</small>
    <strong className="halaMono">{bay.eta}</strong>
   </div>
  </div>}
  <div className="halaNext"><small>NASTĘPNE NA TO STANOWISKO</small>{bay.nextCar?<div><b>{bay.nextCar}</b><span className="halaMono">{bay.nextAt}</span></div>:<div><span className="halaMuted">Brak wizyt w terminarzu na najbliższy tydzień</span></div>}</div>
  {bay.free?<div className="halaDetailsActions">
   <button className="halaBtn halaPrimary grow" type="button" onClick={()=>choose(bay.name)}><Glyph name="plus" size={16} width={2.4}/>Przypisz zlecenie</button>
  </div>:<>
   <div className="halaDetailsActions">
    <button className="halaBtn halaPrimary grow" type="button" onClick={()=>openJob(bay.orderId)}>Otwórz zlecenie</button>
    <button className="halaBtn icon" type="button" aria-label="Wyślij SMS do klienta" title={bay.phone?`SMS do klienta (${bay.phone})`:'Brak numeru telefonu klienta'} disabled={!bay.phone} onClick={sms}><Glyph name="sms" size={18}/></button>
   </div>
   <div className="halaDetailsSecondary"><button type="button" className="halaLink" onClick={()=>choose(bay.name)}>Zmień zlecenie</button><button type="button" className="halaLink" onClick={()=>release(bay.name)}>Zwolnij stanowisko</button></div>
  </>}
 </section>
}

const normalize=value=>String(value||'').toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[̀-ͯ]/g,'')
function OrderPicker({accent,bayName,orders,bays,labels={},close,choose,goIntake}){
 const[query,setQuery]=useState(''),[busy,setBusy]=useState(false)
 const dialog=useRef(null),input=useRef(null)
 const titleId=useId()
 const latest=useRef({close,busy});latest.current={close,busy}
 useEffect(()=>{
  const previous=document.activeElement
  input.current?.focus()
  const key=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(!latest.current.busy)latest.current.close();return}
   // skróty aplikacji (np. Ctrl+K) nie działają pod otwartym oknem
   if(event.ctrlKey||event.metaKey){event.stopImmediatePropagation()}
   // fokus zostaje w oknie (Tab z ostatniego elementu wraca na pierwszy)
   if(event.key==='Tab'&&dialog.current){const nodes=[...dialog.current.querySelectorAll('button:not(:disabled),input')];if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}
  }
  document.addEventListener('keydown',key,true)
  // tło nieaktywne dla klawiatury i czytnika ekranu
  const shell=document.querySelector('.shell');shell?.setAttribute('inert','')
  return()=>{document.removeEventListener('keydown',key,true);shell?.removeAttribute('inert');previous?.isConnected&&previous.focus?.()}
 },[])
 const assignedTo=useMemo(()=>{const map=new Map();for(const bay of bays)if(bay.orderId!=null)map.set(String(bay.orderId),bay.name);return map},[bays])
 const list=useMemo(()=>{const needle=normalize(query);return orders.filter(order=>!needle||normalize([order.plate,order.make,order.model,order.customer,order.title,order.id].join(' ')).includes(needle))},[orders,query])
 const pick=async order=>{if(busy)return;setBusy(true);try{await choose(order)}finally{setBusy(false)}}
 return createPortal(<div className="halaPickerShade" onMouseDown={event=>event.target===event.currentTarget&&!busy&&close()}>
  <section ref={dialog} id="hala-picker" className="halaPicker" style={{'--hala-accent':accent}} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy}>
   <div className="halaPickerHead"><div><small>CENTRUM ZLECENIA</small><h2 id={titleId}>Zlecenie na: {bayName}</h2></div><button type="button" className="halaPickerClose" aria-label="Zamknij wybór zlecenia" disabled={busy} onClick={close}>×</button></div>
   <label className="halaPickerSearch"><Glyph name="search" size={18}/><span className="visuallyHidden">Szukaj zlecenia</span><input ref={input} type="search" value={query} placeholder="Rejestracja, auto, klient…" onChange={event=>setQuery(event.target.value)}/></label>
   <div className="halaPickerList">
    {list.length?list.map(order=>{const elsewhere=assignedTo.get(String(order.id));return <button key={order.cloud_id||order.id} type="button" className="halaPickerItem" disabled={busy} onClick={()=>pick(order)}>
     <span className="halaPickerPlate halaMono">{order.plate||'—'}</span>
     <span className="halaPickerText"><b>{[order.make,order.model].filter(Boolean).join(' ')||`Zlecenie #${order.id}`}</b><small>{[order.title,order.customer].filter(Boolean).join(' · ')}</small></span>
     <span className="halaPickerMeta"><em>{labels[order.status]||order.status}</em>{elsewhere&&<small>teraz: {elsewhere}</small>}</span>
    </button>}):<div className="halaPickerEmpty"><p>{orders.length?'Nie ma zlecenia pasującego do wyszukiwania.':'Brak aktywnych zleceń w Centrum zlecenia.'}</p><button type="button" className="halaBtn halaPrimary" onClick={goIntake}><Glyph name="plus" size={16} width={2.4}/>Przyjmij auto</button></div>}
   </div>
  </section>
 </div>,document.body)
}

const NOTE_TONES={muted:'#9C7F89',up:'#FB7185',down:'#6EE7B7',warn:'#F5C86E'}
function Ticker({items}){
 if(!items.length)return null
 const row=items.map((item,index)=><span key={index} className="halaMono">{item.label}{item.value&&<> <b>{item.value}</b></>}{item.note&&<> <em style={{color:NOTE_TONES[item.noteTone]||NOTE_TONES.muted}}>{item.note}</em></>}</span>)
 return <div className="halaTicker"><div className="halaTickerTrack" aria-hidden="true">{row}{row}</div><p className="visuallyHidden">{items.map(item=>[item.label,item.value,item.note].filter(Boolean).join(' ')).join(' · ')}</p></div>
}

function NewsFeed({api}){
 const{feed,loading,error,reload}=useNewsFeed(api)
 const[category,setCategory]=useState('ALL')
 const now=new Date()
 const all=(feed?.items||[]).map(item=>newsView(item,now))
 const news=filterNews(all,category).slice(0,6)
 const open=(event,url)=>{if(!api?.system?.openExternal)return;event.preventDefault();Promise.resolve(api.system.openExternal(url)).catch(()=>window.open(url,'_blank','noopener,noreferrer'))}
 const sources=[...(feed?.sources||[]),...(feed?.rates?.length?['NBP']:[])]
 return <div className="halaPanel halaNews halaRise d3">
  <div className="halaPanelHead">
   <div><h3>Ze świata motoryzacji</h3><p>Branża, przepisy, technika — odświeżane co godzinę</p></div>
   <div className="halaFilters" role="group" aria-label="Kategoria wiadomości">{NEWS_CATEGORIES.map(([key,label])=><button key={key} type="button" className={'halaChip halaFilter'+(category===key?' active':'')} aria-pressed={category===key} onClick={()=>setCategory(key)}>{label}</button>)}</div>
  </div>
  <Ticker items={tickerItems(feed||{})}/>
  <div className="halaNewsList" aria-busy={loading&&!feed}>
   {loading&&!feed?[0,1,2].map(index=><span key={index} className="halaNewsSkeleton" aria-hidden="true"><i/><span><i/><i/></span></span>)
    :news.length?news.map(item=><a key={item.id} className="halaNewsItem" href={item.url} target="_blank" rel="noopener noreferrer" onClick={event=>open(event,item.url)}>
     <span className={'halaNewsIcon tone-'+item.tone}><Glyph name={item.icon} size={26}/></span>
     <span className="halaNewsText"><span className={'halaNewsMeta tone-'+item.tone}>{item.label} · <em>{item.source}{item.date?` · ${item.date}`:''}</em></span><b>{item.title}</b>{item.lead&&<small>{item.lead}</small>}</span>
    </a>)
    :<p className="halaMuted halaNewsEmpty">{error||(feed?.rssUnavailable?'Wiadomości z portali pobiera aplikacja AutoLogika na Windows. Tutaj widzisz kursy NBP.':all.length?'Brak wiadomości w tej kategorii.':'Nie udało się pobrać wiadomości. Spróbujemy ponownie za godzinę.')}</p>}
  </div>
  <div className="halaNewsFoot">
   <span>{sources.length?`Źródła: ${sources.join(' · ')}`:'Źródła: Motofakty · Interia · MotoFocus · autoGALERIA · NBP'}{feed?.stale&&' · tryb offline (ostatnie pobrane)'}</span>
   <span className="halaNewsRefresh"><span className="halaMono">{feed?refreshedLabel(feed.refreshedAt):loading?'pobieram…':'brak danych'}</span><button type="button" className="halaIconLink" aria-label="Odśwież wiadomości" title="Odśwież teraz" disabled={loading} onClick={reload}><Glyph name="refresh" size={14}/></button></span>
  </div>
 </div>
}

function ActionList({actions,total,pulse,openJob,openAll}){
 const gradient='hala-pulse'+useId().replace(/:/g,'')
 const paths=pulsePaths(pulse.points)
 const nowX=pulse.now==null?null:Math.round(pulse.now*400)
 return <div className="halaPanel halaActions halaRise d4">
  <div className="halaPanelHead"><h3>Co wymaga Ciebie</h3><span className="halaChip halaCount">{total}</span></div>
  {actions.length?actions.map(action=><button key={action.id} type="button" className={'halaAction tone-'+action.tone} onClick={()=>action.orderId?openJob(action.orderId):openAll()}>
   <span className="halaActionIcon"><Glyph name={action.icon} width={2.2}/></span>
   <span className="halaActionText"><b>{action.title}</b><small>{action.detail}</small></span>
   <span className="halaActionArrow" aria-hidden="true">→</span>
  </button>):<div className="halaActionsEmpty"><span className="halaActionIcon"><Glyph name="check" width={2.2}/></span><span><b>Nic nie czeka na Ciebie</b><small>Warsztat jest pod kontrolą.</small></span></div>}
  {total>actions.length&&<button type="button" className="halaLink" onClick={openAll}>Wszystkie sprawy ({total}) →</button>}
  <div className="halaPulse">
   <div className="halaPulseHead"><small>PULS DNIA</small><span className={'halaChip tone-'+pulse.tone}>{pulse.label}</span></div>
   <svg viewBox="0 0 400 90" preserveAspectRatio="none" role="img" aria-label={`Obłożenie stanowisk dziś: ${pulse.label}`}>
    <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0" className="halaStopAccent" stopOpacity=".45"/><stop offset="1" className="halaStopAccent" stopOpacity="0"/></linearGradient></defs>
    <path d={paths.area} fill={`url(#${gradient})`}/>
    <path className="halaEkg" d={paths.line} fill="none" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
    {nowX!=null&&<line className="halaNow" x1={nowX} y1="6" x2={nowX} y2="84" stroke="#fff" strokeOpacity=".5" strokeDasharray="3 4"/>}
    <g className="halaAxis"><text x="0" y="88">{pulse.axis[0]}</text><text x="192" y="88">{pulse.axis[1]}</text><text x="386" y="88">{pulse.axis[2]}</text></g>
   </svg>
  </div>
 </div>
}
