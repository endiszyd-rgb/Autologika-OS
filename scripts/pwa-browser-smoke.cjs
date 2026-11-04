const {app,BrowserWindow}=require('electron')
const assert=require('node:assert/strict')
const fs=require('node:fs'),os=require('node:os'),path=require('node:path')

app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'autologika-pwa-')))
const url=process.argv.at(-1)
setTimeout(()=>{console.error('PWA browser smoke timeout');app.exit(1)},30000).unref()

app.whenReady().then(async()=>{
  const win=new BrowserWindow({show:false,width:430,height:932,useContentSize:true,webPreferences:{contextIsolation:true,nodeIntegration:false}})
  win.webContents.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1')
  await win.loadURL(url)
  if(process.env.PWA_FAKE_AUTH==='1'){
    await win.webContents.executeJavaScript(`localStorage.setItem('autologika.pwa.session.v1',JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Date.now()+3600000,user:{id:'00000000-0000-4000-8000-000000000001',email:'test@example.invalid'}}))`)
    if(process.env.PWA_AUDIT_ALL_MODULES==='1')await require('./pwa-audit-fixture.cjs').installFakeCloud(win.webContents.session)
    else win.webContents.session.webRequest.onBeforeRequest({urls:['https://*.supabase.co/*']},(_details,callback)=>callback({cancel:true}))
    await win.webContents.reload()
  }
  await new Promise(resolve=>setTimeout(resolve,1800))
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const registration=await navigator.serviceWorker.getRegistration()
    const dockNode=document.querySelector('.shell>aside'),dock=dockNode?.getBoundingClientRect()
    const content=document.querySelector('.shell>main')?.getBoundingClientRect()
    return {
      heading:document.querySelector('h1')?.textContent||'',
      fatal:!!document.querySelector('.fatalScreen'),
      overflow:document.documentElement.scrollWidth>innerWidth,
      manifest:document.querySelector('link[rel="manifest"]')?.getAttribute('href')||'',
      apple:document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href')||'',
      serviceWorker:Boolean(registration),
      mobileDock:Boolean(dock&&getComputedStyle(dockNode).position==='fixed'&&dock.top>innerHeight*.75&&dock.width>=innerWidth-16),
      dockTop:dock?Math.round(dock.top):0,
      dockWidth:dock?Math.round(dock.width):0,
      dockPosition:dockNode?getComputedStyle(dockNode).position:'',
      contentWidth:content?Math.round(content.width):0,
      contentLeft:content?Math.round(content.left):0,
      viewport:{width:innerWidth,height:innerHeight}
    }
  })()`)
  if(process.env.PWA_SCREENSHOT){const image=await win.webContents.capturePage();fs.writeFileSync(process.env.PWA_SCREENSHOT,image.toPNG())}
  assert.equal(result.heading,process.env.PWA_EXPECT_HEADING||'PWA nie jest jeszcze połączona z chmurą')
  assert.equal(result.fatal,false)
  assert.equal(result.overflow,false)
  assert.equal(result.serviceWorker,true)
  assert.ok(result.manifest)
  assert.ok(result.apple)
  if(process.env.PWA_EXPECT_MOBILE_DOCK==='1'){
    assert.deepEqual(result.viewport,{width:430,height:932})
    assert.equal(result.mobileDock,true)
    assert.ok(result.contentWidth>=result.viewport.width-16)
    assert.ok(result.contentLeft<=8)
  }
  if(process.env.PWA_AUDIT_ALL_MODULES==='1')await require('./pwa-audit-fixture.cjs').auditModules(win)
  console.log('PWA BROWSER OK',JSON.stringify(result))
  app.exit(0)
}).catch(error=>{console.error(error);app.exit(1)})
