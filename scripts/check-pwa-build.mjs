import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist')
const read=name=>fs.readFileSync(path.join(dist,name),'utf8')
assert.ok(fs.existsSync(path.join(dist,'sw.js')),'Brak wygenerowanego Service Workera')
assert.ok(fs.existsSync(path.join(dist,'apple-touch-icon.png')),'Brak Apple Touch Icon')
assert.ok(fs.existsSync(path.join(dist,'pwa-192x192.png')),'Brak ikony 192x192')
assert.ok(fs.existsSync(path.join(dist,'pwa-512x512.png')),'Brak ikony 512x512')
const manifest=JSON.parse(read('manifest.webmanifest'))
assert.equal(manifest.name,'AutoLogika OS')
assert.equal(manifest.short_name,'AutoLogika')
assert.equal(manifest.display,'standalone')
assert.equal(manifest.orientation,'portrait')
assert.equal(manifest.start_url,'./')
assert.ok(manifest.icons.some(icon=>icon.sizes==='192x192'))
assert.ok(manifest.icons.some(icon=>icon.sizes==='512x512'&&icon.purpose==='maskable'))
const html=read('index.html'),sw=read('sw.js')
assert.match(html,/viewport-fit=cover/)
assert.match(html,/apple-touch-icon/)
assert.doesNotMatch(sw,/supabase\.co|sync_records|NetworkFirst|BackgroundSync/,'Service Worker nie może buforować danych Supabase ani kolejkować zapisów')
assert.match(sw,/precacheAndRoute/)
console.log(`PWA OK: ${manifest.name}, ${manifest.icons.length} ikony, Service Worker tylko z precache zasobów statycznych.`)
