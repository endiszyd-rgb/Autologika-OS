export function addDays(date, count) { const result=new Date(date); result.setDate(result.getDate()+count); return result }
export function startOfWeek(date) { const result=new Date(date); result.setHours(0,0,0,0); return addDays(result,-((result.getDay()+6)%7)) }
export function dayKey(date) { const d=new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
export function localInput(date) { const d=new Date(date); return `${dayKey(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}` }
export function onDay(row,date) { const start=new Date(date); start.setHours(0,0,0,0); return new Date(row.start_at)<addDays(start,1)&&new Date(row.end_at)>start }
export function segmentOnDay(row,date) {
 const dayStart=new Date(date);dayStart.setHours(0,0,0,0)
 const dayEnd=addDays(dayStart,1),start=new Date(row.start_at),end=new Date(row.end_at)
 const clippedStart=new Date(Math.max(start.getTime(),dayStart.getTime())),clippedEnd=new Date(Math.min(end.getTime(),dayEnd.getTime()))
 return {start:clippedStart,end:clippedEnd,continuesBefore:start<dayStart,continuesAfter:end>dayEnd,endsAtDayBoundary:clippedEnd.getTime()===dayEnd.getTime(),minutes:Math.max(0,Math.round((clippedEnd-clippedStart)/60000))}
}
export function moveToDay(row,day) { const start=new Date(row.start_at),target=new Date(day); target.setHours(start.getHours(),start.getMinutes(),0,0); return {...row,start_at:target.toISOString(),end_at:new Date(target.getTime()+new Date(row.end_at).getTime()-start.getTime()).toISOString()} }
export function conflicts(rows) {
 const result=new Set(),active=rows.filter(x=>!['ANULOWANY','ZAKONCZONY'].includes(x.status))
 for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
  const a=active[i],b=active[j]
  if(a.bay===b.bay&&new Date(a.start_at)<new Date(b.end_at)&&new Date(b.start_at)<new Date(a.end_at)){result.add(a.id);result.add(b.id)}
 }
 return result
}
