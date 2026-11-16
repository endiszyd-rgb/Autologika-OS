// Kwoty w tekstach tworzonych poza ekranem (wydruki, protokoły PDF, historia zlecenia, komunikaty).
// Te same zasady co na ekranach (src/format.mjs): odstęp tysięcy zawsze, przecinek dziesiętny, dwa miejsca po przecinku.
const exact=new Intl.NumberFormat('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:'always'})
const hours=new Intl.NumberFormat('pl-PL',{minimumFractionDigits:1,maximumFractionDigits:1,useGrouping:'always'})
const quantity=new Intl.NumberFormat('pl-PL',{maximumFractionDigits:2,useGrouping:'always'})
const toNumber=value=>{const number=Number(value);return Number.isFinite(number)?number:0}

// „12 999,99 zł”
function formatMoney(value){return `${exact.format(toNumber(value))} zł`}
// „1 500”, „1,5”
function formatQuantity(value){return quantity.format(toNumber(value))}

// „1,5 h”
function formatHours(value){return `${hours.format(toNumber(value))} h`}

module.exports={formatMoney,formatQuantity,formatHours}
