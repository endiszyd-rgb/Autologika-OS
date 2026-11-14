// AutoLogika UI 2.0 — elementy Centrum zlecenia i przyjęcia:
// karta pojazdu ze zdjęciem, pasek realizacji, kafelki sekcji, podsumowanie finansowe,
// dokumentacja fotograficzna i podgląd zlecenia.
// Komponenty są prezentacyjne: dostają dane już pobrane przez Centrum zlecenia
// i wywołują wyłącznie przekazane im akcje (setTab, addFiles, exportPdf…).
import React from 'react'
import './order-hub.css'
import {VehiclePhoto} from './vehicle-photo.jsx'
import {Icon,StatusBadge} from './ui.jsx'
import {DOC_CATEGORIES,docCategory,documentationStats,isImageFile,itemCategory,newestFirst,orderFinance,orderProgress,orderSections,vehicleSpecs,vehicleTitle} from './order-hub-model.mjs'

const moneyFormatter=new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',maximumFractionDigits:2})
export const formatMoney=value=>moneyFormatter.format(Number(value||0))
const sectionIcons={works:'check',parts:'inventory',costs:'finance',docs:'documents'}
const formatDate=value=>{if(!value)return '';const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'})}

export function PlateBadge({plate}){
 return plate?<span className="plateBadge"><i aria-hidden="true">PL</i><span className="visuallyHidden">numer rejestracyjny </span>{plate}</span>:<span className="plateBadge empty">bez rejestracji</span>
}

// Karta pojazdu do nagłówka zlecenia i przyjęcia.
export function VehicleSpecChips({vehicle}){
 const specs=vehicleSpecs(vehicle)
 if(!specs.length&&!vehicle?.vin)return null
 return <dl className="vehicleSpecChips">{specs.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}{vehicle?.vin&&<div className="vin"><dt>VIN</dt><dd>{vehicle.vin}</dd></div>}</dl>
}

export function IntakeVehicleCard({vehicle}){
 const title=vehicleTitle(vehicle),hasModel=Boolean(vehicle?.make||vehicle?.model)
 return <div className="intakeVehiclePhotoPreview intakeVehicleCard">
  <VehiclePhoto vehicle={vehicle}/>
  <div className="intakeVehicleCardBody">
   <small className="ui-eyebrow">KARTA POJAZDU</small>
   <b>{hasModel?title:'Wybierz markę i model'}</b>
   <div className="intakeVehicleCardMeta"><PlateBadge plate={vehicle?.plate}/>{!hasModel&&<small>Fotografia modelu pojawi się po jego wybraniu</small>}</div>
   <VehicleSpecChips vehicle={vehicle}/>
  </div>
 </div>
}

// Pasek realizacji zlecenia (statusy w skrócie).
export function OrderProgress({status,waitState,labels={}}){
 const progress=orderProgress(status,waitState)
 return <section className="orderProgress" aria-label="Etap realizacji zlecenia">
  <div className="orderProgressHead"><span className="ui-eyebrow">REALIZACJA</span><b>{labels[status]||status}</b>{progress.waiting&&<span className="orderWaitChip" role="status">{progress.waitLabel}</span>}<em>{progress.percent}%</em></div>
  <ol>{progress.steps.map((step,index)=><li key={step.key} className={step.state} aria-current={step.state==='current'?'step':undefined}><i aria-hidden="true">{step.state==='done'?<Icon name="check" size={13}/>:index+1}</i><span>{step.label}</span></li>)}</ol>
  <div className="orderProgressTrack" aria-hidden="true"><i style={{transform:`scaleX(${progress.percent/100})`}}/></div>
 </section>
}

// Kafelki: Naprawy · Części · Koszty · Dokumentacja — przejście do odpowiedniej zakładki.
export function OrderSectionTiles({sections,activeTab,setTab}){
 return <nav className="orderSectionTiles" aria-label="Sekcje zlecenia">{sections.map(section=><button type="button" key={section.key} data-order-section={section.key} className={'orderSectionTile tone-'+section.tone+(activeTab===section.tab?' active':'')} aria-current={activeTab===section.tab?'true':undefined} onClick={()=>setTab(section.tab)}>
  <span className="orderSectionIcon" aria-hidden="true"><Icon name={sectionIcons[section.key]} size={18}/></span>
  <span className="orderSectionText"><small>{section.label}</small><b>{section.money?formatMoney(section.value):section.value}</b><em>{section.detail}</em></span>
  <Icon name="chevron" size={16} className="orderSectionChevron"/>
 </button>)}</nav>
}

// Podsumowanie finansowe: wartość, wpłaty, saldo i podział pozycji.
export function OrderFinanceSummary({finance,onSettle,onQuote}){
 const {total,paid,balance,overpaid,settled,paidPercent,split,shares,itemized,adjustments,finalPriceSet,exact,diagnosis,discount}=finance
 return <section className="orderFinance ui-card" aria-labelledby="orderFinanceTitle">
  <div className="ui-card__header"><div><span className="ui-eyebrow">KOSZTY</span><h3 id="orderFinanceTitle" className="ui-card__title">Podsumowanie finansowe</h3></div><span className={'ui-badge ui-badge--dot '+(settled?'ui-badge--success':paid>0?'ui-badge--info':'ui-badge--warning')}>{settled?(total>0?'Rozliczone':'Brak należności'):paid>0?`Wpłacono ${paidPercent}%`:'Brak wpłat'}</span></div>
  <div className="orderFinanceTotals">
   <div className="primaryTotal"><span>Wartość zlecenia</span><strong>{formatMoney(total)}</strong>{finalPriceSet&&<small>cena końcowa ustalona ręcznie</small>}</div>
   <div><span>Wpłacono</span><strong>{formatMoney(paid)}</strong></div>
   <div className={balance>0.01?'due':''}><span>{overpaid>0.01?'Nadpłata':'Do zapłaty'}</span><strong>{formatMoney(overpaid>0.01?overpaid:balance)}</strong></div>
  </div>
  <div className="orderFinancePaid" role="progressbar" aria-label="Opłacona część zlecenia" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent}><i style={{transform:`scaleX(${paidPercent/100})`}}/></div>
  {itemized>0?<>
   <div className="orderFinanceSplit" aria-hidden="true"><i className="labor" style={{flexGrow:shares.labor}}/><i className="parts" style={{flexGrow:shares.parts}}/>{shares.other>0&&<i className="other" style={{flexGrow:shares.other}}/>}</div>
   <dl className="orderFinanceLegend">
    <div><dt><i className="labor"/>Robocizna</dt><dd>{formatMoney(split.labor)}</dd></div>
    <div><dt><i className="parts"/>Części i materiały</dt><dd>{formatMoney(split.parts)}</dd></div>
    {(split.other>0||diagnosis>0)&&<div><dt><i className="other"/>{diagnosis>0?'Diagnostyka, usługi i inne':'Usługi i inne'}</dt><dd>{formatMoney(split.other+diagnosis)}</dd></div>}
    {discount>0&&<div className="muted"><dt>Rabat</dt><dd>−{formatMoney(discount)}</dd></div>}
    {Math.abs(adjustments)>0.01&&<div className="muted"><dt>{finalPriceSet?'Korekta ceny końcowej':'Pozostałe składniki zlecenia'}</dt><dd>{adjustments>0?'+':''}{formatMoney(adjustments)}</dd></div>}
   </dl>
   {!exact&&<p className="orderFinanceNote">Podział poglądowy — wyliczony z pozycji rozliczenia.</p>}
  </>:<p className="orderFinanceEmpty">Pozycje rozliczenia pojawią się po dodaniu prac i części.</p>}
  <div className="orderFinanceActions"><button type="button" className="ui-btn ui-btn--sm" onClick={onQuote}><Icon name="orders" size={15}/> Wycena</button><button type="button" className="ui-btn ui-btn--sm ui-btn--soft" onClick={onSettle}><Icon name="finance" size={15}/> Płatność i wynik</button></div>
 </section>
}

