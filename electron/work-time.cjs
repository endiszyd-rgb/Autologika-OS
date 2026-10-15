function timestampMilliseconds(value){
  if(value instanceof Date)return value.getTime()
  if(typeof value==='number')return Number.isFinite(value)?value:NaN
  const text=String(value||'').trim()
  if(!text)return NaN
  const sqliteUtc=/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)
  return Date.parse(sqliteUtc?`${text.replace(' ','T')}Z`:text)
}

function elapsedWorkMinutes(startedAt,endedAt=Date.now()){
  const start=timestampMilliseconds(startedAt),end=timestampMilliseconds(endedAt)
  if(!Number.isFinite(start)||!Number.isFinite(end))return 1
  return Math.max(1,Math.round((end-start)/60000))
}

function sqliteTimestamp(value=Date.now()){
  const milliseconds=timestampMilliseconds(value)
  if(!Number.isFinite(milliseconds))throw new Error('Nieprawidłowy czas zakończenia pracy.')
  return new Date(milliseconds).toISOString().slice(0,19).replace('T',' ')
}

function stopWorkLog(db,id,endedAt=Date.now()){
  const workLogId=Number(id)
  if(!Number.isInteger(workLogId)||workLogId<=0)return{stopped:false,minutes:0}
  const row=db.prepare('SELECT id,started_at,ended_at,duration_minutes FROM work_logs WHERE id=?').get(workLogId)
  if(!row||row.ended_at)return{stopped:false,minutes:Number(row?.duration_minutes||0)}
  const minutes=elapsedWorkMinutes(row.started_at,endedAt)
  db.prepare('UPDATE work_logs SET ended_at=?,duration_minutes=? WHERE id=? AND ended_at IS NULL').run(sqliteTimestamp(endedAt),minutes,workLogId)
  return{stopped:true,minutes}
}

function stopActiveWorkLogs(db,orderId,endedAt=Date.now()){
  const rows=db.prepare('SELECT id FROM work_logs WHERE order_id=? AND ended_at IS NULL ORDER BY id').all(Number(orderId))
  let minutes=0,count=0
  for(const row of rows){
    const result=stopWorkLog(db,row.id,endedAt)
    if(result.stopped){count++;minutes+=result.minutes}
  }
  return{count,minutes}
}

module.exports={elapsedWorkMinutes,sqliteTimestamp,stopActiveWorkLogs,stopWorkLog,timestampMilliseconds}
