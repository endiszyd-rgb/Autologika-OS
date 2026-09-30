function wholePartQuantity(value,{allowZero=false,label='Ilość części'}={}){
  const quantity=Number(value),minimum=allowZero?0:1
  if(!Number.isFinite(quantity)||!Number.isInteger(quantity)||quantity<minimum){
    throw new Error(`${label} musi być liczbą całkowitą${allowZero?' równą zero lub większą':' większą od zera'}, np. 1, 2 lub 3 szt.`)
  }
  return quantity
}

function roundedPartQuantity(value,{allowZero=false}={}){
  const quantity=Number(value),minimum=allowZero?0:1
  if(!Number.isFinite(quantity))return minimum
  return Math.max(minimum,Math.round(quantity))
}

module.exports={wholePartQuantity,roundedPartQuantity}

