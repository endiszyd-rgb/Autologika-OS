import React,{useEffect,useState} from 'react'

// Ustawienia → Grafika i animacje (tylko aplikacja Windows; PWA nie ma tych metod i panel się nie pokazuje)
export function GraphicsSettings({api,Panel}){
 const[state,setState]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const available=Boolean(api.system?.graphics)
 useEffect(()=>{if(!available)return;let active=true;api.system.graphics().then(next=>active&&setState(next)).catch(reason=>active&&setError(String(reason?.message||reason)));return()=>{active=false}},[api,available])
 if(!available)return null
 const toggle=async()=>{
  setBusy(true);setError('')
  try{await api.system.setGraphics({hardwareAcceleration:!state.hardwareAcceleration});setState(await api.system.graphics())}
  catch(reason){setError(`Nie udało się zapisać: ${reason?.message||reason}`)}
  finally{setBusy(false)}
 }
 const restart=async()=>{setBusy(true);try{await api.system.relaunch()}catch(reason){setBusy(false);setError(`Nie udało się uruchomić ponownie: ${reason?.message||reason}`)}}
 return <Panel title="Grafika i animacje">
  {!state?<p className="muted">{error||'Sprawdzam tryb grafiki…'}</p>:<>
   <div className="notice"><b>{state.activeHardwareAcceleration?'Płynna grafika (akceleracja GPU) jest włączona':'Tryb zgodności grafiki jest włączony'}</b><span>{state.activeHardwareAcceleration?'Animacje i przejścia rysuje karta graficzna. Jeśli zobaczysz czarne lub migające okno, włącz tryb zgodności.':'Obraz rysuje procesor — działa na każdym sterowniku, ale animacje mogą się przycinać.'}</span></div>
   {state.autoDisabled&&<div className="warnbox" role="status">Tryb zgodności włączył się automatycznie: {state.reason||'proces grafiki ulegał awariom.'} Możesz spróbować ponownie włączyć płynną grafikę.</div>}
   {state.systemReducedMotion&&<div className="warnbox" role="status">Windows ma wyłączone efekty animacji (Ustawienia systemu → Ułatwienia dostępu → Efekty wizualne → Efekty animacji). AutoLogika to respektuje i ogranicza animacje — włącz je w systemie, aby zobaczyć pełne przejścia.</div>}
   <div className="actionrow">
    <button type="button" className={state.hardwareAcceleration?'':'primary'} disabled={busy} aria-pressed={state.hardwareAcceleration} onClick={toggle}>{state.hardwareAcceleration?'Włącz tryb zgodności (bez GPU)':'Włącz płynną grafikę (GPU)'}</button>
    {state.restartRequired&&<button type="button" className="primary" disabled={busy} onClick={restart}>Uruchom ponownie, aby zastosować</button>}
    {state.restartRequired&&<span className="statusTag">Zmiana zadziała po ponownym uruchomieniu</span>}
   </div>
   {error&&<div className="warnbox" role="alert">{error}</div>}
  </>}
 </Panel>
}
