import React,{useEffect,useMemo,useState} from 'react'
import {Icon} from './ui.jsx'
import './delivery-document-import.css'

const money=value=>new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',minimumFractionDigits:2}).format(Number(value||0))
const blankItem=()=>({enabled:true,part_no:'',name:'',qty:1,unit_cost:0,net_total:0,vat_rate:23,vat_amount:0,gross_total:0,confidence:'CHECK'})
const phaseLabel={
  'loading tesseract core':'Uruchamianie silnika OCR',
  'initializing tesseract':'Przygotowanie skanera',
  'loading language traineddata':'Ładowanie języka polskiego',
  'initializing api':'Analiza układu strony',
  'recognizing text':'Odczytywanie tabeli'
}

export function DeliveryDocumentImport({api,close,onImported}){
 const[phase,setPhase]=useState('SCANNING'),[progress,setProgress]=useState({status:'Wybierz zdjęcie dokumentu',progress:0}),[scan,setScan]=useState(null),[document,setDocument]=useState(null),[error,setError]=useState(''),[result,setResult]=useState(null)
 const scanDocument=async()=>{setPhase('SCANNING');setError('');setResult(null);setScan(null);setDocument(null);try{const next=await api.inventory.scanDeliveryDocument();if(next.canceled){close();return}setScan(next);setDocument({...next.document,items:(next.document.items||[]).map((item,index)=>({...item,enabled:true,key:`${Date.now()}-${index}`}))});setPhase('REVIEW')}catch(err){setError(err.message||String(err));setPhase('ERROR')}}
 useEffect(()=>{const cleanup=api.inventory.onDeliveryDocumentProgress?.(setProgress);scanDocument();return typeof cleanup==='function'?cleanup:undefined},[])
 const selected=(document?.items||[]).filter(item=>item.enabled),invalidQuantity=selected.some(item=>!Number.isInteger(Number(item.qty))||Number(item.qty)<=0)
 const totals=useMemo(()=>selected.reduce((sum,item)=>({qty:sum.qty+Number(item.qty||0),net:sum.net+Number(item.qty||0)*Number(item.unit_cost||0),gross:sum.gross+Number(item.gross_total||0)}),{qty:0,net:0,gross:0}),[selected])
 const updateHeader=(field,value)=>setDocument(current=>({...current,[field]:value}))
 const updateItem=(key,field,value)=>setDocument(current=>({...current,items:current.items.map(item=>item.key===key?{...item,[field]:value}:item)}))
 const removeItem=key=>setDocument(current=>({...current,items:current.items.filter(item=>item.key!==key)}))
 const addItem=()=>setDocument(current=>({...current,items:[...current.items,{...blankItem(),key:`manual-${Date.now()}`}]}))
 const submit=async()=>{if(!selected.length||scan?.duplicate)return;setPhase('IMPORTING');setError('');try{const imported=await api.inventory.importDeliveryDocument({...scan,document:{...document,items:selected}});setResult(imported);setPhase('DONE');onImported?.(imported)}catch(err){setError(err.message||String(err));setPhase('REVIEW')}}
 const busy=['SCANNING','IMPORTING'].includes(phase)
 return <div className="deliveryShade" onMouseDown={event=>event.target===event.currentTarget&&!busy&&close()}>
  <section className="deliveryModal" role="dialog" aria-modal="true" aria-labelledby="delivery-title">
   <header><div className="deliveryTitleMark"><span><Icon name="documents"/></span><div><small>INTELIGENTNE PRZYJĘCIE DOSTAWY</small><h2 id="delivery-title">Skanuj dokument części</h2></div></div><button aria-label="Zamknij" onClick={close} disabled={busy}>×</button></header>
   {phase==='SCANNING'&&<div className="deliveryScanning"><div className="paperScanner"><div className="paperLines"><i/><i/><i/><i/><i/></div><span/></div><div><small>LOKALNE OCR · DANE NIE OPUSZCZAJĄ KOMPUTERA</small><h3>{phaseLabel[progress.status]||progress.status||'Odczytywanie dokumentu'}</h3><p>{progress.file_name||'Wybierz zdjęcie lub skan kartki z hurtowni.'}</p><div className="deliveryProgress"><i style={{width:`${Math.max(4,Math.round(Number(progress.progress||0)*100))}%`}}/></div><b>{Math.round(Number(progress.progress||0)*100)}%</b></div></div>}
   {phase==='ERROR'&&<div className="deliveryFailure"><Icon name="notifications" size={30}/><h3>Nie udało się odczytać dokumentu</h3><p>{error}</p><button className="primary" onClick={scanDocument}>Wybierz inne zdjęcie</button></div>}
   {phase==='DONE'&&<div className="deliverySuccess"><span>✓</span><small>DOSTAWA PRZYJĘTA</small><h3>{result.item_count} pozycji trafiło do magazynu</h3><p>Utworzono {result.created} nowych kart części, a stan {result.updated} istniejących kart został zwiększony.</p><div><b>{Number(result.quantity||0).toLocaleString('pl-PL')} szt.</b><span>{result.supplier_name}</span></div><button className="primary" onClick={close}>Przejdź do magazynu</button></div>}
   {phase==='REVIEW'&&document&&<>
    <div className="deliverySummary"><div><small>PLIK</small><b>{scan.file_name}</b><span>Pewność OCR {Number(document.ocr_confidence||0).toFixed(0)}%</span></div><div><small>POZYCJE</small><b>{selected.length}</b><span>{document.items.filter(item=>item.confidence==='CHECK').length} do sprawdzenia</span></div><div><small>WARTOŚĆ DOKUMENTU</small><b>{money(document.gross_total||totals.gross)}</b><span>brutto</span></div><button onClick={scanDocument}>↻ Inny dokument</button></div>
    {scan.duplicate&&<div className="deliveryDuplicate"><b>Ten dokument jest już w magazynie</b><span>Import #{scan.duplicate.id}{scan.duplicate.external_document_no?` · ${scan.duplicate.external_document_no}`:''}{scan.duplicate.supplier?` · ${scan.duplicate.supplier}`:''}. Wybierz inne zdjęcie, aby nie podwoić stanów.</span></div>}
    {document.warnings?.length>0&&<div className="deliveryWarnings">{document.warnings.map((warning,index)=><span key={index}>! {warning}</span>)}</div>}
    <div className="deliveryMeta"><label>Dostawca<input value={document.supplier_name||''} onChange={event=>updateHeader('supplier_name',event.target.value)} placeholder="Nazwa hurtowni"/></label><label>Numer dokumentu<input value={document.document_no||''} onChange={event=>updateHeader('document_no',event.target.value)} placeholder="np. 3/WZ/2025/16969"/></label><label>Data dostawy<input type="date" value={document.document_date||''} onChange={event=>updateHeader('document_date',event.target.value)}/></label></div>
    <div className="deliveryTableWrap"><table className="deliveryTable"><thead><tr><th aria-label="Importuj"/><th>Numer katalogowy</th><th>Nazwa części</th><th>Ilość</th><th>Cena zakupu netto</th><th>VAT</th><th>Wartość brutto</th><th/></tr></thead><tbody>{document.items.map((item,index)=><tr key={item.key} className={`${item.enabled?'':'disabled'} ${item.confidence==='CHECK'?'check':''}`}><td><input aria-label={`Importuj pozycję ${index+1}`} type="checkbox" checked={item.enabled} onChange={event=>updateItem(item.key,'enabled',event.target.checked)}/></td><td><input value={item.part_no} onChange={event=>updateItem(item.key,'part_no',event.target.value.toUpperCase())}/>{item.confidence==='CHECK'&&<small>SPRAWDŹ Z KARTKĄ</small>}</td><td><input value={item.name} onChange={event=>updateItem(item.key,'name',event.target.value)}/></td><td><input type="number" min="1" step="1" inputMode="numeric" value={item.qty} onChange={event=>updateItem(item.key,'qty',event.target.value)}/></td><td><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={event=>updateItem(item.key,'unit_cost',event.target.value)}/></td><td><input type="number" min="0" step="1" value={item.vat_rate||23} onChange={event=>updateItem(item.key,'vat_rate',event.target.value)}/></td><td><input type="number" min="0" step="0.01" value={item.gross_total||0} onChange={event=>updateItem(item.key,'gross_total',event.target.value)}/></td><td><button aria-label={`Usuń pozycję ${index+1}`} onClick={()=>removeItem(item.key)}>×</button></td></tr>)}</tbody></table></div>
    <button className="deliveryAddRow" onClick={addItem}>+ Dodaj brakującą pozycję</button>
    {invalidQuantity&&<div className="deliveryImportError">Ilość części musi być pełną liczbą sztuk, np. 1, 2 lub 3.</div>}
    {error&&<div className="deliveryImportError">{error}</div>}
    <footer><div><small>DO MAGAZYNU</small><b>{selected.length} pozycji · {totals.qty.toLocaleString('pl-PL')} szt.</b><span>Wartość netto z rozpoznanych cen: {money(totals.net)}</span></div><button onClick={close}>Anuluj</button><button className="primary" disabled={!selected.length||invalidQuantity||Boolean(scan.duplicate)} onClick={submit}>Przyjmij do magazynu →</button></footer>
   </>}
   {phase==='IMPORTING'&&<div className="deliveryImporting"><span/><h3>Aktualizuję stany magazynowe…</h3><p>Tworzę dokument dostawy i łączę numery katalogowe z istniejącymi kartami.</p></div>}
  </section>
 </div>
}