// Dokumentacja fotograficzna według etapów zlecenia.
export function OrderPhotoDocs({files,addFiles,openFile,openDocs}){
 const stats=documentationStats(files),recent=newestFirst(files).slice(0,6)
 return <section className="orderPhotoDocs ui-card" aria-labelledby="orderPhotoDocsTitle">
  <div className="ui-card__header"><div><span className="ui-eyebrow">DOKUMENTACJA</span><h3 id="orderPhotoDocsTitle" className="ui-card__title">Zdjęcia i pliki</h3><span className="ui-card__subtitle">{stats.total?`${stats.photos} zdjęć · ${stats.documents} dokumentów · ${stats.cloud} w chmurze`:'Udokumentuj stan auta przy przyjęciu'}</span></div><button type="button" className="ui-btn ui-btn--sm" onClick={openDocs}>Wszystkie <Icon name="arrow" size={14}/></button></div>
  <div className="photoStageGrid">{DOC_CATEGORIES.map(([key,label])=>{const count=stats.byCategory[key],empty=!count.photos&&!count.files;return <button type="button" key={key} data-photo-stage={key} className={'photoStage'+(empty?' empty':'')} onClick={()=>addFiles(key)} title={`Dodaj zdjęcia: ${label}`}><span className="photoStageIcon" aria-hidden="true">{empty?<Icon name="intake" size={18}/>:<Icon name="documents" size={18}/>}</span><b>{label}</b><small>{empty?'Dodaj zdjęcia':`${count.photos} zdj. · ${count.files} plików`}</small></button>})}</div>
  {recent.length>0&&<ul className="photoRecent">{recent.map(file=><li key={file.id}><button type="button" onClick={()=>openFile(file)} title={`Otwórz ${file.name}`}><span className={'photoRecentKind'+(isImageFile(file)?' image':'')} aria-hidden="true">{isImageFile(file)?'IMG':String(file.name||'').split('.').pop().slice(0,4).toUpperCase()||'PLIK'}</span><span><b>{file.name}</b><small>{DOC_CATEGORIES.find(([key])=>key===docCategory(file))?.[1]} · {formatDate(file.created_at)}</small></span></button></li>)}</ul>}
 </section>
}

