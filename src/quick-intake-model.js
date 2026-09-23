const clean=value=>String(value??'').trim()
const same=(left,right)=>clean(left)!==''&&clean(left)===clean(right)
const VEHICLE_FIELDS=['plate','vin','make','model','generation','year','engine','power_hp','engine_code','mileage']

export function intakeCustomerLabel(customer){
 const details=[customer?.phone,customer?.company].map(clean).filter(Boolean).join(' · ')
 return `${clean(customer?.name)||'Klient bez nazwy'}${details?` — ${details}`:''}`
}

export function filterIntakeCustomers(customers,query){
 const words=clean(query).toLocaleLowerCase('pl-PL').split(/\s+/).filter(Boolean)
 return [...(customers||[])].filter(customer=>{const text=[customer.name,customer.phone,customer.email,customer.company].map(clean).join(' ').toLocaleLowerCase('pl-PL');return words.every(word=>text.includes(word))}).slice(0,100)
}

export function selectIntakeCustomer(current,customer){
 const next={...current,customer_id:customer?.id||'',customer_name:clean(customer?.name),customer_phone:clean(customer?.phone),customer_email:clean(customer?.email),company:clean(customer?.company),vehicle_id:''}
 VEHICLE_FIELDS.forEach(key=>{next[key]=''})
 return next
}

export function clearIntakeCustomer(current){return selectIntakeCustomer(current,null)}

export function selectIntakeVehicle(current,vehicle,customers=[]){
 const owner=(customers||[]).find(customer=>same(customer.id,vehicle?.customer_id))
 const next={...current,vehicle_id:vehicle?.id||''}
 VEHICLE_FIELDS.forEach(key=>{next[key]=vehicle?.[key]??''})
 if(owner)Object.assign(next,{customer_id:owner.id,customer_name:clean(owner.name),customer_phone:clean(owner.phone),customer_email:clean(owner.email),company:clean(owner.company)})
 return next
}

export function clearIntakeVehicle(current){
 const next={...current,vehicle_id:''}
 VEHICLE_FIELDS.forEach(key=>{next[key]=''})
 return next
}

export function vehiclesForIntakeCustomer(vehicles,customerId){return (vehicles||[]).filter(vehicle=>!customerId||same(vehicle.customer_id,customerId))}

export function findScannedIntakeVehicle(vehicles,scan){
 const vin=clean(scan?.registration?.form?.vin||scan?.vin).replace(/\s/g,'').toUpperCase(),plate=clean(scan?.registration?.form?.plate).replace(/\s/g,'').toUpperCase()
 return (vehicles||[]).find(vehicle=>(vin&&clean(vehicle.vin).replace(/\s/g,'').toUpperCase()===vin)||(plate&&clean(vehicle.plate).replace(/\s/g,'').toUpperCase()===plate))||null
}
