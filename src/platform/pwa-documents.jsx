import React,{useEffect,useState} from 'react'
import {PwaDocumentCapture} from './pwa-document-capture.jsx'
export function Documents({api,Panel,Loading}){
 const[docs,setDocs]=useState(null),[error,setError]=useState(''),[capture,setCapture]=useState('')
 const load=()=>api.documents.list().then(setDocs).catch(reason=>setError(reason.message))
 useEffect(()=>{load()},[])
 return <section className="documentsPage"><Panel title="Dokumenty w chmurze"><p>Zdjęcia, skany i PDF-y zapisane w warsztacie oraz dokumentacja zleceń.</p><button className="primary" onClick={()=>setCapture('file')}>Dodaj zdjęcie / PDF</button><button className="primary" onClick={()=>setCapture('delivery')}>Skanuj dostawę do magazynu</button></Panel>{error&&<div className="warnbox" role="alert">{error}</div>}{docs===null?<Loading/>:<div className="documentGrid">{docs.map(doc=><article className="documentCard" key={doc.document_key||doc.id}><div className="docBody"><h3>{doc.title}</h3><p>{doc.description}</p><small>{doc.file}</small></div><button className="primary" disabled={!doc.exists} onClick={()=>api.documents.open(doc.document_key||doc.id).catch(reason=>setError(reason.message))}>Otwórz dokument</button></article>)}{!docs.length&&<p>Nie ma jeszcze zapisanych dokumentów. Dodaj pierwszy aparatem lub z galerii.</p>}</div>}{capture&&<PwaDocumentCapture api={api} delivery={capture==='delivery'} close={()=>setCapture('')} onSaved={load}/>}</section>
}