// Podgląd zlecenia — czytelne podsumowanie dla mechanika lub klienta, bez edycji.
export function OrderPreview({order,items,parts,files,payments,repairs,labels,exportPdf}){
 const finance=orderFinance({order,items,payments}),docs=documentationStats(files)
 // Jak w zakładkach Zakres napraw / Części: pozycje i części przypięte do naprawy są częścią tej naprawy.
 const looseItems=items.filter(item=>!item.repair_operation_id),looseParts=parts.filter(part=>!part.repair_operation_id)
 const works=looseItems.filter(item=>itemCategory(item)!=='parts'),materials=looseItems.filter(item=>itemCategory(item)==='parts')
 const progress=orderProgress(order.status,order.wait_state)
 return <div className="orderPreview" data-order-preview>
  <header className="orderPreviewHeader"><div><span className="ui-eyebrow">ZLECENIE SERWISOWE #{order.id}</span><h3>{order.title||'Diagnostyka / naprawa'}</h3><small>Przyjęte {formatDate(order.opened_at||order.created_at)}{order.due_at?` · termin ${formatDate(order.due_at)}`:''}</small></div><StatusBadge status={order.status} label={labels[order.status]||order.status}/></header>
  <div className="orderPreviewVehicle"><VehiclePhoto vehicle={order}/><div><b>{vehicleTitle(order)}</b><PlateBadge plate={order.plate}/><VehicleSpecChips vehicle={order}/></div></div>
  <dl className="orderPreviewFacts">
   <div><dt>Klient</dt><dd>{order.customer||'—'}{order.phone?` · ${order.phone}`:''}</dd></div>
   <div><dt>Realizacja</dt><dd>{progress.steps.find(step=>step.state==='current')?.label||'Wydane'} · {progress.percent}%{progress.waiting?` · ${progress.waitLabel}`:''}</dd></div>
   <div className="wide"><dt>Zgłoszenie klienta</dt><dd>{order.complaint||'Brak opisu objawu'}</dd></div>
  </dl>
  <section className="orderPreviewList"><h4>Naprawy i robocizna <span className="countBadge">{works.length+repairs.length}</span></h4>{repairs.length>0&&<p className="orderPreviewHint">Kwoty napraw zawierają ich robociznę i przypisane części (brutto).</p>}{repairs.length||works.length?<ul>{repairs.map(repair=><li key={'r'+repair.id}><span>{[repair.title,repair.variant].filter(Boolean).join(' · ')||'Naprawa'}</span>{repair.estimate?.gross!=null?<b>{formatMoney(repair.estimate.gross)}</b>:<em>naprawa</em>}</li>)}{works.map(item=><li key={'w'+item.id}><span>{item.work_name||item.name}</span><b>{formatMoney(Number(item.qty||1)*Number(item.unit_price||0))}</b></li>)}</ul>:<p className="muted">Zakres prac nie został jeszcze dodany.</p>}</section>
  <section className="orderPreviewList"><h4>Części i materiały <span className="countBadge">{materials.length}</span></h4>{materials.length?<ul>{materials.map(item=><li key={'i'+item.id}><span>{item.name}{item.part_no?` · ${item.part_no}`:''}</span><b>{formatMoney(Number(item.qty||1)*Number(item.unit_price||0))}</b></li>)}</ul>:<p className="muted">Brak części w rozliczeniu.</p>}{looseParts.length>0&&<><h5>Zamówienia części</h5><ul>{looseParts.map(part=><li key={'p'+part.id}><span>{part.name}{part.part_no?` · ${part.part_no}`:''}</span><em>{String(part.status||'').replaceAll('_',' ').toLowerCase()}</em></li>)}</ul></>}</section>
  <div className="orderPreviewTotals"><div><span>Wartość zlecenia</span><b>{formatMoney(finance.total)}</b></div><div><span>Wpłacono</span><b>{formatMoney(finance.paid)}</b></div><div className={finance.balance>0.01?'due':''}><span>Do zapłaty</span><b>{formatMoney(finance.balance)}</b></div><div><span>Dokumentacja</span><b>{docs.photos} zdjęć · {docs.documents} plików</b></div></div>
  <footer className="orderPreviewActions"><button type="button" className="ui-btn" onClick={()=>exportPdf('intake')}><Icon name="documents" size={16}/> Protokół przyjęcia</button><button type="button" className="ui-btn ui-btn--primary" onClick={()=>exportPdf('order')}><Icon name="documents" size={16}/> Zlecenie serwisowe PDF</button><button type="button" className="ui-btn" onClick={()=>exportPdf('release')}><Icon name="documents" size={16}/> Protokół wydania</button></footer>
 </div>
}

export {orderFinance,orderSections}
