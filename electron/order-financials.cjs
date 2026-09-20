const ORDER_BASE_SQL=`COALESCE(o.labor_hours,0)*COALESCE(o.labor_rate,0)+COALESCE(o.parts_sale,0)+COALESCE(o.other_sale,0)+COALESCE(o.diagnosis_fee,0)-COALESCE(o.discount,0)`
const ORDER_TOTAL_SQL=`COALESCE(o.final_price,${ORDER_BASE_SQL})`
const ORDER_COST_SQL=`COALESCE(o.parts_cost,0)+COALESCE(o.other_cost,0)`

function normalizeFinalPrice(value){
 if(value===null||value===undefined||String(value).trim()==='')return null
 const number=Number(value)
 if(!Number.isFinite(number)||number<0||number>100000000)throw new Error('Cena końcowa musi być liczbą od 0 do 100 000 000 zł.')
 return Math.round(number*100)/100
}

function finalPriceChange({previous=null,next=null,note=''}){
 const before=normalizeFinalPrice(previous),after=normalizeFinalPrice(next),reason=String(note||'').trim()
 if(after!==null&&!reason)throw new Error('Podaj powód zmiany ceny końcowej.')
 return {before,after,note:reason}
}

module.exports={ORDER_BASE_SQL,ORDER_TOTAL_SQL,ORDER_COST_SQL,normalizeFinalPrice,finalPriceChange}
