import {useEffect,useRef} from 'react'

const focusableSelector='button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[href],[tabindex]:not([tabindex="-1"])'

export function useModalBehavior(close,disabled=false){
 const dialogRef=useRef(null),closeRef=useRef(close),disabledRef=useRef(disabled)
 closeRef.current=close
 disabledRef.current=disabled
 useEffect(()=>{
  const previous=document.activeElement,overflow=document.body.style.overflow
  document.body.style.overflow='hidden'
  const focusable=()=>[...(dialogRef.current?.querySelectorAll(focusableSelector)||[])]
  const onKeyDown=event=>{
   if(!dialogRef.current?.contains(document.activeElement))return
   if(event.key==='Escape'&&!disabledRef.current){event.preventDefault();event.stopPropagation();closeRef.current();return}
   if(event.key!=='Tab')return
   const items=focusable()
   if(!items.length){event.preventDefault();dialogRef.current?.focus();return}
   const first=items[0],last=items[items.length-1]
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  }
  document.addEventListener('keydown',onKeyDown)
  const frame=requestAnimationFrame(()=>{const preferred=dialogRef.current?.querySelector('[autofocus]');(preferred||focusable()[0]||dialogRef.current)?.focus()})
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('keydown',onKeyDown);document.body.style.overflow=overflow;previous?.focus?.()}
 },[])
 return dialogRef
}
