const test=require('node:test')
const assert=require('node:assert/strict')
const {documentHtml}=require('../electron/protocol-document.cjs')

const order={id:42,plate:'PO 123AB',make:'Volkswagen',model:'Golf',vin:'WVWZZZ1JZXW000001',customer:'Jan Kowalski',phone:'500 600 700',title:'Diagnostyka silnika',complaint:'Brak mocy <turbo>',status:'NAPRAWA',mileage:145000,total:1230,diagnosis_limit:350}
const items=[{kind:'ROBOCIZNA',name:'Diagnostyka',qty:1,unit_price:250,hours_snapshot:1.2,price_snapshot:250},{kind:'CZESC',name:'Filtr',part_no:'ABC-1',qty:2,unit_price:120}]

test('renders branded and escaped intake protocol',()=>{
  const html=documentHtml(order,items,{}, {intake_notes:'Stan dobry'},'intake',null,[],{logoDataUri:'data:image/png;base64,TEST'})
  assert.match(html,/Karta przyjęcia pojazdu/)
  assert.match(html,/data:image\/png;base64,TEST/)
  assert.match(html,/Brak mocy &lt;turbo&gt;/)
  assert.match(html,/Limit diagnostyki/i)
})

test('renders advanced service order sections and values',()=>{
  const html=documentHtml(order,items,{dtcs:'P0299',conclusion:'Nieszczelność'}, {},'order')
  assert.match(html,/Zlecenie serwisowe/)
  assert.match(html,/P0299/)
  assert.match(html,/ABC-1/)
  assert.match(html,/1230,00 zł/)
})

test('renders release protocol with QC and recommendations',()=>{
  const html=documentHtml(order,items,{conclusion:'Naprawiono',recommendation:'Kontrola za 1000 km'}, {},'release',null,[{label:'Jazda próbna',checked:1},{label:'Brak wycieków',checked:0}])
  assert.match(html,/Protokół wykonania i wydania/)
  assert.match(html,/1\/2/)
  assert.match(html,/Jazda próbna/)
  assert.match(html,/Kontrola za 1000 km/)
})
