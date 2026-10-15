export function effectiveHourlyRate(revenue,hours,{minimumMinutes=15}={}){
 const income=Number(revenue),workedHours=Number(hours)
 if(!Number.isFinite(income)||!Number.isFinite(workedHours)||income<=0||workedHours*60<minimumMinutes)return null
 return income/workedHours
}

export function workLogTimestamp(value){
 const text=String(value||'').trim()
 if(!text)return Number.NaN
 const sqliteUtc=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
 return Date.parse(sqliteUtc?`${text.replace(' ','T')}Z`:text)
}

export function workLogMinutes(log,now=Date.now()){
 const saved=Number(log?.duration_minutes)
 if(log?.ended_at&&Number.isFinite(saved)&&saved>=0)return saved
 const start=workLogTimestamp(log?.started_at)
 const end=log?.ended_at?workLogTimestamp(log.ended_at):Number(now)
 if(!Number.isFinite(start)||!Number.isFinite(end))return 0
 return Math.max(0,(end-start)/60000)
}
