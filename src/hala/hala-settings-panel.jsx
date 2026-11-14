import React,{useEffect,useState} from 'react'
import {ACCENT_OPTIONS} from './hala-model.mjs'
import './hala.css'

const ACCENT_NAMES={'#F43F5E':'Malina (domyślny)','#3EE0C8':'Turkus','#4DA3FF':'Błękit','#F5B544':'Bursztyn'}

// Ustawienia ekranu „Hala na żywo” — wspólne dla Windows i PWA (zapis w app_settings, synchronizowany)
export function HalaSettings({api,Panel}){
 const[value,setValue]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
 useEffect(()=>{let active=true;api.settings.hala?.().then(next=>active&&setValue(next)).catch(reason=>active&&setError(`Nie udało się wczytać ustawień Hali: ${reason?.message||reason}`));return()=>{active=false}},[api])
 if(!api.settings.hala)return null
 const save=async event=>{
  event.preventDefault()
  setBusy(true);setError('');setMessage('')
  try{
   // przypisania stanowisk mogły się zmienić na ekranie Hali — zapisujemy tylko pola z tego formularza
   const current=await api.settings.hala()
   const next=await api.settings.setHala({...current,greetingName:value.greetingName,workshopName:value.workshopName,accent:value.accent})
   setValue(next);setMessage('Zapisano. Ekran Hala na żywo pokaże zmiany od razu.')
  }catch(reason){setError(`Nie udało się zapisać: ${reason?.message||reason}`)}
  finally{setBusy(false)}
 }
 return <Panel title="Ekran Hala na żywo">
  <div className="notice"><b>Powitanie i wygląd</b><span>Imię i nazwa warsztatu pojawiają się w nagłówku ekranu Hala na żywo. Zlecenia przypisujesz do stanowisk, klikając stanowisko na tym ekranie.</span></div>
  {value?<form className="halaSettingsForm" onSubmit={save}>
   <div className="formgrid">
    <label>Imię do powitania<input value={value.greetingName} maxLength={40} placeholder="np. Endi" autoComplete="given-name" onChange={event=>setValue({...value,greetingName:event.target.value})}/></label>
    <label>Nazwa warsztatu<input value={value.workshopName} maxLength={60} placeholder="np. Nitropoint" autoComplete="organization" onChange={event=>setValue({...value,workshopName:event.target.value})}/></label>
   </div>
   <fieldset className="halaAccentPicker"><legend>Kolor akcentu</legend>{ACCENT_OPTIONS.map(color=><button key={color} type="button" className={value.accent===color?'active':''} aria-pressed={value.accent===color} onClick={()=>setValue({...value,accent:color})}><i style={{background:color}} aria-hidden="true"/>{ACCENT_NAMES[color]||color}</button>)}</fieldset>
   <div className="actionrow"><button className="primary" type="submit" disabled={busy}>{busy?'Zapisuję…':'Zapisz ustawienia Hali'}</button>{message&&<span className="statusTag" role="status">✓ {message}</span>}</div>
  </form>:!error&&<p className="muted">Wczytuję ustawienia…</p>}
  {error&&<div className="warnbox" role="alert">{error}</div>}
 </Panel>
}
