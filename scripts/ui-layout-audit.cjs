// Stały test wyglądu: przechodzi po wszystkich zakładkach (2 szerokości okna) i otwiera okienka
// (nowe/edycja/wycena/podgląd), mierząc: za małe litery, ucięty tekst, wychodzenie poza ekran,
// cyfry o zmiennej szerokości w kwotach i format kwot. Izolowana baza — nigdy nie dotyka danych warsztatu.
// Uruchomienie: npm run test:layout   (zrzuty: artifacts/layout/)
const {app}=require('electron')
const fs=require('node:fs'),path=require('node:path'),os=require('node:os')
const userData=fs.mkdtempSync(path.join(os.tmpdir(),'autologika-layout-'))
app.setPath('userData',userData)
app.on('will-quit',()=>{try{fs.rmSync(userData,{recursive:true,force:true})}catch{}})
const out=path.join(__dirname,'..','artifacts','layout')
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true})
const delay=ms=>new Promise(r=>setTimeout(r,ms))
const errors=[]
setTimeout(()=>{console.error('LAYOUT AUDIT TIMEOUT');app.exit(1)},600000).unref()
const slugify=t=>t.normalize('NFD').replace(/[^\w]+/g,'-').replace(/^-|-$/g,'').toLowerCase()

const {measure}=require('./layout-measure.cjs')

const DIALOG='[role="dialog"][aria-modal="true"],[role="alertdialog"]'
// Przyciski otwierające okienka bez skutków ubocznych (bez usuwania, zapisu, wydawania)
// Przyciski otwierające systemowe okna plików/folderów albo generujące dokumenty — pomijane
const SKIP=/folder|plik|zdjęci|PDF|skan/i
const OPENER=/^\+?\s*(Nowe|Nowy|Nowa|Dodaj|Edytuj|Wycena|Profil|Podgląd|Szczegóły|Zarządzaj|Przyjmij dostawę|Rozchód|Przyjęcie|Zmień|Kosztorys|Dodaj płatność|Przyjmij wpłatę|Zarejestruj wpłatę|Zasoby)/

seedAndRun()
function seedAndRun(){
 app.on('browser-window-created',(_,win)=>{
  win.webContents.on('console-message',(_,level,message)=>{if(level>=3)errors.push(message)})
  win.webContents.once('did-finish-load',async()=>{
   const js=s=>win.webContents.executeJavaScript(s)
   const shot=async name=>{await delay(200);try{fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG())}catch{}}
   const report={},failures=[]
   const record=(key,result)=>{
    if(!result)return
    report[key]=result
    for(const kind of ['tiny','clipped','proportional','badMoney','spill','overlap'])for(const sample of result[kind])failures.push(`${key} · ${kind} · ${sample}`)
    if(result.overflow)failures.push(`${key} · overflow`)
   }
   try{
    win.setSize(1500,940);await delay(1200)
    seed()
    await js(`window.autologika.settings.setHala({greetingName:'Test',workshopName:'Warsztat testowy',accent:'#F43F5E'})`)
    await js(`[...document.querySelectorAll('.sideModeButtons button')].find(b=>b.textContent.includes('Wszystkie'))?.click()`);await delay(400)
    const pages=await js(`[...document.querySelectorAll('aside nav button[title]')].map(b=>b.title)`)
    if(pages.length<15)throw new Error('Za mało zakładek w menu: '+pages.length)
    const open=async title=>{await js(`document.querySelector('aside nav button[title=${JSON.stringify(title)}]').click()`);await delay(1800);await js('window.scrollTo(0,0)')}
    const closeDialogs=async()=>{
     for(let i=0;i<4&&await js(`!!document.querySelector(${JSON.stringify(DIALOG)})`);i++){
      // Najpierw przycisk zamknięcia (×/Zamknij/Anuluj), potem Esc z fokusem w okienku
      await js(`(()=>{const d=[...document.querySelectorAll(${JSON.stringify(DIALOG)})].pop();const b=[...d.querySelectorAll('button')].find(b=>/^(Zamknij|Anuluj)/.test(b.getAttribute('aria-label')||'')||/^(Anuluj|Zamknij|×|✕)$/.test(b.textContent.trim()));if(b){b.click();return}d.focus();d.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))})()`);await delay(350)
     }
     return !(await js(`!!document.querySelector(${JSON.stringify(DIALOG)})`))
    }
    const crawlDialogs=async(prefix,scope)=>{
     const labels=await js(`[...new Set([...document.querySelectorAll(${JSON.stringify(scope+' button')})].filter(b=>!b.disabled&&b.offsetParent&&!b.closest(${JSON.stringify(DIALOG)})).map(b=>(b.textContent||'').trim()).filter(t=>${OPENER}.test(t)&&!${SKIP}.test(t)))].slice(0,10)`)
     for(const text of labels){
      await js(`[...document.querySelectorAll(${JSON.stringify(scope+' button')})].find(b=>(b.textContent||'').trim()===${JSON.stringify(text)}&&b.offsetParent)?.click()`);await delay(900)
      if(await js(`!!document.querySelector(${JSON.stringify(DIALOG)})`)){
       const key=`${prefix} ▸ ${text.slice(0,30)}`
       record(key,await js(measure(DIALOG)))
       await shot('dialog-'+slugify(key).slice(0,80))
      }
      if(!await closeDialogs()){failures.push(`${prefix} ▸ ${text} · okienko nie daje się zamknąć`);await js('location.reload()');await delay(2500);return}
     }
    }
    for(const [index,title] of pages.entries()){
     await open(title)
     record(title,await js(measure('.pageBody')))
     await shot(String(index).padStart(2,'0')+'-'+slugify(title))
     await crawlDialogs(title,'.pageBody')
    }
    // Okienka wewnątrz otwartego zlecenia
    await open('Zlecenia')
    await js(`(document.querySelector('.pageBody tbody tr, .pageBody .orderRow, .pageBody [data-order-id]'))?.click()`);await delay(1500)
    record('Zlecenie (otwarte)',await js(measure('.pageBody')))
    await shot('order-open')
    await crawlDialogs('Zlecenie','.pageBody')
    // Węższe okno
    win.setSize(1100,820);await delay(500)
    for(const title of ['Pulpit','Centrum zlecenia','Zlecenia','Części / magazyn','Finanse / KPI','Należności','Cennik Autologiki'].filter(t=>pages.includes(t))){
     await open(title)
     record('1100:'+title,await js(measure('.pageBody')))
     await shot('1100-'+slugify(title))
    }
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1))
    const dialogs=Object.keys(report).filter(k=>k.includes('▸')).length
    console.log(`LAYOUT AUDIT · ${Object.keys(report).length} widoków · ${dialogs} okienek`)
    const rendererErrors=errors.filter(e=>!/net::ERR|Failed to load resource|Autoryzacja|supabase/i.test(e))
    if(rendererErrors.length)failures.push(...rendererErrors.map(e=>'renderer · '+e.slice(0,200)))
    if(dialogs<8)failures.push(`za mało sprawdzonych okienek: ${dialogs}`)
    if(failures.length){console.error('LAYOUT AUDIT FAILED\n'+failures.join('\n'));app.exit(1);return}
    console.log('LAYOUT AUDIT OK')
    app.exit(0)
   }catch(error){console.error('LAYOUT AUDIT ERROR',error);await shot('error');app.exit(1)}
  })
 })
 require('../electron/main.cjs')
}

