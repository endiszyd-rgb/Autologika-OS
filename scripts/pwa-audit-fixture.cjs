function fakeCloudRecords(){
 const now=new Date().toISOString(),records=[]
 const add=(entity_type,cloud_id,payload)=>records.push({entity_type,cloud_id,payload,updated_at:now,deleted_at:null,version:1,device_id:'fixture'})
 add('customers','test-customer',{name:'Klient testowy',phone:'500600700'})
 add('vehicles','test-vehicle',{customer_cloud_id:'test-customer',plate:'ZPL TEST',make:'Toyota',model:'Corolla',vin:'JTDKM28E100089120',mileage:120000})
 add('orders','test-order',{vehicle_cloud_id:'test-vehicle',title:'Wizyta testowa',status:'GOTOWE',opened_at:now,diagnosis_fee:100})
 add('order_items','test-labor',{order_cloud_id:'test-order',kind:'ROBOCIZNA',name:'Robocizna testowa',qty:1.5,unit_price:200,unit_cost:70})
 add('payments','test-payment',{order_cloud_id:'test-order',amount:100,method:'GOTOWKA',paid_at:now})
 add('diagnostics','test-diagnosis',{order_cloud_id:'test-order',conclusion:'Wniosek testowy'})
 add('order_notes','test-notes',{order_cloud_id:'test-order',intake_notes:'Przyjęcie testowe',release_notes:'Zalecenia testowe'})
 add('service_reminders_v2','test-reminder',{vehicle_cloud_id:'test-vehicle',title:'Olej silnikowy',status:'OPEN',due_mileage:121000})
 add('work_templates','test-template',{name:'Szablon testowy',active:1,hours:1,rate:220,pre_json:'[]',steps_json:'["Kontrola"]',qc_json:'[]'})
 add('dvi_inspections','test-inspection',{order_cloud_id:'test-order',vehicle_cloud_id:'test-vehicle',status:'DRAFT'})
 add('dvi_items','test-dvi-item',{inspection_cloud_id:'test-inspection',area:'Hamulce',description:'Kontrola testowa',status:'OBSERVATION'})
 add('work_resources','test-bay',{resource_type:'BAY',name:'Stanowisko 1',active:1,capacity:1,work_calendar_json:'{}'})
 return records
}
async function installFakeCloud(session){
 const records=fakeCloudRecords(),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'}
 await session.protocol.handle('https',async request=>{
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
  const url=new URL(request.url)
  if(!url.hostname.endsWith('.supabase.co'))return new Response('{}',{status:403,headers})
  if(url.pathname!=='/rest/v1/sync_records')return new Response('{}',{headers})
  if(request.method==='GET'){
   const entity=url.searchParams.get('entity_type')?.replace(/^eq\./,''),id=url.searchParams.get('cloud_id')?.replace(/^eq\./,''),offset=Number(url.searchParams.get('offset')||0),limit=Number(url.searchParams.get('limit')||1000)
   return new Response(JSON.stringify(records.filter(row=>(!entity||row.entity_type===entity)&&(!id||row.cloud_id===id)&&!row.deleted_at).slice(offset,offset+limit)),{headers})
  }
  const body=await request.json(),entries=Array.isArray(body)?body:[body]
  for(const row of entries){const found=records.find(item=>item.entity_type===row.entity_type&&item.cloud_id===row.cloud_id);if(found)Object.assign(found,row);else records.push(row)}
  return new Response(JSON.stringify(entries),{headers})
 })
}
async function auditModules(win){
 const result=await win.webContents.executeJavaScript(`(async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),all=[]
  document.querySelector('.pwaInstallClose')?.click()
  const expand=[...document.querySelectorAll('.sideModeButtons button')].find(button=>button.textContent.includes('Wszystkie moduły'));expand?.click();await wait(50)
  const names=[...document.querySelectorAll('.shell>aside nav button')].map(button=>button.title)
  const intakeButton=[...document.querySelectorAll('.shell>aside nav button')].find(button=>button.textContent.includes('Szybkie przyjęcie'))
  if(!intakeButton)throw new Error('Missing quick intake navigation')
  intakeButton.click();await wait(500)
  const intake=document.querySelector('.intakePage'),field=intake?.querySelector('input:not([readonly]):not([data-pwa-ignore-dirty])')
  if(!field)throw new Error('Missing editable intake field')
  field.focus();const old=field.value,setValue=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set
  setValue.call(field,'Test niezapisanego formularza');field.dispatchEvent(new Event('input',{bubbles:true}));await wait(50)
  const originalConfirm=window.confirm;let confirmations=0
  window.confirm=()=>{confirmations++;return false}
  document.querySelector('.shell>aside nav button').click();await wait(50)
  if(!document.querySelector('.intakePage')||field.value!=='Test niezapisanego formularza'||confirmations!==1)throw new Error('Navigation lost unsaved intake')
  setValue.call(field,old);field.dispatchEvent(new Event('input',{bubbles:true}));await wait(50)
  document.querySelector('.shell>aside nav button').click();await wait(100)
  window.confirm=originalConfirm
  if(document.querySelector('.intakePage')||confirmations!==1)throw new Error('Restored input still blocks navigation')

  for(const name of names){
   [...document.querySelectorAll('.shell>aside nav button')].find(button=>button.title===name)?.click();await wait(220)
   if(name==='Centrum zlecenia'){const contact=document.querySelector('.pwaOrderContact');if(!contact?.querySelector('a[href^="tel:"]')||!contact.querySelector('a[href^="sms:"]')||!contact.textContent.includes('SMS: auto gotowe'))throw new Error('Missing quick customer contact')}
   all.push({name,fatal:!!document.querySelector('.fatalScreen'),overflow:document.documentElement.scrollWidth>innerWidth,text:document.querySelector('.pageBody')?.innerText.slice(0,90),error:document.querySelector('.fatalScreen code')?.textContent})
   if(all.at(-1).fatal)break
  }
  const api=window.autologika,order=(await api.orders.list())[0],customer=(await api.customers.list())[0],vehicle=(await api.vehicles.list())[0]
  const profile=await api.customers.profile(customer.id),car=await api.vehicles.profile(vehicle.id),quote=await api.quotes.get(order.id),health=await api.vehicleHealth.get(vehicle.id),inspection=await api.dvi.list(order.id),analytics=await api.finance.analytics()
  if(profile.totals.balance!==300||car.totals.revenue!==400||!Array.isArray(health.subsystems)||quote.total!==300||inspection[0].items.length!==1||analytics.current.revenue!==400)throw new Error('PWA detail contracts invalid')
  const retryKey='browser-retry-test',before=(await api.orders.list()).length
  const payload={idempotency_key:retryKey,customer_id:customer.id,vehicle_id:vehicle.id,customer_name:customer.name,plate:vehicle.plate,title:'Test ponowienia',allow_duplicate:true}
  const first=await api.intake.create(payload),retry=await api.intake.create({...payload,allow_duplicate:false})
  if(first.order_id!==retry.order_id||(await api.orders.list()).length!==before+1)throw new Error('Intake retry duplicated or rejected an existing order')
  return all
 })()`)
 const failed=result.filter(row=>row.fatal||row.overflow)
 if(result.length<23||failed.length)throw new Error('PWA MODULE AUDIT FAILED '+JSON.stringify({result,failed}))
 console.log('PWA MODULE AUDIT OK',JSON.stringify(result.map(({name})=>name)))
}
module.exports={installFakeCloud,auditModules}
