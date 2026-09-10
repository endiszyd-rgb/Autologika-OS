const clean=value=>String(value??'').trim()
const field=(data,key)=>data?.[key]?.value??''
const decimal=value=>Number(clean(value).replace(',','.'))||0

function mapRegistrationData(data){
 const holderName=clean(field(data,'pelneNazwiskoLubNazwaPosiadaczaDowoduRejestracyjnego'))||clean(field(data,'nazwaPosiadaczaDowoduRejestracyjnego'))
 const capacity=decimal(field(data,'pojemnoscSilnikaCm3')),fuel=clean(data?.rodzajPaliwa?.valueDescription||field(data,'rodzajPaliwa')),powerKw=decimal(field(data,'maksymalnaMocNettoSilnikaKW'))
 const engine=[capacity?`${Math.round(capacity)} cm³`:'',fuel].filter(Boolean).join(' · ')
 const fields={
  plate:clean(field(data,'numerRejestracyjnyPojazdu')).toUpperCase(),vin:clean(field(data,'numerIdentyfikacyjnyPojazdu')).toUpperCase(),make:clean(field(data,'markaPojazdu')),model:clean(field(data,'modelPojazdu')),year:clean(field(data,'rokProdukcji')),customer_name:holderName,engine,power_hp:powerKw?Math.round(powerKw*1.359621617):'',fuel,capacity_cm3:capacity||'',first_registration:clean(field(data,'dataPierwszejRejestracjiPojazdu')),document_series:clean(field(data,'seriaDr'))
 }
 return {format:clean(field(data,'format'))||'STARY',fields,form:{customer_name:fields.customer_name,plate:fields.plate,vin:fields.vin,make:fields.make,model:fields.model,year:fields.year,engine:fields.engine,power_hp:fields.power_hp,intake_notes:`Dane pojazdu odczytane z AZTEC dowodu rejestracyjnego${fields.document_series?` · DR ${fields.document_series}`:''}. Zweryfikuj zgodność przed zapisaniem.`}}
}

function base64Candidates({raw='',hex=''}={}){
 const values=[],push=value=>{const normalized=clean(value).replace(/^\][A-Za-z][0-9]/,'').replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');if(normalized.length>=40&&!values.includes(normalized))values.push(normalized)}
 const source=clean(raw);push(source)
 for(const match of source.match(/[A-Za-z0-9+/_=-]{40,}/g)||[])push(match)
 if(hex&&/^(?:[0-9A-Fa-f]{2})+$/.test(hex)){const bytes=Buffer.from(hex,'hex');push(bytes.toString('utf8'));push(bytes.toString('base64'))}
 return values
}

async function decodeRegistrationPayload(payload={}){
 const {default:Decoder}=await import('polish-vehicle-registration-certificate-decoder')
 let lastError
 for(const candidate of base64Candidates(payload))try{
  const bytes=Buffer.from(candidate,'base64');if(bytes.length<8)continue
  const outputLength=bytes.readUInt32LE(0);if(outputLength<20||outputLength>200000)continue
  const decoded=new Decoder(candidate),mapped=mapRegistrationData(decoded.data)
  if(!mapped.fields.vin&&!mapped.fields.plate)continue
  return {ok:true,...mapped}
 }catch(error){lastError=error}
 throw new Error(lastError?'Nie udało się zdekodować kompletnego payloadu AZTEC.':'Skan nie zawiera danych polskiego dowodu rejestracyjnego.')
}

module.exports={mapRegistrationData,base64Candidates,decodeRegistrationPayload}
