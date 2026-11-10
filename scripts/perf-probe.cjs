// Pomiar wydajności interfejsu na odizolowanej kopii danych.
// Nigdy nie otwiera bazy operatora: AUTOLOGIKA_PERF_DB jest kopiowana do katalogu tymczasowego.
// Uruchomienie: npm run build && node scripts/run-electron-smoke.cjs perf-probe.cjs [etykieta]
const { app, ipcMain } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const label = process.argv[2] || 'pomiar'
const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'autologika-perf-'))
app.setPath('userData', userData)
const sourceDb = process.env.AUTOLOGIKA_PERF_DB
if (sourceDb) {
  if (!fs.existsSync(sourceDb)) { console.error('Brak pliku bazy:', sourceDb); process.exit(1) }
}
const output = path.join(__dirname, '..', 'artifacts', 'perf')
fs.mkdirSync(output, { recursive: true })
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
setTimeout(() => { console.error('Pomiar przekroczył limit czasu'); app.exit(1) }, 240000).unref()

// Czas każdego zapytania IPC (proces główny, synchroniczny SQLite blokuje kolejne zapytania).
const ipcTimes = {}
const originalHandle = ipcMain.handle.bind(ipcMain)
ipcMain.handle = (channel, handler) => originalHandle(channel, async (...args) => {
  const start = process.hrtime.bigint()
  try { return await handler(...args) } finally {
    const ms = Number(process.hrtime.bigint() - start) / 1e6
    ;(ipcTimes[channel] ||= []).push(ms)
  }
})

