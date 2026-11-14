import React,{useId} from 'react'
import {deliveryReviewSummary,stepQuantity} from '../parts-model.mjs'

const money=value=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',minimumFractionDigits:2}).format(Number(value||0))
const quantity=value=>Number(value||0).toLocaleString('pl-PL')
const itemsLabel=count=>count===1?'pozycję':count%10>=2&&count%10<=4&&(count%100<12||count%100>14)?'pozycje':'pozycji'

export function PwaDeliveryReview({document,setDocument,disabled}){
 const uid=useId()
 const update=(index,key,value)=>setDocument(current=>({...current,items:current.items.map((item,i)=>i===index?{...item,[key]:value}:item)}))
 const summary=deliveryReviewSummary(document)
 return <div className="pwaDeliveryReview">
  <div className="pwaReviewHead"><h3>Sprawdź odczytane części</h3><p>Po zatwierdzeniu ilości zwiększą stan magazynowy, a ceny netto zaktualizują koszt zakupu.</p></div>
  <dl className="pwaReviewSummary"><div><dt>Do przyjęcia</dt><dd>{summary.selected}/{summary.total}</dd></div><div><dt>Sztuk</dt><dd>{quantity(summary.quantity)}</dd></div><div><dt>Netto</dt><dd>{money(summary.net)}</dd></div></dl>
  {summary.toCheck>0&&<p className="pwaReviewHint">Oznaczyliśmy {summary.toCheck} {itemsLabel(summary.toCheck)} do sprawdzenia — porównaj je z kartką.</p>}
  {summary.invalid>0&&<p className="warnbox">Ilość musi być pełną liczbą sztuk, np. 1, 2 lub 3.</p>}
  {document.warnings?.map((warning,index)=><p className="warnbox" key={index}>{warning}</p>)}
  <div className="pwaReviewMeta"><label>Dostawca<input disabled={disabled} value={document.supplier_name||''} onChange={e=>setDocument({...document,supplier_name:e.target.value})} placeholder="Nazwa hurtowni"/></label><label>Numer faktury / WZ<input disabled={disabled} value={document.document_no||''} onChange={e=>setDocument({...document,document_no:e.target.value})} autoCapitalize="characters" autoCorrect="off" spellCheck={false}/></label></div>
  {document.items.map((item,index)=>{const qtyId=`${uid}-qty-${index}`,enabled=item.enabled!==false;return <fieldset disabled={disabled} className={'pwaDeliveryItem'+(enabled?'':' skipped')+(item.confidence==='CHECK'?' check':'')} key={index}>
   <legend><span>Pozycja {index+1}</span>{item.confidence==='CHECK'&&<em>sprawdź z dokumentem</em>}</legend>
   <label className="pwaItemToggle"><input type="checkbox" checked={enabled} onChange={e=>update(index,'enabled',e.target.checked)}/><span>Przyjmij tę pozycję</span></label>
   <label>Numer części<input value={item.part_no} onChange={e=>update(index,'part_no',e.target.value)} autoCapitalize="characters" autoCorrect="off" spellCheck={false}/></label>
   <label>Nazwa<input value={item.name} onChange={e=>update(index,'name',e.target.value)}/></label>
   <div className="pwaDeliveryNumbers"><div className="pwaQtyField"><span id={qtyId}>Ilość</span><div className="pwaQtyStepper"><button type="button" aria-label={`Zmniejsz ilość — pozycja ${index+1}`} disabled={Number(item.qty)<=1} onClick={()=>update(index,'qty',stepQuantity(item.qty,-1))}>−</button><input aria-labelledby={qtyId} type="number" inputMode="numeric" min="1" step="1" value={item.qty} onChange={e=>update(index,'qty',e.target.value)}/><button type="button" aria-label={`Zwiększ ilość — pozycja ${index+1}`} onClick={()=>update(index,'qty',stepQuantity(item.qty,1))}>+</button></div></div><label>Zakup netto / szt. [zł]<input type="number" inputMode="decimal" min="0" step="0.01" value={item.unit_cost} onChange={e=>update(index,'unit_cost',e.target.value)}/></label></div>
   <div className="pwaItemTotal"><span>Wartość netto</span><b>{money(Number(item.qty||0)*Number(item.unit_cost||0))}</b></div>
  </fieldset>})}
  <button className="pwaAddItem" disabled={disabled} type="button" onClick={()=>setDocument({...document,items:[...document.items,{part_no:'',name:'',qty:1,unit_cost:0,confidence:'CHECK'}]})}>+ Dodaj pominiętą pozycję</button>
 </div>
}
