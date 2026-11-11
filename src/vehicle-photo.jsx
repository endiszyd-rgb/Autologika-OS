import React,{useEffect,useState} from 'react'
import './vehicle-photo.css'
import {resolveVerifiedVehiclePhoto,vehiclePhotoKey} from './vehicle-photo-model.mjs'

// Deliberately conservative: an unrelated vehicle is worse than a fallback.
// Photos are sourced only from the reviewed manifest.
const cache=new Map()
const MAX_CACHE=500
export function getVehiclePhoto(vehicle){
 const key=vehiclePhotoKey(vehicle)
 if(cache.has(key))return Promise.resolve(cache.get(key))
 const photo=resolveVerifiedVehiclePhoto(vehicle)
 if(cache.size>=MAX_CACHE)cache.delete(cache.keys().next().value)
 cache.set(key,photo)
 return Promise.resolve(photo)
}
export function VehiclePhoto({vehicle,className='',size='normal'}){
 const key=vehiclePhotoKey(vehicle)
 const [photo,setPhoto]=useState(()=>resolveVerifiedVehiclePhoto(vehicle))
 const [broken,setBroken]=useState(false)
 useEffect(()=>{
  let active=true
  setBroken(false)
  getVehiclePhoto(vehicle).then(result=>{if(active)setPhoto(result)})
  return ()=>{active=false}
 },[key])
 const label=[vehicle?.make,vehicle?.model,vehicle?.generation,vehicle?.year].filter(Boolean).join(' ')
 const visible=photo&&!broken
 const credit=photo?['Fotografia: '+photo.author,photo.license,'Źródło: '+photo.source,'Licencja: '+(photo.licenseUrl||'')].join(' · '):''
 return <span className={'vehiclePhoto '+(size==='small'?'vehiclePhotoSmall ':'')+className} data-vehicle-photo={visible?'real':'fallback'}>
  {visible?<img loading="lazy" src={photo.src} alt={label} title={credit} referrerPolicy="no-referrer" onError={()=>setBroken(true)}/>:<span className="vehiclePhotoFallback" role="img" aria-label={'Zdjęcie niedostępne: '+(label||'pojazd')}>🚘</span>}
  {visible&&<span className="vehiclePhotoCredit" title={credit} aria-label={credit}>©</span>}
 </span>
}
