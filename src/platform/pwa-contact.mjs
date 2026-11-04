// Keep phone links limited to a single dialable number, without URI parameters.
export function contactPhone(value){
 const source=String(value||'').trim()
 if(!/^\+?[\d\s().-]+$/.test(source))return ''
 const number=source.replace(/[^\d+]/g,'')
 return /^\+?\d{7,15}$/.test(number)?number:''
}
export function orderContactMessage(order={}){
 const vehicle=[order.make,order.model,order.plate].filter(Boolean).join(' · ')
 return order.status==='GOTOWE'
  ?`Dzień dobry, ${vehicle||'samochód'} jest gotowy do odbioru. Prosimy o kontakt w celu ustalenia odbioru. Pozdrawiamy, AutoLogika.`
  :`Dzień dobry, kontaktujemy się w sprawie ${vehicle||'samochodu'} (zlecenie #${order.id||'—'}). Prosimy o kontakt z warsztatem. Pozdrawiamy, AutoLogika.`
}
export function smsLink(phone,body='',ios=false){
 const number=contactPhone(phone)
 return number?`sms:${number}${body?(ios?'&':'?')+'body='+encodeURIComponent(body):''}`:''
}
