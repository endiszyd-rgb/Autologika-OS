import React from 'react'
import {contactPhone,orderContactMessage,smsLink} from './pwa-contact.mjs'

export function PwaOrderContact({order}){
 const phone=contactPhone(order.phone)
 if(!phone)return null
 const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)
 return <section className="pwaOrderContact" aria-label="Szybki kontakt z klientem"><div><b>{order.customer||'Kontakt z klientem'}</b><small>{order.phone}</small></div><div className="pwaOrderContactActions"><a href={`tel:${phone}`} aria-label={`Zadzwoń do klienta ${order.customer||''}`}>☎ Zadzwoń</a><a href={smsLink(phone,orderContactMessage(order),ios)} aria-label={order.status==='GOTOWE'?'Przygotuj SMS: auto gotowe do odbioru':'Przygotuj SMS do klienta'}>✉ {order.status==='GOTOWE'?'SMS: auto gotowe':'Napisz SMS'}</a></div><small>Treść możesz zmienić przed wysłaniem w Wiadomościach.</small></section>
}
