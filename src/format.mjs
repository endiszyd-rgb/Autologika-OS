// Wspólne formatowanie liczb i kwot na ekranach aplikacji.
// Zasady (jedne dla wszystkich zakładek):
//  - separator tysięcy zawsze, także dla liczb 4-cyfrowych („4 860 zł”, nie „4860 zł”);
//  - moneyWhole: pełne złote — kafelki, listy, podsumowania;
//  - moneyExact: zawsze dwa miejsca po przecinku — pozycje kosztorysu, płatności, ceny części, dokumenty.
// Wydruki (protokoły, PDF) mają własne formatowanie i nie korzystają z tego modułu.

const whole=new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',minimumFractionDigits:0,maximumFractionDigits:0,useGrouping:'always',signDisplay:'negative'})
const exact=new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN',minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always',signDisplay:'negative'})
const plain=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2,useGrouping:'always'})

const hours=new Intl.NumberFormat('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1,useGrouping:'always'})

const toNumber=value=>{const number=Number(value);return Number.isFinite(number)?number:0}

export const moneyWhole=value=>whole.format(toNumber(value))
export const moneyExact=value=>exact.format(toNumber(value))
export const formatNumber=value=>plain.format(toNumber(value))
// Czas pracy zawsze z przecinkiem i jedną cyfrą po nim: „1,5 h”
export const formatHours=value=>`${hours.format(toNumber(value))} h`
const percentFormats=new Map()
const percentFormat=digits=>{if(!percentFormats.has(digits))percentFormats.set(digits,new Intl.NumberFormat('pl-PL',{minimumFractionDigits:digits,maximumFractionDigits:digits}));return percentFormats.get(digits)}
// Procenty z przecinkiem: „12,5%”
export const formatPercent=(value,digits=1)=>`${percentFormat(Math.max(0,Math.min(4,Math.round(digits))))
 .format(toNumber(value))}%`
// Telefon: polskie numery 9-cyfrowe w grupach „500 600 700” (z +48 lub bez); inne zostają bez zmian
export function formatPhone(value){
 const raw=String(value??'').trim()
 const digits=raw.replace(/[^\d+]/g,'')
 const match=digits.match(/^(\+?48)?(\d{9})$/)
 if(!match)return raw
 const local=match[2].replace(/(\d{3})(\d{3})(\d{3})/,'$1 $2 $3')
 return match[1]?`+48 ${local}`:local
}
