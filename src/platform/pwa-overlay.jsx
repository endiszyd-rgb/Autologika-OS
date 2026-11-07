import {useEffect,useState} from 'react'
let locks=0,previousOverflow=''
export function usePwaOverlayViewport(){
 const measure=()=>{const viewport=window.visualViewport;return {'--pwa-overlay-top':`${viewport?.offsetTop||0}px`,'--pwa-overlay-height':`${viewport?.height||window.innerHeight}px`}}
 const[style,setStyle]=useState(measure)
 useEffect(()=>{
  const update=()=>setStyle(measure()),viewport=window.visualViewport
  if(locks++===0){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden'}
  viewport?.addEventListener('resize',update);viewport?.addEventListener('scroll',update);window.addEventListener('resize',update);update()
  return()=>{viewport?.removeEventListener('resize',update);viewport?.removeEventListener('scroll',update);window.removeEventListener('resize',update);if(--locks===0)document.body.style.overflow=previousOverflow}
 },[])
 return style
}
