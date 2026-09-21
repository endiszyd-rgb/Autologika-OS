import React,{useEffect,useRef,useState} from 'react'
import {collectSpeechResults,joinVoiceText,speechErrorMessage} from './voice-entry.mjs'

function recognitionClass(){return globalThis?.SpeechRecognition||globalThis?.webkitSpeechRecognition||null}

export function VoiceTextarea({value,onChange,className='',placeholder='',rows,ariaLabel,disabled=false}){
 const recognition=useRef(null),base=useRef(''),[listening,setListening]=useState(false),[error,setError]=useState('')
 const supported=!!recognitionClass()
 useEffect(()=>()=>{try{recognition.current?.abort()}catch{}},[])
 const stop=()=>{try{recognition.current?.stop()}catch{}setListening(false)}
 const start=()=>{
  const Recognition=recognitionClass()
  if(!Recognition){setError('Dyktowanie nie jest dostępne na tym komputerze.');return}
  setError('');base.current=String(value||'')
  const instance=new Recognition();recognition.current=instance
  instance.lang='pl-PL';instance.continuous=true;instance.interimResults=true;instance.maxAlternatives=1
  instance.onstart=()=>setListening(true)
  instance.onend=()=>{setListening(false);recognition.current=null}
  instance.onerror=event=>{setError(speechErrorMessage(event.error));setListening(false)}
  instance.onresult=event=>{const result=collectSpeechResults(event.results);onChange(joinVoiceText(base.current,result.transcript))}
  try{instance.start()}catch(error){setError(error?.message||'Nie udało się uruchomić mikrofonu.')}
 }
 return <div className={'voiceField '+(listening?'isListening ':'')+className}>
  <textarea value={value||''} disabled={disabled} onChange={onChange instanceof Function?e=>onChange(e.target.value):undefined} placeholder={placeholder} rows={rows} aria-label={ariaLabel}/>
  <button type="button" className="voiceButton" disabled={disabled||!supported} onClick={listening?stop:start} title={disabled?'Pole jest tylko do odczytu':supported?(listening?'Zakończ dyktowanie':'Dyktuj po polsku'):'Rozpoznawanie mowy niedostępne'} aria-label={listening?'Zatrzymaj dyktowanie':'Rozpocznij dyktowanie'} aria-pressed={listening}>
   <span>🎙</span><b>{listening?'SŁUCHAM':'DYKTUJ'}</b>
  </button>
  {listening&&<small className="voiceStatus"><i/>Mów naturalnie. Powiedz „kropka”, „przecinek” lub „nowa linia”.</small>}
  {error&&<small className="voiceError" role="alert">{error}</small>}
 </div>
}
