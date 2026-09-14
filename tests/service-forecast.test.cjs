const test=require('node:test')
const assert=require('node:assert/strict')
const {buildServiceForecast}=require('../electron/service-forecast.cjs')

const now='2026-09-14T10:00:00.000Z'

test('forecasts the next oil service from completed workshop history',()=>{
 const result=buildServiceForecast({vehicle:{mileage:123000},orders:[{id:1,status:'WYDANE',opened_at:'2025-10-01T09:00:00Z',service_text:'Wymiana oleju silnikowego i filtra'}]},{now})
 const oil=result.rows.find(row=>row.ruleId==='oil')
 assert.equal(oil.dueDate,'2026-10-01')
 assert.equal(oil.state,'SOON')
 assert.equal(oil.source,'HISTORY')
})

test('manual reminder replaces an inferred duplicate',()=>{
 const result=buildServiceForecast({vehicle:{mileage:100000},orders:[{status:'WYDANE',opened_at:'2025-09-01',title:'Serwis olejowy'}],reminders:[{id:9,status:'OPEN',title:'Olej silnikowy i filtr',due_date:'2026-11-01',due_mileage:112000}]},{now})
 assert.equal(result.rows.filter(row=>/olej/i.test(row.title)).length,1)
 assert.equal(result.rows[0].source,'REMINDER')
})

test('does not infer service from unfinished orders',()=>{
 const result=buildServiceForecast({vehicle:{},orders:[{status:'NAPRAWA',opened_at:'2026-09-01',title:'Wymiana płynu hamulcowego'}],reminders:[]},{now})
 assert.equal(result.rows.length,0)
})
