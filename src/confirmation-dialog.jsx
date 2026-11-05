import React,{useEffect,useState} from 'react'
import {useModalBehavior} from './modal-behavior.js'
import {confirmationQueue} from './confirmation-queue.mjs'
export {confirmAction} from './confirmation-queue.mjs'

export function ConfirmationHost(){
 const[queue,setQueue]=useState([])
 const current=queue[0]
 useEffect(()=>confirmationQueue.subscribe(request=>setQueue(items=>[...items,request])),[])
 const finish=result=>{if(!current)return;current.resolve(result);setQueue(items=>items.slice(1))}
 return current?<ConfirmationDialog request={current} finish={finish}/>:null
}

function ConfirmationDialog({request,finish}){
 const[busy,setBusy]=useState(false),[error,setError]=useState('')
 const close=()=>{if(!busy)finish(false)}
 const dialogRef=useModalBehavior(close,busy)
 const execute=async()=>{if(busy)return;setBusy(true);setError('');try{await request.options.onConfirm?.();finish(true)}catch(reason){setError(String(reason?.message||reason).replace(/^Error invoking remote method '[^']+': Error:\s*/,''));setBusy(false)}}
 const{title='Potwierdź operację',message='',details=[],confirmLabel='Potwierdź',cancelLabel='Anuluj',tone='danger'}=request.options
 const rows=Array.isArray(details)?details:String(details||'').split('\n').filter(Boolean)
 return <div className="modalback confirmationBack" onMouseDown={event=>event.target===event.currentTarget&&close()}><div ref={dialogRef} className="modal confirmationModal" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message" tabIndex={-1}><div className="modalhead"><div className="modalTitle"><small>WYMAGANE POTWIERDZENIE</small><h2 id="confirmation-title">{title}</h2></div><div className="modalHeadActions"><kbd>Esc</kbd><button type="button" disabled={busy} aria-label="Anuluj operację" onClick={close}>×</button></div></div><div className={'confirmationBody '+tone}><div className="confirmationIcon" aria-hidden="true">!</div><div><p id="confirmation-message">{message}</p>{rows.length>0&&<ul>{rows.map((row,index)=><li key={`${row}-${index}`}>{row}</li>)}</ul>}</div></div>{error&&<div className="confirmationError" role="alert"><b>Operacja nie została wykonana</b><span>{error}</span></div>}<div className="modalactions confirmationActions"><button type="button" disabled={busy} onClick={close}>{cancelLabel}</button><button type="button" className={tone==='danger'?'danger':'primary'} disabled={busy} onClick={execute}>{busy?'Wykonywanie…':confirmLabel}</button></div></div></div>
}
