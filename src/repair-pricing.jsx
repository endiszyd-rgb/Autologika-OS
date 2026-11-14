import React,{useEffect,useState} from 'react'
import {calculateLabor,DEFAULT_PRICING,PRICING_KEY,validatePricing,pricingDescription,describePriceHistory} from './repair-pricing.mjs'

export function useWorkshopRate(api,setForm){
 useEffect(()=>{let active=true;api.settings.catalogOverrides().then(map=>{const rate=map[PRICING_KEY]?.hourlyRate;if(active&&rate!=null)setForm(current=>current.labor_rate===''?{...current,labor_rate:rate}:current)}).catch(()=>{});return()=>{active=false}},[api,setForm])
}

export function PricingSettings({api,onSaved}){
 const [draft,setDraft]=useState({...DEFAULT_PRICING,hourlyRate:''}),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 useEffect(()=>{api.settings.catalogOverrides().then(map=>setDraft({...DEFAULT_PRICING,...map[PRICING_KEY]})).catch(e=>setMessage(e.message))},[api])
 const save=async()=>{setBusy(true);try{const map=await api.settings.setCatalogOverride(PRICING_KEY,validatePricing(draft));onSaved(map);setMessage('Zapisano stawki warsztatu. Istniejące pozycje zachowują zapisane ceny.')}catch(e){setMessage(e.message)}finally{setBusy(false)}}
 return <section className="panel"><h3>Stawki i warunki wyceny</h3><p>Stawka dotyczy robocizny. Mnożniki stosujesz tylko do wybranej pracy, nigdy do części. Czas katalogowy jest szacunkiem do sprawdzenia dla konkretnego auta.</p><div className="formgrid">{[['hourlyRate','Stawka roboczogodziny [zł/h]',0],['corrosionMultiplier','Mnożnik za korozję',1],['accessMultiplier','Mnożnik za utrudniony dostęp',1]].map(([key,label,min])=><label key={key}>{label}<input type="number" min={min} step="0.01" value={draft[key]??''} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></label>)}</div><button type="button" disabled={busy} onClick={save}>Zapisz stawki</button><p role="status">{message}</p></section>
}

export function LaborCalculator({config,hours,setHours,initialPrice,onChange}){
 const [rate,setRate]=useState(config.hourlyRate??''),[corrosion,setCorrosion]=useState(false),[access,setAccess]=useState(false),[manual,setManual]=useState(initialPrice!=null),[price,setPrice]=useState(initialPrice??''),[reason,setReason]=useState(initialPrice!=null?'Cena zapisana przez warsztat':''),[confirmed,setConfirmed]=useState(false)
 let result=null,error=''
 try{result=calculateLabor({hours,hourlyRate:rate,corrosionMultiplier:corrosion?config.corrosionMultiplier:1,accessMultiplier:access?config.accessMultiplier:1,manualPrice:manual?price:null,reason})}catch(e){error=e.message}
 const serialized=JSON.stringify(result)
 useEffect(()=>{onChange(confirmed&&result?{...result,description:pricingDescription(result)}:null)},[serialized,confirmed])
 return <fieldset className="wide"><legend>Kalkulacja robocizny</legend><p>Czas orientacyjny — nie jest zweryfikowaną normą producenta.</p><div className="formgrid"><label>Czas szacowany [h]<input type="number" min="0.01" step="0.01" value={hours} onChange={e=>{setHours(e.target.value);setConfirmed(false)}}/></label><label>Stawka [zł/h]<input type="number" min="0" step="0.01" value={rate} onChange={e=>setRate(e.target.value)} disabled={manual}/></label><label><input type="checkbox" checked={corrosion} disabled={manual} onChange={e=>setCorrosion(e.target.checked)}/> Korozja ×{config.corrosionMultiplier}</label><label><input type="checkbox" checked={access} disabled={manual} onChange={e=>setAccess(e.target.checked)}/> Utrudniony dostęp ×{config.accessMultiplier}</label><label><input type="checkbox" checked={manual} onChange={e=>setManual(e.target.checked)}/> Cena ręczna zamiast kalkulacji</label>{manual&&<><label>Cena robocizny [zł]<input type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label><label className="wide">Uzasadnienie ceny<input value={reason} onChange={e=>setReason(e.target.value)}/></label></>}<label className="wide"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Sprawdziłem czas i zakres dla tego pojazdu; przyjmuję je do wyceny.</label></div>{error?<p role="alert">{error}</p>:<p><strong>{result.total.toFixed(2)} zł</strong> · {manual?'Cena ustalona ręcznie':'Czas × stawka × wybrane mnożniki'}</p>}</fieldset>
}

export function QuoteHistory({api,orderId}){
 const [events,setEvents]=useState([]),[error,setError]=useState('')
 useEffect(()=>{api.timeline.list(orderId).then(rows=>setEvents(rows.filter(row=>/QUOTE|ORDER_ITEM|SMART_JOB|REPAIR|PART/.test(row.event_type||row.type||'')).reverse())).catch(e=>setError(e.message))},[api,orderId])
 return <details className="panel"><summary>Historia zmian wyceny i zakresu ({events.length})</summary>{error&&<p role="alert">{error}</p>}{events.map((row,index)=><article key={row.id||index}><b>{row.title}</b><small> · {row.created_at}</small><p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{describePriceHistory(row.details)}</p></article>)}{!events.length&&!error&&<p>Brak zarejestrowanych zmian. Historia nie odtwarza wstecz edycji sprzed jej wprowadzenia.</p>}</details>
}
