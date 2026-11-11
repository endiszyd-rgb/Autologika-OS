import React from 'react'
import {verifiedVehiclePhotos} from './vehicle-photo-manifest.mjs'
import './vehicle-photo-attributions.css'

// Attribution is deliberately outside interactive vehicle cards (no nested links).
export function VehiclePhotoAttributions(){
 return <details className="vehiclePhotoAttributions">
  <summary>Fotografie pojazdów — autorzy, źródła i licencje ({verifiedVehiclePhotos.length})</summary>
  <p>AutoLogika wykorzystuje fotografie rzeczywistych pojazdów udostępnione na podanych licencjach. Przy zdjęciach modyfikowanych lub kadrowanych wymagane jest zachowanie warunków ich licencji. Gdy zdjęcie nie pasuje do wersji pojazdu, system wyświetla neutralny symbol.</p>
  <div className="vehiclePhotoAttributionList">
   {verifiedVehiclePhotos.map((item,index)=><article key={item.source||index}>
    <div><strong>{item.make} {item.model}</strong><span>{[item.generation,item.from&&item.to?`${item.from}–${item.to}`:'',item.note].filter(Boolean).join(' · ')}</span></div>
    <div><span>Autor: {item.author}</span><span>Licencja: <a href={item.licenseUrl} target="_blank" rel="noopener noreferrer">{item.license}</a></span><a href={item.source} target="_blank" rel="noopener noreferrer">Otwórz fotografię i dane źródłowe</a></div>
   </article>)}
  </div>
 </details>
}
