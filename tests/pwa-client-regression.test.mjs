import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'

const clientSource=await readFile(new URL('../src/platform/pwa-client.js',import.meta.url),'utf8')
const mobileCss=await readFile(new URL('../src/platform/pwa.css',import.meta.url),'utf8')

test('PWA Supabase key cannot shadow the record key method',()=>{
  assert.match(clientSource,/this\.apiKey=/)
  assert.match(clientSource,/key\(entity,cloudId\)/)
  assert.doesNotMatch(clientSource,/this\.key\s*=/)
})

test('PWA phone layout replaces the desktop rail with a bottom dock',()=>{
  assert.match(mobileCss,/\.pwaPlatform \.shell>aside\{position:fixed/)
  assert.match(mobileCss,/inset:auto 0 0/)
  assert.match(mobileCss,/\.pwaPlatform \.shell>main\{width:100%/)
})