// Spójna kopia przez VACUUM INTO (uwzględnia plik -wal); źródło otwarte tylko do odczytu.
// Synchronicznie, bo electron/main.cjs musi się załadować przed gotowością aplikacji.
if (sourceDb) {
  const Database = require('better-sqlite3')
  const source = new Database(sourceDb, { readonly: true, fileMustExist: true })
  try { source.prepare('VACUUM INTO ?').run(path.join(userData, 'autologika.db')) } finally { source.close() }
}
const processStart = Date.now()
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      const js = code => win.webContents.executeJavaScript(code)
      const loadedAt = Date.now() - processStart
      await js(`window.__perfLong=[];try{new PerformanceObserver(list=>{for(const e of list.getEntries())window.__perfLong.push([e.startTime,e.duration])}).observe({type:'longtask',buffered:true})}catch{}`)
      // Start: kiedy znika ekran powitalny i pojawia się pulpit.
      const bootStart = Date.now()
      while (await js(`!!document.querySelector('.bootSplash')`)) { await delay(20); if (Date.now() - bootStart > 10000) break }
      const splashGoneAt = Date.now() - processStart
      while (!(await js(`!!document.querySelector('.studioDashboard,.studioKpis')`))) { await delay(20); if (Date.now() - bootStart > 15000) break }
      const dashboardAt = Date.now() - processStart
      // PERF_WAIT: ile ms odczekać po starcie przed klikaniem (jak użytkownik, który chwilę patrzy na pulpit).
      await delay(Number(process.env.PERF_WAIT || 800))

      // Rozwiń wszystkie moduły, żeby zmierzyć każdy ekran z menu.
      await js(`(()=>{const b=[...document.querySelectorAll('.sideModeButtons button')].find(x=>x.textContent.includes('Wszystkie moduły'));b?.click()})()`)
      await delay(300)
      const titles = await js(`[...document.querySelectorAll('aside nav button[title]')].map(b=>b.title)`)
      const screens = []
      for (const title of titles) {
        if (title === 'Pulpit') continue
        for (const k of Object.keys(ipcTimes)) delete ipcTimes[k]
        // Czas do ustabilizowania: ostatnia zmiana DOM po kliknięciu (cisza 400 ms, limit 6 s).
        const result = await js(`new Promise(resolve=>{
          const t0=performance.now();let last=t0;const longBefore=window.__perfLong.length
          const obs=new MutationObserver(()=>{last=performance.now()});obs.observe(document.querySelector('main'),{subtree:true,childList:true,characterData:true,attributes:true})
          document.querySelector('aside nav button[title=${JSON.stringify(title)}]').click()
          const check=()=>{const now=performance.now();if(now-last>400||now-t0>6000){obs.disconnect();const timedOut=now-t0>6000;const long=window.__perfLong.slice(longBefore).filter(([s])=>s>=t0);resolve({timedOut,settleMs:Math.round(last-t0),longTasks:long.length,blockedMs:Math.round(long.reduce((a,[,d])=>a+d,0)),nodes:document.querySelectorAll('main *').length})}else setTimeout(check,50)}
          setTimeout(check,50)})`)
        const ipc = Object.entries(ipcTimes).map(([c, t]) => [c, t.length, Math.round(t.reduce((a, b) => a + b, 0))]).sort((a, b) => b[2] - a[2])
        screens.push({ title, ...result, ipcCalls: ipc.reduce((a, x) => a + x[1], 0), ipcMs: ipc.reduce((a, x) => a + x[2], 0), topIpc: ipc.slice(0, 3) })
      }

      // PERF_TRACE="Klienci / auta,Cennik Autologiki": ślad Chromium dla wybranych ekranów,
      // podział czasu na style (UpdateLayoutTree), układ (Layout), rysowanie i JavaScript.
      const traces = []
      for (const title of String(process.env.PERF_TRACE || '').split(',').map(x => x.trim()).filter(Boolean)) {
        const { contentTracing } = require('electron')
        await js(`document.querySelector('aside nav button[title="Pulpit"]').click()`)
        await delay(600)
        await contentTracing.startRecording({ included_categories: ['devtools.timeline', 'blink', 'v8.execute'] })
        await js(`document.querySelector('aside nav button[title=${JSON.stringify(title)}]').click()`)
        await delay(1200)
        const file = await contentTracing.stopRecording(path.join(output, `trace-${label}-${title.replace(/[^\w]+/g, '_')}.json`))
        const events = JSON.parse(fs.readFileSync(file, 'utf8')).traceEvents || JSON.parse(fs.readFileSync(file, 'utf8'))
        const sums = {}
        for (const e of events) if (e.ph === 'X' && e.dur && ['UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'EvaluateScript', 'FunctionCall', 'v8.compile', 'ParseHTML', 'ParseAuthorStyleSheet', 'RunMicrotasks'].includes(e.name)) sums[e.name] = (sums[e.name] || 0) + e.dur / 1000
        traces.push({ title, ms: Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, Math.round(v)]).sort((a, b) => b[1] - a[1])) })
        console.log('ŚLAD', title.padEnd(24), JSON.stringify(traces.at(-1).ms))
      }

      // Bezczynność: zużycie CPU renderera, gdy nic nie klikamy (animacje ciągłe, liczniki co sekundę).
      const idleCpu = async title => {
        await js(`document.querySelector('aside nav button[title=${JSON.stringify(title)}]')?.click()`)
        await delay(1500)
        const pid = win.webContents.getOSProcessId()
        const sample = () => app.getAppMetrics().find(m => m.pid === pid)?.cpu?.cumulativeCPUUsage
        const c0 = sample(), t0 = Date.now()
        await delay(Number(process.env.PERF_IDLE_MS || 5000))
        const c1 = sample()
        return { title, cpuPercent: c0 != null && c1 != null ? Math.round((c1 - c0) / ((Date.now() - t0) / 1000) * 1000) / 10 : null }
      }
      const idle = [await idleCpu('Pulpit'), await idleCpu('Workshop LIVE'), await idleCpu('Centrum zlecenia')]

      const report = { label, date: new Date().toISOString(), db: sourceDb ? path.basename(sourceDb) : 'demo (pusta)', startup: { loadedAt, splashGoneAt, dashboardAt }, screens, idle }
      fs.writeFileSync(path.join(output, `${label}.json`), JSON.stringify(report, null, 2))
      console.log('START', JSON.stringify(report.startup))
      console.log('EKRAN'.padEnd(26), 'stabil.ms'.padStart(9), 'blok.ms'.padStart(8), 'IPC'.padStart(4), 'IPC ms'.padStart(7), 'węzły'.padStart(6), ' najdroższe IPC')
      for (const s of screens) console.log((s.timedOut ? "! " : "") + s.title.padEnd(26), String(s.settleMs).padStart(9), String(s.blockedMs).padStart(8), String(s.ipcCalls).padStart(4), String(s.ipcMs).padStart(7), String(s.nodes).padStart(6), ' ' + s.topIpc.map(([c, n, ms]) => `${c}×${n}=${ms}`).join(', '))
      for (const i of idle) console.log('BEZCZYNNOŚĆ', i.title.padEnd(18), 'CPU', i.cpuPercent + '%')
      console.log('RAPORT', path.join(output, `${label}.json`))
      app.exit(0)
    } catch (error) { console.error(error); app.exit(1) }
  })
})
require('../electron/main.cjs')
