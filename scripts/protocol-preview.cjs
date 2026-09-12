const {app,BrowserWindow}=require('electron')
const fs=require('fs')
const path=require('path')
const {documentHtml}=require('../electron/protocol-document.cjs')

const output=path.join(__dirname,'..','artifacts','protocols')
const logoPath=path.join(__dirname,'..','public','brand','autologika-logo.png')
const logoDataUri=`data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`
const order={id:1042,plate:'PO 7AL42',make:'Volkswagen',model:'Golf VII',generation:'2017',vin:'WVWZZZAUZHW123456',customer:'Jan Kowalski',phone:'+48 500 600 700',email:'jan@example.pl',title:'Diagnostyka układu doładowania',complaint:'Spadek mocy podczas przyspieszania i kontrolka silnika.',status:'NAPRAWA',priority:'PILNY',mileage:184250,engine:'2.0 TDI 110 kW',diagnosis_limit:450,diagnosis_fee:250,discount:50,total:1890,due_at:new Date(Date.now()+86400000).toISOString()}
const items=[
  {kind:'ROBOCIZNA',name:'Diagnostyka układu doładowania',work_name:'Diagnostyka układu doładowania',variant_name:'Pomiar ciśnienia i próba szczelności',customer_description:'Weryfikacja parametrów rzeczywistych, instalacji podciśnienia i szczelności dolotu.',qty:1.5,unit_price:220,hours_snapshot:1.5,price_snapshot:330},
  {kind:'ROBOCIZNA',name:'Wymiana przewodu dolotowego',customer_description:'Demontaż uszkodzonego przewodu, montaż nowego elementu i kontrola szczelności.',qty:1.2,unit_price:220,hours_snapshot:1.2,price_snapshot:264},
  {kind:'CZESC',name:'Przewód powietrza doładowującego',part_no:'VW 5Q0145838',qty:1,unit_price:879},
  {kind:'MATERIAL',name:'Materiały pomocnicze',qty:1,unit_price:117}
]
const diagnosis={dtcs:'P0299 — zbyt niskie ciśnienie doładowania',conclusion:'Nieszczelność przewodu powietrza doładowującego przy połączeniu z intercoolerem.',recommendation:'Kontrola szczelności układu po 1000 km lub w przypadku ponownego spadku mocy.'}
const notes={intake_notes:'Nadwozie bez nowych widocznych uszkodzeń. Paliwo: 1/2 zbiornika. W pojeździe pozostawiono dowód rejestracyjny.',qc_notes:'Jazda próbna 12 km. Brak aktywnych kodów DTC, parametry doładowania prawidłowe.',release_notes:'Przez pierwsze 100 km obserwować pracę silnika. Zalecana ponowna kontrola wizualna przewodu podczas następnego serwisu.'}
const qc=[['Kontrola poziomów płynów',1],['Brak wycieków po naprawie',1],['Kasowanie i ponowny odczyt DTC',1],['Jazda próbna',1],['Kontrola narzędzi i osłon',1],['Wnętrze zabezpieczone i czyste',1]].map(([label,checked])=>({label,checked}))

app.disableHardwareAcceleration()
app.whenReady().then(async()=>{
  fs.mkdirSync(output,{recursive:true})
  const keeper=new BrowserWindow({show:false,width:1,height:1})
  for(const type of ['intake','order','release']){
    const win=new BrowserWindow({show:false,width:900,height:1200,webPreferences:{sandbox:true}})
    const htmlPath=path.join(output,`${type}.html`)
    fs.writeFileSync(htmlPath,documentHtml(order,items,diagnosis,notes,type,null,qc,{logoDataUri}),'utf8')
    await win.loadFile(htmlPath)
    await win.webContents.executeJavaScript("Promise.all(Array.from(document.images).map(image=>image.decode?image.decode().catch(()=>{}):Promise.resolve()))")
    await win.webContents.executeJavaScript("new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))")
    const image=await win.webContents.capturePage({x:0,y:0,width:900,height:1200})
    fs.writeFileSync(path.join(output,`${type}.png`),image.toPNG())
    const pdf=await win.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true})
    fs.writeFileSync(path.join(output,`${type}.pdf`),pdf)
    win.destroy()
  }
  keeper.destroy()
  app.quit()
}).catch(error=>{console.error(error);app.exit(1)})
