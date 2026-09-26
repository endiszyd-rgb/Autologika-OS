import React,{useCallback,useEffect,useMemo,useState} from 'react'
import {matchingVehicleParts,oeNumbers} from './vehicle-part-match.js'
import {normalizeProductBarcode} from './zebra-scanner.js'

const keyOf=part=>`${part?.brand||''}|${part?.part_no||''}|${part?.name||''}`

export function QuotePartLookup({api,order,value,onChange,disabled=false}){
 const[inventory,setInventory]=useState([]),[query,setQuery]=useState(''),[barcode,setBarcode]=useState(''),[partNumber,setPartNumber]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(null),[choices,setChoices]=useState([]),[selectedKey,setSelectedKey]=useState('')
 useEffect(()=>{if(!disabled)api.inventory.list('').then(setInventory)},[api,disabled])
 const matches=useMemo(()=>query.trim()?matchingVehicleParts(inventory,order,query).slice(0,6):[],[inventory,order,query])
 const selectPart=useCallback((part,inventoryId='')=>{
  const numbers=oeNumbers(part.cross_numbers)
  onChange({
   name:part.name||'',part_no:part.part_no||'',oe_number:numbers[0]||value.oe_number||'',inventory_part_id:inventoryId||null,
   barcode:part.barcode||barcode||'',brand:part.brand||'',supplier_name:part.supplier||part.supplier_name||'',
   vehicle_fitment:part.vehicle_fitment||value.vehicle_fitment||'',cross_numbers:part.cross_numbers||'',lookup_source:part.lookup_source||'',lookup_url:part.lookup_url||'',
   unit_cost:Number(part.unit_cost||0),unit_price:Number(part.sell_price||part.unit_price||0)
  })
  setSelectedKey(keyOf(part))
 },[barcode,onChange,value.oe_number,value.vehicle_fitment])
 const showResult=(result,mode)=>{
  if(!result?.found){setMessage({tone:'missing',title:'Nie znaleziono jednoznacznego wyniku',detail:result?.unavailable?'Źródła internetowe są chwilowo niedostępne. Dane możesz wpisać ręcznie.':'Sprawdź numer albo uzupełnij część ręcznie.'});return}
  selectPart(result.item,result.source==='local'?result.item.id:'')
  const alternatives=result.source==='local'?[]:[result.item,...(Array.isArray(result.item.lookup_alternatives)?result.item.lookup_alternatives:[])]
  setChoices(alternatives)
  setMessage({tone:result.source==='local'?'local':'online',title:result.source==='local'?'Część znaleziona w Twoim magazynie':alternatives.length>1?'Znaleziono kilka pasujących części':'Znaleziono dane części',detail:`${result.item.brand||'Producent nieustalony'} · ${result.item.part_no||mode}`})
 }
 const lookupBarcode=useCallback(async raw=>{
  const code=normalizeProductBarcode(raw||barcode);if(!code||busy||disabled)return
  setBarcode(code);setBusy(true);setMessage(null);setChoices([])
  try{showResult(await api.inventory.lookupBarcode(code),code)}catch(error){setMessage({tone:'error',title:'Nie udało się wyszukać kodu',detail:error.message||String(error)})}finally{setBusy(false)}
 },[api,barcode,busy,disabled,selectPart])
 const lookupPartNumber=async()=>{
  const number=partNumber.trim();if(!number||busy||disabled)return
  setBusy(true);setMessage(null);setChoices([])
  try{const result=await api.inventory.lookupPartNumber(number);showResult(result,number);if(!result?.found)onChange({part_no:result?.partNo||number,inventory_part_id:null})}catch(error){onChange({part_no:number,inventory_part_id:null});setMessage({tone:'error',title:'Nie udało się wyszukać numeru',detail:error.message||String(error)})}finally{setBusy(false)}
 }
 useEffect(()=>{const receive=event=>{const code=event.detail?.barcode;if(!code||disabled)return;event.preventDefault();lookupBarcode(code)};window.addEventListener('autologika:product-scan',receive);return()=>window.removeEventListener('autologika:product-scan',receive)},[disabled,lookupBarcode])
 return <div className="wide quotePartLookup">
  <div className="quotePartLookupHead"><div><small>DANE CZĘŚCI</small><b>Wyszukaj w magazynie albo zeskanuj opakowanie</b><span>Wybrany wynik uzupełni nazwę, producenta, numer katalogowy, OE i cenę.</span></div>{value.inventory_part_id&&<em>POŁĄCZONO Z MAGAZYNEM</em>}</div>
  <div className="quotePartLookupGrid"><label>Kod EAN / UPC / GTIN<input data-quote-part-barcode disabled={disabled} value={barcode} onChange={e=>setBarcode(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookupBarcode()} placeholder="Zeskanuj kod Zebra"/></label><button type="button" disabled={disabled||busy||!barcode.trim()} onClick={()=>lookupBarcode()}>{busy?'Szukam…':'Szukaj kodu'}</button><label>Numer katalogowy<input data-quote-part-number disabled={disabled} value={partNumber} onChange={e=>setPartNumber(e.target.value)} onKeyDown={e=>e.key==='Enter'&&lookupPartNumber()} placeholder="np. W 712/95"/></label><button type="button" disabled={disabled||busy||!partNumber.trim()} onClick={lookupPartNumber}>{busy?'Szukam…':'Szukaj numeru'}</button></div>
  <label className="quoteInventorySearch">Wybierz ze swojego magazynu<input disabled={disabled} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nazwa, producent, numer katalogowy lub OE"/></label>
  {message&&<div className={`jobPartLookup ${message.tone}`}><div><b>{message.title}</b><span>{message.detail}</span></div></div>}
  {choices.length>1&&<div className="jobPartAlternatives quotePartAlternatives">{choices.map((part,index)=><button type="button" key={`${keyOf(part)}-${index}`} className={selectedKey===keyOf(part)?'selected':''} onClick={()=>selectPart(part)}><b>{part.brand||'Producent nieustalony'}</b><strong>{part.part_no||'brak numeru'}</strong><span>{part.name}</span><small>OE: {oeNumbers(part.cross_numbers).slice(0,3).join(' · ')||'brak danych'}</small></button>)}</div>}
  {matches.length>0&&<div className="vehiclePartMatches quotePartMatches">{matches.map(part=><button type="button" key={part.id} className={String(value.inventory_part_id)===String(part.id)?'selected':''} onClick={()=>selectPart(part,part.id)}><b>{part.name}</b><span>{part.brand||'producent nieustalony'} · {part.part_no||'brak numeru'}</span><small>OE / zamienniki: {oeNumbers(part.cross_numbers).slice(0,4).join(' · ')||'brak w bazie'}</small></button>)}</div>}
 </div>
}
