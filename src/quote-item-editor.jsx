import React,{useState} from 'react'
import {QuotePartLookup} from './quote-part-lookup.jsx'

const money=value=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(Number(value||0))

export function QuoteItemEditor({api,order,item,close,saved}){
 const[d,setD]=useState({...item,qty:Number(item.qty||1),unit_cost:Number(item.unit_cost||0),unit_price:Number(item.unit_price||0),labor_hours:Number(item.labor_hours||0),labor_rate:Number(item.labor_rate||0)}),[busy,setBusy]=useState(false),[error,setError]=useState('')
 const labor=d.kind==='ROBOCIZNA'
 const total=labor?Number(d.labor_hours||0)*Number(d.labor_rate||0):Number(d.qty||0)*Number(d.unit_price||0)
 const save=async()=>{setBusy(true);setError('');try{await api.quotes.updateItem(item.id,d);saved()}catch(reason){setError(reason.message||String(reason));setBusy(false)}}
 return <div className="quoteItemEditor">
  <div className="quoteItemEditorHead"><div><small>EDYCJA POZYCJI · {d.kind}</small><b>{d.work_name||d.name}</b></div><strong>{money(total)}</strong></div>
  <div className="formgrid">
   <label className="wide">Nazwa<input data-quote-edit-name value={d.name||''} onChange={event=>setD({...d,name:event.target.value})}/></label>
   {labor?<><label>Czas pracy [h]<input data-quote-edit-qty type="number" min="0.1" step="0.1" value={d.labor_hours} onChange={event=>setD({...d,labor_hours:event.target.value})}/></label><label>Stawka zł/h<input data-quote-edit-price type="number" min="0" step="0.01" value={d.labor_rate} onChange={event=>setD({...d,labor_rate:event.target.value})}/></label></>:<><label>{d.kind==='CZESC'?'Ilość [szt.]':'Ilość'}<input data-quote-edit-qty type="number" min={d.kind==='CZESC'?1:0.01} step={d.kind==='CZESC'?1:0.1} inputMode={d.kind==='CZESC'?'numeric':'decimal'} value={d.qty} onChange={event=>setD({...d,qty:event.target.value})}/></label><label>Koszt zakupu / szt.<input type="number" min="0" step="0.01" value={d.unit_cost} onChange={event=>setD({...d,unit_cost:event.target.value})}/></label><label>Cena dla klienta / szt.<input data-quote-edit-price type="number" min="0" step="0.01" value={d.unit_price} onChange={event=>setD({...d,unit_price:event.target.value})}/></label>{d.kind==='CZESC'&&<><QuotePartLookup api={api} order={order} value={d} onChange={patch=>setD(current=>({...current,...patch}))}/><label>Numer katalogowy<input value={d.part_no||''} onChange={event=>setD({...d,part_no:event.target.value})}/></label><label>Numer OE<input value={d.oe_number||''} onChange={event=>setD({...d,oe_number:event.target.value})}/></label><label>Producent<input value={d.brand||''} onChange={event=>setD({...d,brand:event.target.value})}/></label><label>Dostawca<input value={d.supplier_name||''} onChange={event=>setD({...d,supplier_name:event.target.value})}/></label></>}</>}
   <label className="wide">Opis dla klienta<textarea value={d.notes||d.customer_description||''} onChange={event=>setD({...d,notes:event.target.value,customer_description:event.target.value})}/></label>
  </div>
  {error&&<div className="warnbox">{error}</div>}
  <div className="actionrow right"><button onClick={close}>Anuluj</button><button className="primary" data-quote-edit-save disabled={busy||!String(d.name||'').trim()||(labor?Number(d.labor_hours)<=0:Number(d.qty)<=0)||(d.kind==='CZESC'&&!Number.isInteger(Number(d.qty)))} onClick={save}>{busy?'Zapisywanie…':'Zapisz pozycję'}</button></div>
 </div>
}
