export function effectiveHourlyRate(revenue,hours,{minimumMinutes=15}={}){
 const income=Number(revenue),workedHours=Number(hours)
 if(!Number.isFinite(income)||!Number.isFinite(workedHours)||income<=0||workedHours*60<minimumMinutes)return null
 return income/workedHours
}
