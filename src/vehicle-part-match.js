const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim()

export function vehicleLabel(vehicle={}){
  const identity=[vehicle.make,vehicle.model,vehicle.generation,vehicle.year].filter(Boolean).join(' ')
  const engine=[vehicle.engine,vehicle.engine_code].filter(Boolean).join(' · ')
  return `${vehicle.plate||'bez rejestracji'} · ${identity||'pojazd bez opisu'}${engine?` · ${engine}`:''}`
}

export function oeNumbers(value){
  return [...new Set(String(value||'').split(/[\n,;|]+/).map(x=>x.trim()).filter(x=>/^[A-Z0-9][A-Z0-9 .\/-]{3,30}$/i.test(x)))]
}

export function vehiclePartScore(part={},vehicle={}){
  const fitment=clean(part.vehicle_fitment)
  if(!fitment)return 0
  const make=clean(vehicle.make),model=clean(vehicle.model),generation=clean(vehicle.generation),engine=clean(vehicle.engine),code=clean(vehicle.engine_code)
  if(!make||!fitment.includes(make))return 0
  let score=10
  if(model&&fitment.includes(model))score+=30
  if(generation&&fitment.includes(generation))score+=15
  if(engine&&fitment.includes(engine))score+=10
  if(code&&fitment.includes(code))score+=20
  return score
}

export function matchingVehicleParts(parts,vehicle,query=''){
  const needle=clean(query)
  return parts.map(part=>({part,score:vehiclePartScore(part,vehicle)}))
    .filter(x=>x.score>0&&(!needle||clean(`${x.part.name} ${x.part.part_no} ${x.part.brand} ${x.part.cross_numbers}`).includes(needle)))
    .sort((a,b)=>b.score-a.score||String(a.part.name).localeCompare(String(b.part.name),'pl'))
    .map(x=>x.part)
}