function seed(){
 const db=require('../electron/db.cjs').getDb()
 const pad=n=>String(n).padStart(2,'0'),d=new Date(),day=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,local=(h,m=0)=>new Date(`${day}T${pad(h)}:${pad(m)}:00`).toISOString()
 const cust=db.prepare('INSERT INTO customers(name,phone,email) VALUES (?,?,?)'),veh=db.prepare('INSERT INTO vehicles(customer_id,plate,make,model,year,vin,mileage) VALUES (?,?,?,?,?,?,?)')
 const ord=db.prepare('INSERT INTO orders(vehicle_id,title,status,complaint,due_at,wait_state,labor_hours,labor_rate) VALUES (?,?,?,?,?,?,?,?)')
 const item=db.prepare('INSERT INTO order_items(order_id,kind,name,qty,unit_cost,unit_price,part_no) VALUES (?,?,?,?,?,?,?)')
 const people=[['Jan Kowalski','500600700'],['Firma Trans-Pol Sp. z o.o.','600700800'],['Anna Wiśniewska','501234567'],['Grzegorz Brzęczyszczykiewicz','602345678']]
 const cars=[['WE 4521K','Volkswagen','Passat B8 2.0 TDI',2017],['WX 88210','BMW','330d F30',2015],['PO 77311','Fiat','Ducato 2.3 MultiJet',2019],['KR 1234A','Škoda','Octavia III 1.6 TDI',2016],['GD 55K21','Mercedes-Benz','Vito 116 CDI',2020]]
 const statuses=['NAPRAWA','QC_NAPRAWY','PRZYJETE','DIAGNOZA','WYCENA','AKCEPTACJA','GOTOWE']
 const titles=['Wymiana DPF + adaptacja','Stage 1 · zapis OBD','Olej + filtry','Diagnostyka braku mocy','Rozrząd + pompa wody']
 const bays=['Stanowisko 1','Stanowisko 2','Diagnostyka','Stanowisko 1','Plac / oczekuje']
 cars.forEach((car,i)=>{
  const c=cust.run(people[i%people.length][0],people[i%people.length][1],`klient${i}@example.com`).lastInsertRowid
  const v=veh.run(c,car[0],car[1],car[2],car[3],'WVWZZZ3CZHE00000'+i,120000+i*23456).lastInsertRowid
  const o=ord.run(v,titles[i],statuses[i],'Opis usterki zgłoszonej przez klienta przy przyjęciu.',local(15+i%3,30),i===1?'CZESCI':'BRAK',2.5+i,220).lastInsertRowid
  item.run(o,'CZESC','Filtr oleju MANN W 712/95',1,24.5,49.9,'W 712/95');item.run(o,'CZESC','Olej silnikowy Castrol 5W-30 5 l',1,145,229,'5W30-5L');item.run(o,'ROBOCIZNA','Wymiana oleju i filtrów',1.5,0,330,null)
  db.prepare('INSERT INTO appointments(order_id,vehicle_id,title,start_at,end_at,bay) VALUES (?,?,?,?,?,?)').run(o,v,'Wizyta',local(8+i*2),local(9+i*2,30),bays[i])
  if(i<3)db.prepare('INSERT INTO payments(order_id,amount,method) VALUES (?,?,?)').run(o,[1234.5,12999.99,380][i],'KARTA')
 })
 const part=db.prepare('INSERT INTO inventory_parts(part_no,name,stock,min_stock,unit_cost,sell_price,location) VALUES (?,?,?,?,?,?,?)')
 part.run('W 712/95','Filtr oleju MANN-FILTER',4,2,24.5,49.9,'A-03');part.run('GDB1550','Klocki hamulcowe przód TRW',1,2,120,210,'B-12');part.run('28SKV013','Czujnik parkowania — tył',0,1,89,159,'');part.run('5W30-5L','Olej silnikowy 5W-30 5 l',18,5,145,229,'D-02')
 try{db.prepare('INSERT INTO employees(name,role,hourly_cost) VALUES (?,?,?)').run('Paweł Kowalczyk','Mechanik',45)}catch{}
}
