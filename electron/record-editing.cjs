function text(value){return String(value??'').trim()}
function normalizedPlate(value){return text(value).replace(/\s+/g,' ').toUpperCase()}
function normalizedVin(value){return text(value).replace(/\s+/g,'').toUpperCase()}
function optionalNumber(value,{min=0,max=Number.MAX_SAFE_INTEGER,label='Wartość'}={}){
 if(value===''||value===null||value===undefined)return null
 const number=Number(value)
 if(!Number.isFinite(number)||number<min||number>max)throw new Error(`${label} ma nieprawidłową wartość.`)
 return number
}

function customerData(input={}){
 const data={name:text(input.name),phone:text(input.phone),email:text(input.email).toLowerCase(),company:text(input.company),notes:text(input.notes)}
 if(!data.name)throw new Error('Wpisz nazwę lub imię klienta.')
 if(data.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw new Error('Podaj prawidłowy adres e-mail.')
 return data
}

function vehicleData(db,input={},excludeId=0){
 const rawCustomerId=input.customer_id,customer_id=rawCustomerId===null||rawCustomerId===undefined||String(rawCustomerId).trim()===''?null:Number(rawCustomerId),plate=normalizedPlate(input.plate),vin=normalizedVin(input.vin),make=text(input.make),model=text(input.model)
 if(customer_id!==null&&(!Number.isInteger(customer_id)||!db.prepare('SELECT id FROM customers WHERE id=?').get(customer_id)))throw new Error('Wybrany klient nie istnieje.')
 if(!make)throw new Error('Wybierz lub wpisz markę pojazdu.')
 if(!plate&&!vin)throw new Error('Podaj numer rejestracyjny lub VIN.')
 if(vin&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin))throw new Error('VIN musi mieć 17 prawidłowych znaków.')
 if(vin&&db.prepare('SELECT id FROM vehicles WHERE UPPER(REPLACE(vin,\' \',\'\'))=? AND id!=?').get(vin,Number(excludeId)||0))throw new Error('Pojazd z tym VIN-em już istnieje.')
 if(plate&&db.prepare('SELECT id FROM vehicles WHERE UPPER(TRIM(plate))=? AND id!=?').get(plate,Number(excludeId)||0))throw new Error('Pojazd z tym numerem rejestracyjnym już istnieje.')
 const currentYear=new Date().getFullYear()+1
 return {customer_id,plate,vin,make,model,generation:text(input.generation),year:optionalNumber(input.year,{min:1886,max:currentYear,label:'Rok produkcji'}),engine:text(input.engine),power_hp:optionalNumber(input.power_hp,{min:1,max:2500,label:'Moc silnika'}),engine_code:text(input.engine_code).toUpperCase(),mileage:optionalNumber(input.mileage,{min:0,max:10000000,label:'Przebieg'})||0,notes:text(input.notes)}
}

function createCustomer(db,input){const d=customerData(input),result=db.prepare('INSERT INTO customers(name,phone,email,company,notes) VALUES (?,?,?,?,?)').run(d.name,d.phone,d.email,d.company,d.notes);return{id:result.lastInsertRowid}}
function updateCustomer(db,id,input){if(!db.prepare('SELECT id FROM customers WHERE id=?').get(id))throw new Error('Klient już nie istnieje.');const d=customerData(input);db.prepare('UPDATE customers SET name=?,phone=?,email=?,company=?,notes=? WHERE id=?').run(d.name,d.phone,d.email,d.company,d.notes,id);return true}
function createVehicle(db,input){const d=vehicleData(db,input);const result=db.prepare('INSERT INTO vehicles(customer_id,plate,vin,make,model,generation,year,engine,power_hp,engine_code,mileage,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(d.customer_id,d.plate,d.vin,d.make,d.model,d.generation,d.year,d.engine,d.power_hp,d.engine_code,d.mileage,d.notes);return{id:result.lastInsertRowid}}
function updateVehicle(db,id,input){if(!db.prepare('SELECT id FROM vehicles WHERE id=?').get(id))throw new Error('Pojazd już nie istnieje.');const d=vehicleData(db,input,id);db.prepare('UPDATE vehicles SET customer_id=?,plate=?,vin=?,make=?,model=?,generation=?,year=?,engine=?,power_hp=?,engine_code=?,mileage=?,notes=? WHERE id=?').run(d.customer_id,d.plate,d.vin,d.make,d.model,d.generation,d.year,d.engine,d.power_hp,d.engine_code,d.mileage,d.notes,id);return true}

module.exports={normalizedPlate,normalizedVin,customerData,vehicleData,createCustomer,updateCustomer,createVehicle,updateVehicle}
