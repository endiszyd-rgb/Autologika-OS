import React,{useEffect,useState} from 'react'
import {calculateLabor,DEFAULT_PRICING,PRICING_KEY,validatePricing,pricingDescription,describePriceHistory} from './repair-pricing.mjs'
import {moneyExact} from './format.mjs'

export function useWorkshopRate(api,setForm){
 useEffect(()=>{let active=true;api.settings.catalogOverrides().then(map=>{const rate=map[PRICING_KEY]?.hourlyRate;if(active&&rate!=null)setForm(current=>current.labor_rate===''?{...current,labor_rate:rate}:current)}).catch(()=>{});return()=>{active=false}},[api,setForm])
}

export function PricingSettings({api,onSaved}){
 const [draft,setDraft]=useState({...DEFAULT_PRICING,hourlyRate:''}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{api.settings.catalogOverrides().then(map=>setDraft({...DEFAULT_PRICING,...map[PRICING_KEY]})).catch(e=>setMessage(e.message))},[api])
 const save=async()=>{setBusy(true);try{const map=await api.settings.setCatalogOverride(PRICING_KEY,validatePricing(draft));onSaved(map);setMessage('Zapisano stawki warsztatu. Istniejące pozycje zachowują zapisane ceny.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="panel"><h3>Stała stawka i warunki wyceny</h3><p>Ustaw stawkę roboczogodziny raz. Kalkulator użyje jej automatycznie przy kolejnych naprawach; do pojedynczej pozycji zmieniasz tylko czas. Mnożniki są opcjonalne i dotyczą wybranej pracy.</p><div className="formgrid">{[['hourlyRate','Stała stawka warsztatu [zł/h]',0],['corrosionMultiplier','Mnożnik za korozję',1],['accessMultiplier','Mnożnik za utrudniony dostęp',1]].map(([key,label,min])=><label key={key}>{label}<input type="number" min={min} step="0.01" value={draft[key]??''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}</div><button type="button" disabled={busy} onClick={save}>Zapisz stawkę</button><p role="status">{message}</p></section>
}

export function LaborCalculator({config,hours,setHours,initialPrice,onChange}){
 const [corrosion,setCorrosion]=useState(false),[access,setAccess]=useState(false),[manual,setManual]=useState(initialPrice!=null),[price,setPrice]=useState(initialPrice??''),[reason,setReason]=useState(initialPrice!=null?'Cena zapisana przez warsztat':'')
 let result=null,error=''
 try{result=calculateLabor({hours,hourlyRate:config.hourlyRate,corrosionMultiplier:corrosion?config.corrosionMultiplier:1,accessMultiplier:access?config.accessMultiplier:1,manualPrice:manual?price:null,reason})}catch(e){error=e.message}
 const serialized=JSON.stringify(result)
 useEffect(()=>{onChange(result?{...result,description:pricingDescription(result)}:null)},[serialized])
 const rateSet=Number(config.hourlyRate)>0
 // Warstwa graficzna: czas (do edycji) × stała stawka = wynik; korekty i cena ręczna jako opcje drugorzędne.
 return <fieldset className={'wide laborCalc'+(manual?' isManual':'')}>
  <legend>Kalkulacja robocizny</legend>
  <p className="laborCalcNote">Czas orientacyjny — nie jest zweryfikowaną normą producenta.</p>
  <div className="laborCalcMain">
   <label className="laborCalcHours"><span>Czas szacowany [h]</span><input type="number" inputMode="decimal" min="0.01" step="0.01" value={hours} onChange={e=>setHours(e.target.value)}/></label>
   <span className="laborCalcOperator" aria-hidden="true">×</span>
   <div className={'pricingRateSummary'+(rateSet?'':' isMissing')}><span>Stała stawka warsztatu</span><strong>{rateSet?`${moneyExact(config.hourlyRate)}/h`:'nieustawiona — ustaw ją w Cenniku'}</strong></div>
   <span className="laborCalcOperator" aria-hidden="true">=</span>
   {error
    ?<p className="laborCalcResult isError" role="alert">{error}</p>
    :<output className="laborCalcResult" aria-live="polite"><span>{manual?'Cena ustalona ręcznie':'Czas × stała stawka warsztatu'}</span><strong>{moneyExact(result.total)}</strong></output>}
  </div>
  <details className="laborAdvanced">
   <summary>Korekty i cena ręczna (opcjonalnie)</summary>
   <div className="laborAdvancedBody">
    <div className="laborOptions">
     <label className="laborOption"><input type="checkbox" checked={corrosion} disabled={manual} onChange={e=>setCorrosion(e.target.checked)}/><span>Korozja <em>×{config.corrosionMultiplier}</em></span></label>
     <label className="laborOption"><input type="checkbox" checked={access} disabled={manual} onChange={e=>setAccess(e.target.checked)}/><span>Utrudniony dostęp <em>×{config.accessMultiplier}</em></span></label>
     <label className="laborOption"><input type="checkbox" checked={manual} onChange={e=>setManual(e.target.checked)}/><span>Cena ręczna zamiast kalkulacji</span></label>
    </div>
    {manual&&<div className="laborManualFields"><label>Cena robocizny [zł]<input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label>Uzasadnienie ceny<input value={reason} onChange={e=>setReason(e.target.value)}/></label></div>}
   </div>
  </details>
 </fieldset>
}

export function QuoteHistory({api,orderId}){
 const [events,setEvents]=useState([]),[error,setError]=useState('')
 useEffect(()=>{api.timeline.list(orderId).then(rows=>setEvents(rows.filter(row=>/QUOTE|ORDER_ITEM|SMART_JOB|REPAIR|PART/.test(row.event_type||row.type||'')).reverse())).catch(e=>setError(e.message))},[api,orderId])
 return <details className="panel quoteHistory"><summary>Historia zmian wyceny i zakresu ({events.length})</summary>{error&&<p role="alert">{error}</p>}{events.map((row,index)=><article key={row.id||index}><b>{row.title}</b><small> · {row.created_at}</small><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{describePriceHistory(row.details)}</p></article>)}{!events.length&&!error&&<p>Brak zarejestrowanych zmian. Historia nie odtwarza wstecz edycji sprzed jej wprowadzenia.</p>}</details>
}
