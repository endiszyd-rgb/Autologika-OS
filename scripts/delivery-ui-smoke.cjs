const {app,ipcMain}=require('electron')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict')
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'autologika-delivery-')))
let writes=0
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms))
setTimeout(()=>app.exit(1),60000).unref()
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
 try{
  const js=code=>win.webContents.executeJavaScript(code)
  const wait=async selector=>{for(let i=0;i<100;i++){if(await js(`Boolean(document.querySelector(${JSON.stringify(selector)}))`))return;await delay(100)}throw new Error(`Missing ${selector}`)}
  await wait('.studioDocumentScan');await js(`document.querySelector('.studioDocumentScan').click()`)
  await wait('.deliveryTable')
  await js(`document.querySelector('.deliveryModal footer .primary').click()`)
  await wait('.confirmationModal');assert.equal(writes,0)
  await js(`document.querySelector('.confirmationActions button').click()`);await delay(100);assert.equal(writes,0)
  await js(`document.querySelector('.deliveryModal footer .primary').click()`)
  await wait('.confirmationModal')
  await js(`document.querySelector('.confirmationActions .primary').click()`)
  await wait('.deliverySuccess');assert.equal(writes,1)
  console.log('DELIVERY DESKTOP CONFIRMATION OK');app.exit(0)
 }catch(error){console.error(error);app.exit(1)}
}))
require('../electron/main.cjs')
ipcMain.removeHandler('inventory:scanDeliveryDocument')
ipcMain.handle('inventory:scanDeliveryDocument',()=>({file_name:'synthetic.jpg',source_hash:'synthetic',document:{items:[{part_no:'AB123',name:'Filtr',qty:2,unit_cost:10,vat_rate:23,gross_total:24.6}]}}))
ipcMain.removeHandler('inventory:importDeliveryDocument')
ipcMain.handle('inventory:importDeliveryDocument',(_,payload)=>{assert.equal(payload.document.items[0].qty,2);writes++;return {item_count:1,created:1,updated:0,quantity:2}})
