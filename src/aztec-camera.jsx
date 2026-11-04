import React,{useEffect,useRef,useState} from 'react'
import {bytesToBase64,cameraErrorMessage} from './aztec-camera-utils.mjs'

const isNotFound=error=>/NotFoundException|No MultiFormat Readers|No code/i.test(String(error?.name||error?.message||error||''))

export default function AztecCamera({onDetected,onClose}){
 const videoRef=useRef(null),fileRef=useRef(null),readerRef=useRef(null),controlsRef=useRef(null),trackRef=useRef(null),doneRef=useRef(false),attemptRef=useRef(0)
 const[status,setStatus]=useState('Uruchamiam tylny aparat…'),[error,setError]=useState(''),[torchAvailable,setTorchAvailable]=useState(false),[torch,setTorch]=useState(false),[starting,setStarting]=useState(true)

 const stop=()=>{attemptRef.current++;controlsRef.current?.stop?.();controlsRef.current=null;trackRef.current?.stop?.();trackRef.current=null;const stream=videoRef.current?.srcObject;if(stream?.getTracks)stream.getTracks().forEach(track=>track.stop());if(videoRef.current)videoRef.current.srcObject=null}
 const deliver=result=>{if(doneRef.current)return;doneRef.current=true;const raw=String(result.getText?.()||'');const bytes=result.getRawBytes?.()||new Uint8Array();stop();onDetected?.({raw,base64:bytes.length?bytesToBase64(bytes):'',source:'IOS_CAMERA',format:'AZTEC'})}
 const start=async()=>{
  setError('');setStarting(true);doneRef.current=false;stop();const attempt=attemptRef.current
  try{
   const {BrowserAztecCodeReader}=await import('@zxing/browser')
   if(attempt!==attemptRef.current)return
   const reader=new BrowserAztecCodeReader(undefined,{delayBetweenScanAttempts:120,delayBetweenScanSuccess:800});readerRef.current=reader
   const constraints={audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}}
   const controls=await reader.decodeFromConstraints(constraints,videoRef.current,(result,scanError,scannerControls)=>{
    if(attempt!==attemptRef.current){scannerControls?.stop?.();return}
    if(scannerControls&&!controlsRef.current)controlsRef.current=scannerControls
    if(result)deliver(result)
    else if(scanError&&!isNotFound(scanError))setError(cameraErrorMessage(scanError))
   })
   if(attempt!==attemptRef.current){controls.stop?.();return}
   controlsRef.current=controls
   const stream=videoRef.current?.srcObject,track=stream?.getVideoTracks?.()[0];trackRef.current=track||null
   const capabilities=track?.getCapabilities?.()||{};setTorchAvailable(Boolean(capabilities.torch))
   setStatus('Ustaw cały kod AZTEC w ramce i trzymaj telefon nieruchomo.');setStarting(false)
  }catch(reason){if(attempt!==attemptRef.current)return;setStarting(false);setError(cameraErrorMessage(reason));setStatus('Możesz wykonać zdjęcie kodu lub wybrać je z biblioteki.')}
 }
 const selectPhoto=async event=>{
  const file=event.target.files?.[0];event.target.value='';if(!file)return
  stop();doneRef.current=false;const attempt=attemptRef.current
  setError('');setStatus('Odczytuję AZTEC ze zdjęcia…');setStarting(true)
  const url=URL.createObjectURL(file)
  try{const {BrowserAztecCodeReader}=await import('@zxing/browser');const reader=readerRef.current||new BrowserAztecCodeReader();readerRef.current=reader;const result=await reader.decodeFromImageUrl(url);if(attempt===attemptRef.current)deliver(result)}
  catch(reason){if(attempt!==attemptRef.current)return;setError(isNotFound(reason)?'Nie znaleziono kodu AZTEC na zdjęciu. Zrób zdjęcie bliżej, bez odblasku i z całym kodem w kadrze.':cameraErrorMessage(reason));setStatus('Spróbuj ponownie aparatem albo innym zdjęciem.');setStarting(false)}
  finally{URL.revokeObjectURL(url)}
 }
 const toggleTorch=async()=>{const next=!torch;try{await trackRef.current?.applyConstraints?.({advanced:[{torch:next}]});setTorch(next)}catch{setTorchAvailable(false);setError('Ten aparat nie pozwala sterować lampą z poziomu Safari.')} }
 useEffect(()=>{start();return()=>stop()},[])
 return <div className="aztecCamera" role="dialog" aria-modal="true" aria-label="Skanowanie kodu AZTEC">
  <div className="aztecCameraTop"><div><small>IOS · SKAN LOKALNY</small><b>Skanuj AZTEC dowodu</b></div><button type="button" className="aztecClose" aria-label="Zamknij skaner" onClick={()=>{stop();onClose?.()}}>×</button></div>
  <div className="aztecViewport"><video ref={videoRef} autoPlay muted playsInline/><div className="aztecShade"/><div className="aztecFrame"><i/><i/><i/><i/><span/></div>{starting&&<div className="aztecLoading"><i/>Uruchamianie…</div>}</div>
  <div className="aztecCameraPanel"><p className={error?'error':''}>{error||status}</p><div className="aztecCameraActions">{torchAvailable&&<button type="button" className={torch?'active':''} onClick={toggleTorch}>{torch?'Wyłącz lampę':'Włącz lampę'}</button>}<button type="button" onClick={()=>fileRef.current?.click()}>Zrób / wybierz zdjęcie</button><button type="button" onClick={start}>Uruchom ponownie</button></div><small>Dane dowodu są dekodowane na tym urządzeniu i nie są wysyłane do usługi OCR.</small></div>
  <input ref={fileRef} className="aztecFile" type="file" accept="image/*" onChange={selectPhoto}/>
 </div>
}
