const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pl-PL').replaceAll('ł','l').trim()

export function filterOrderRows(rows,{query='',status='',priority=''}={}){
 const words=normalize(query).split(/\s+/).filter(Boolean)
 return (rows||[]).filter(order=>{
  if(status&&order.status!==status)return false
  if(priority&&order.priority!==priority)return false
  if(!words.length)return true
  const text=normalize([order.id,order.plate,order.vin,order.make,order.model,order.generation,order.engine,order.engine_code,order.customer,order.phone,order.email,order.title,order.complaint,order.status,order.priority].join(' '))
  const compact=text.replace(/[^a-z0-9]/g,'')
  return words.every(word=>text.includes(word)||compact.includes(word.replace(/[^a-z0-9]/g,'')))
 })
}

export function orderFilterOptions(rows,key){return [...new Set((rows||[]).map(row=>row?.[key]).filter(Boolean))]}
