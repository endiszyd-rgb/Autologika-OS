import React,{useEffect,useState} from 'react'
import './vehicle-photo.css'
import {resolveVerifiedVehiclePhoto} from './vehicle-photo-model.mjs'

// All screens resolve a vehicle from the same model/year/generation identity.
// Only real photographs with an allowed Commons license are displayed.
const cache=new Map()
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const tokenMatch=(title,value)=>normalize(value).split(' ').every(token=>normalize(title).split(' ').includes(token))
const licenseAllowed=value=>/^(CC BY(?:-SA)?(?: [0-9.]+)?|CC0|Public domain|PD)/i.test(String(value||'').replace(/<[^>]+>/g,'').trim())
const searchTerms=vehicle=>[vehicle?.make,vehicle?.model,vehicle?.generation,vehicle?.year].filter(Boolean).join(' ')
const keyFor=vehicle=>[vehicle?.make,vehicle?.model,vehicle?.generation,vehicle?.year].map(normalize).join('|')
function matchesPhoto(page,vehicle){
 const name=page.title||''
 if(!tokenMatch(name,vehicle.make)||!tokenMatch(name,vehicle.model))return false
 const generation=String(vehicle.generation||'').trim()
 // If a generation is specified, a photo without it is not a proven match.
 if(generation&&!tokenMatch(name,generation))return false
 const year=String(vehicle.year||'').trim()
 if(year && !generation && !name.includes(year))return false
 if(year && generation && /\b(?:19|20)\d{2}\b/.test(name) && !name.includes(year))return false
 return true
}
async function fetchPhoto(vehicle){
 const verified=resolveVerifiedVehiclePhoto(vehicle)
 if(verified)return verified
 const query=searchTerms(vehicle)
 if(!vehicle?.make||!vehicle?.model)return null
 const url=new URL('https://commons.wikimedia.org/w/api.php')
 url.search=new URLSearchParams({action:'query',format:'json',origin:'*',generator:'search',gsrsearch:'filetype:bitmap '+query,gsrnamespace:'6',gsrlimit:'18',prop:'imageinfo',iiprop:'url|extmetadata',iiurlwidth:'560'}).toString()
 const response=await fetch(url.toString(),{mode:'cors'})
 if(!response.ok)throw new Error('Commons '+response.status)
 const payload=await response.json()
 const pages=Object.values(payload.query?.pages||{}).sort((a,b)=>(a.index||0)-(b.index||0))
 for(const page of pages){
  const info=page.imageinfo?.[0],meta=info?.extmetadata||{}
  const license=meta.LicenseShortName?.value||''
  if(!info?.thumburl||!matchesPhoto(page,vehicle)||!licenseAllowed(license))continue
  return {src:info.thumburl,source:info.descriptionurl||info.url,license,author:meta.Artist?.value?.replace(/<[^>]+>/g,'').trim()||'Wikimedia Commons',title:page.title}
 }
 return null
}
export function getVehiclePhoto(vehicle){
 const key=keyFor(vehicle)
 if(!cache.has(key))cache.set(key,fetchPhoto(vehicle).catch(()=>null))
 return cache.get(key)
}
export function VehiclePhoto({vehicle,className='',size='normal'}){
 const key=keyFor(vehicle)
 const [photo,setPhoto]=useState(null)
 useEffect(()=>{let mounted=true;setPhoto(null);getVehiclePhoto(vehicle).then(result=>{if(mounted)setPhoto(result)});return()=>{mounted=false}},[key])
 const label=[vehicle?.make,vehicle?.model,vehicle?.generation,vehicle?.year].filter(Boolean).join(' ')
 return <span className={'vehiclePhoto '+(size==='small'?'vehiclePhotoSmall ':'')+className} data-vehicle-photo={photo?'real':'fallback'}>
  {photo?<img loading="lazy" src={photo.src} alt={label} title={(photo.title||photo.note||label)+' · '+photo.author+' · '+photo.license} referrerPolicy="no-referrer" onError={()=>setPhoto(null)}/>:<span className="vehiclePhotoFallback" aria-label={'Zdjęcie niedostępne: '+label}>🚘</span>}
  {photo&&<a className="vehiclePhotoCredit" href={photo.source} target="_blank" rel="noopener noreferrer" title={photo.author+' · '+photo.license} aria-label={'Autor: '+photo.author+', licencja: '+photo.license+', otwórz źródło zdjęcia'} onClick={event=>event.stopPropagation()}>©</a>}
 </span>
}
