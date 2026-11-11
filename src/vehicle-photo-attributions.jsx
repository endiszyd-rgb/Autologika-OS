import React,{useState} from 'react'
import {verifiedVehiclePhotos} from './vehicle-photo-manifest.mjs'
import {vehiclePhotoInventory,vehiclePhotoInventorySummary} from './vehicle-photo-inventory.mjs'
import './vehicle-photo-attributions.css'

// All source and license links are outside interactive cards; coverage is explicit.
export function VehiclePhotoAttributions(){
 const [filter,setFilter]=useState('')
 const [onlyMissing,setOnlyMissing]=useState(true)
 const visible=vehiclePhotoInventory.filter(row=>(!onlyMissing||row.status==='missing')&&
  (row.make+' '+row.model).toLocaleLowerCase('pl-PL').includes(filter.toLocaleLowerCase('pl-PL')))
 const summary=vehiclePhotoInventorySummary
 return <section className="vehiclePhotoAttributions">
  <h3>Biblioteka zdjęć samochodów</h3>
  <p>Indeks obejmuje wszystkie modele katalogu. Zdjęcie pojawia się dopiero po weryfikacji konkretnej generacji i rocznika. Brak zdjęcia nigdy nie oznacza braku pojazdu w bazie.</p>
  <div className="vehiclePhotoStats" role="status">
   <strong>{summary.withPhotos} / {summary.total} modeli ze zdjęciem</strong>
   <span>{summary.withoutPhotos} modeli bez fotografii · {summary.referencedImages} zatwierdzonych przypisań</span>
   <progress max={summary.total} value={summary.withPhotos} aria-label="Pokrycie katalogu zdjęciami"/>
  </div>
  <details>
   <summary>Pełny indeks modeli i braki fotografii</summary>
   <div className="vehiclePhotoInventoryToolbar">
    <label>Szukaj marki lub modelu <input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="np. Audi A6"/></label>
    <label><input type="checkbox" checked={onlyMissing} onChange={e=>setOnlyMissing(e.target.checked)}/> Tylko brakujące</label>
   </div>
   <p>Wyniki: {visible.length}. Modele ze zdjęciem mogą nadal mieć brakujące generacje lub odmiany nadwozia.</p>
   <ul className="vehiclePhotoInventoryRows">
    {visible.map(item=><li key={item.key}>
     <b>{item.make} {item.model}</b>
     <span>{item.photoCount?item.photoCount+' zdjęć referencyjnych':'Brak fotografii'}</span>
     {item.generationCount>0&&<small>{item.generations.filter(g=>g.photoCount>0).length} z {item.generationCount} generacji szczegółowych z fotografią</small>}
    </li>)}
   </ul>
  </details>
  <details>
   <summary>Autorzy, źródła i licencje ({verifiedVehiclePhotos.length})</summary>
   <div className="vehiclePhotoAttributionList">
    {verifiedVehiclePhotos.map((item,index)=><article key={item.source||index}>
     <div><strong>{item.make} {item.model}</strong><span>{[item.generation,item.from&&item.to?`${item.from}–${item.to}`:'',item.note].filter(Boolean).join(' · ')}</span></div>
     <div><span>Autor: {item.author}</span><span>Licencja: <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a></span><a href={item.source} target="_blank" rel="noopener noreferrer">Fotografia i dane źródłowe</a></div>
    </article>)}
   </div>
  </details>
 </section>
}
