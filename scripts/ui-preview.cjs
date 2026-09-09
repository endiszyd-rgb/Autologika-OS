// Isolated Electron smoke test: never opens the operator's database or cloud config.
const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const assert = require('node:assert/strict')
app.setPath('userData', fs.mkdtempSync(path.join(os.tmpdir(), 'autologika-ui-')))
const output = path.join(__dirname, '..', 'artifacts', 'ui')
fs.mkdirSync(output, { recursive: true })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
const errors = []
setTimeout(() => { console.error('UI smoke test timed out'); app.exit(1) }, 30000).unref()
app.on('browser-window-created', (_, win) => {
  win.webContents.on('console-message', (_, level, message) => {
    if (level >= 3) errors.push(message)
  })
  win.webContents.once('did-finish-load', async () => {
    try {
      await delay(1200)
      const capture = async name => fs.writeFileSync(path.join(output, `${name}.png`), (await win.webContents.capturePage()).toPNG())
      const inspect = () => win.webContents.executeJavaScript(`({fatal:!!document.querySelector('.fatalScreen'),overflow:document.documentElement.scrollWidth>innerWidth,radar:document.querySelectorAll('.studioBlip').length,title:document.querySelector('header h1')?.textContent})`)
      const dashboard = await inspect()
      assert.equal(dashboard.fatal, false)
      assert.equal(dashboard.overflow, false)
      assert.equal(dashboard.radar, 6)
      console.log('DASHBOARD', JSON.stringify(dashboard))
      await capture('dashboard-1500')
      await win.webContents.executeJavaScript(`window.scrollTo(0,650)`)
      await delay(200)
      await capture('dashboard-details')
      await win.webContents.executeJavaScript(`window.scrollTo(0,0);document.querySelectorAll('.studioFilters button')[2].click()`)
      assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.studioOrder').length`), 2)
      await win.webContents.executeJavaScript(`document.querySelector('.studioFilters button').click()`)
      win.setSize(1100, 800)
      await delay(400)
      const compact = await inspect()
      assert.equal(compact.overflow, false)
      assert.equal(compact.fatal, false)
      console.log('COMPACT', JSON.stringify(compact))
      await capture('dashboard-1100')
      win.setSize(1500, 940)
      await delay(300)
      // Test application-owned controls using their accessible labels.
      await win.webContents.executeJavaScript(`document.querySelector('.studioBlip').click()`)
      await delay(500)
      const destination = await inspect()
      assert.equal(destination.title, 'Centrum zlecenia')
      assert.equal(destination.fatal, false)
      console.log('RADAR_DESTINATION', JSON.stringify(destination))
      await capture('order-center')
      win.setSize(1100, 800)
      await delay(300)
      assert.equal((await inspect()).overflow, false)
      await capture('order-center-1100')
      win.setSize(1500, 940)
      const openOrderTab = async tab => {
        await win.webContents.executeJavaScript(`document.querySelector('[data-order-tab="${tab}"]').click()`)
        await delay(160)
        assert.equal((await inspect()).fatal, false, tab)
        assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.workspaceContent').textContent.trim().length > 0`), true, `${tab} must render content`)
      }
      for (const tab of ['diagnosis','quote','parts','time','docs','contact','approval','payment','reminders','timeline','closeout','qc','money']) await openOrderTab(tab)
      await openOrderTab('diagnosis')
      await win.webContents.executeJavaScript(`{
        const field = [...document.querySelectorAll('.workspaceContent label')].find(x=>x.textContent==='Wniosek / przyczyna').querySelector('textarea');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(field,'Wniosek testowy UI');
        field.dispatchEvent(new Event('input',{bubbles:true}));
      }`)
      await delay(100)
      await win.webContents.executeJavaScript(`[...document.querySelectorAll('.workspaceContent button')].find(x=>x.textContent==='Zapisz diagnostykę').click()`)
      await delay(450)
      assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-order-tab="diagnosis"]').getAttribute('aria-current')`), 'page')
      assert.equal(require('../electron/db.cjs').getDb().prepare('SELECT conclusion FROM diagnostics WHERE order_id=1').get().conclusion, 'Wniosek testowy UI')
      await openOrderTab('payment')
      await capture('order-payment')
      await win.webContents.executeJavaScript(`[...document.querySelectorAll('.workspaceContent button')].find(x=>x.textContent.includes('Zapisz płatność')).click()`)
      await delay(450)
      assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-order-tab="payment"]').getAttribute('aria-current')`), 'page')
      assert.equal(require('../electron/db.cjs').getDb().prepare('SELECT SUM(amount) n FROM payments WHERE order_id=1').get().n, 600)
      await openOrderTab('closeout')
      await capture('order-closeout')
      await win.webContents.executeJavaScript(`{
        const field=document.querySelector('select[aria-label="Wybierz zlecenie"]');
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,'2');
        field.dispatchEvent(new Event('change',{bubbles:true}));
      }`)
      await delay(350)
      assert.equal(await win.webContents.executeJavaScript(`document.querySelector('select[aria-label="Wybierz zlecenie"]').value`), '2')
      await openOrderTab('payment')
      await win.webContents.executeJavaScript(`[...document.querySelectorAll('.workspaceContent button')].find(x=>x.textContent.includes('Zapisz płatność')).click()`)
      await delay(400)
      assert.equal(await win.webContents.executeJavaScript(`document.querySelector('select[aria-label="Wybierz zlecenie"]').value`), '2')
      assert.equal(await win.webContents.executeJavaScript(`document.querySelector('[data-order-tab="payment"]').getAttribute('aria-current')`), 'page')
      assert.equal(require('../electron/db.cjs').getDb().prepare('SELECT SUM(amount) n FROM payments WHERE order_id=2').get().n, 2450)
      console.log('ORDER_TABS_AND_SAVES', '13 sections rendered; diagnosis and payment saved without losing the selected section')
      await win.webContents.executeJavaScript(`document.querySelector('nav button[title="Szybkie przyjęcie"]').click()`)
      await delay(400)
      assert.equal(await win.webContents.executeJavaScript('window.scrollY'), 0)
      await capture('intake')
      await win.webContents.executeJavaScript(`document.querySelector('nav button[title="Workflow"]').click()`)
      await delay(400)
      await capture('workflow')
      assert.equal((await inspect()).fatal, false)
      await win.webContents.executeJavaScript(`document.querySelector('nav button[title="Cennik Autologiki"]').click()`)
      await delay(500)
      assert.equal(await win.webContents.executeJavaScript(`document.querySelectorAll('.catalogVariantRows>button').length`),618)
      assert.equal((await inspect()).fatal,false)
      await capture('catalog-price-book')
      await win.webContents.executeJavaScript(`document.querySelector('nav button[title="Terminarz 2.0"]').click()`)
      await delay(500)
      assert.equal(await win.webContents.executeJavaScript(`!!document.querySelector('.plannerBoard')`),true)
      assert.equal((await inspect()).fatal,false)
      await capture('schedule')
      await win.webContents.executeJavaScript(`document.querySelector('.commandLauncher').click()`)
      await delay(300)
      assert.equal(await win.webContents.executeJavaScript(`!!document.querySelector('.commandPalette')`), true)
      await capture('search')
      await win.webContents.executeJavaScript(`document.querySelector('.paletteShade').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));document.querySelector('nav button[title="Pulpit"]').click()`)
      await delay(400)
      // Verify the empty state using the same isolated database.
      require('../electron/db.cjs').getDb().prepare('DELETE FROM orders').run()
      win.webContents.reload()
      await new Promise(resolve => win.webContents.once('did-finish-load', resolve))
      await delay(400)
      assert.equal((await inspect()).radar, 0)
      assert.equal((await inspect()).fatal, false)
      await capture('dashboard-empty')
      console.log('RENDERER_ERRORS', JSON.stringify(errors))
      console.log('ARTIFACTS', output)
      app.exit(errors.length ? 1 : 0)
    } catch (e) { console.error(e); app.exit(1) }
  })
})
app.whenReady().then(() => {
  const db = require('../electron/db.cjs').getDb()
  const rows = [
    ['PO 7AK21','BMW','320d','Wymiana rozrządu','NAPRAWA','BRAK',2450],
    ['PZ 842KL','Audi','A4 Avant','Układ hamulcowy — oś przednia','AKCEPTACJA','DECYZJA',1820],
    ['PO 3WN90','Mercedes','C 220','Serwis olejowy i przegląd','GOTOWE','BRAK',890],
    ['PZ 291RT','Škoda','Octavia','Diagnostyka układu chłodzenia','DIAGNOZA','CZESCI',650],
    ['PO 9HG42','Volvo','XC60','Weryfikacja zawieszenia','PRZYJETE','BRAK',350],
  ]
  for(const [plate,make,model,title,status,wait,price] of rows){
    const v=db.prepare('INSERT INTO vehicles(customer_id,plate,make,model) VALUES (1,?,?,?)').run(plate,make,model)
    db.prepare('INSERT INTO orders(vehicle_id,title,status,wait_state,labor_hours,labor_rate,parts_cost,source) VALUES (?,?,?,?,?,?,?,?)').run(v.lastInsertRowid,title,status,wait,2,price/2,200,'polecenie')
  }
  db.prepare("INSERT INTO work_logs(order_id,worker,note) VALUES (2,'Diagnosta','Podgląd interfejsu')").run()
})
require('../electron/main.cjs')
