import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {buttonClass,badgeClass,initialsFor,greetingFor} from '../src/design-system/ui-classes.mjs'
import {applyUiShell,isUi2Enabled,readUiPreference,writeUiPreference,UI_PREFERENCE_KEYS} from '../src/design-system/ui-preferences.mjs'

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8')
const tokens=await read('src/design-system/tokens.css')
const components=await read('src/design-system/components.css')
const shell=await read('src/design-system/shell.css')
const mainSource=await read('src/main.jsx')

function memoryStore(initial={}){const data=new Map(Object.entries(initial));return{getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),data}}
function splitSelectorList(list){const parts=[];let depth=0,current='';for(const char of list){if(char==='('||char==='[')depth++;else if(char===')'||char===']')depth--;if(char===','&&depth===0){parts.push(current);current=''}else current+=char}parts.push(current);return parts}
function fakeRoot(){const classes=new Set();return{classList:{toggle:(name,on)=>{on?classes.add(name):classes.delete(name)},contains:name=>classes.has(name)},dataset:{},classes}}

test('tokens define every design-system category',()=>{
  const required=['--ui-bg','--ui-surface-1','--ui-border','--ui-text','--ui-accent','--ui-success','--ui-warning','--ui-danger','--ui-info',
    '--ui-font-sans','--ui-text-sm','--ui-text-3xl','--ui-weight-semibold','--ui-space-4','--ui-radius-sm','--ui-radius-lg','--ui-radius-full',
    '--ui-shadow-sm','--ui-shadow-xl','--ui-ring','--ui-duration-fast','--ui-ease-standard','--ui-z-sidebar','--ui-z-dock','--ui-touch-min','--ui-safe-bottom']
  for(const token of required)assert.match(tokens,new RegExp(`${token}:`),`brak tokenu ${token}`)
})

test('every --ui-* variable used by the design system is defined in tokens.css',()=>{
  const defined=new Set([...tokens.matchAll(/(--ui-[a-z0-9-]+):/g)].map(match=>match[1]))
  const used=new Set([...`${components}\n${shell}`.matchAll(/var\((--ui-[a-z0-9-]+)/g)].map(match=>match[1]))
  const missing=[...used].filter(name=>!defined.has(name))
  assert.deepEqual(missing,[])
})

test('design-system layer is loaded last, in token → component → shell order',()=>{
  const order=['./theme-bordo.css','./design-system/tokens.css','./design-system/components.css','./design-system/shell.css'].map(path=>mainSource.indexOf(`import '${path}'`))
  assert.ok(order.every(index=>index>0),'brakuje importu warstwy UI 2.0')
  assert.deepEqual([...order].sort((a,b)=>a-b),order)
  const lastCssImport=Math.max(...[...mainSource.matchAll(/import '[^']+\.css'/g)].map(match=>match.index))
  assert.equal(lastCssImport,order.at(-1))
})

test('UI 2.0 styles are scoped under html.ui2 so the legacy look can be restored',()=>{
  for(const [name,css] of [['components',components],['shell',shell]]){
    const selectors=css.replace(/\/\*[\s\S]*?\*\//g,'').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g,'').match(/(^|[{}])\s*([^{}@]+)\{/g)||[]
    const unscoped=selectors.map(raw=>raw.replace(/^[{}]?\s*/,'').replace(/\{$/,'').trim()).filter(selector=>selector&&!/^(from|to|\d+%)/.test(selector)).flatMap(splitSelectorList).map(part=>part.trim()).filter(part=>part&&!part.startsWith('html.ui2')&&!part.startsWith('html:not(.ui2)'))
    assert.deepEqual(unscoped,[],`${name}.css ma selektory poza html.ui2`)
  }
})

test('motion respects prefers-reduced-motion and avoids costly backdrop blur',()=>{
  for(const css of [tokens,components,shell]){
    assert.match(css,/@media \(prefers-reduced-motion:reduce\)/)
    assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g,''),/backdrop-filter/)
  }
})

test('responsive shell covers Windows sidebar, tablet rail and phone dock with safe areas',()=>{
  assert.match(shell,/@media \(min-width:1280px\)\{[\s\S]*html\.ui2\[data-sidebar="expanded"\]\{--sb-w:var\(--ui-sidebar-expanded\)\}/)
  assert.match(shell,/@media \(min-width:601px\)\{[\s\S]*--sb-w:var\(--ui-sidebar-rail\)/)
  assert.match(shell,/@media \(max-width:600px\)\{[\s\S]*html\.ui2\.pwaPlatform \.shell>aside\{[\s\S]*var\(--ui-safe-bottom\)/)
  assert.match(shell,/:has\(:focus-visible\)/,'pasek ikon musi rozwijać się także przy nawigacji klawiaturą')
  assert.match(shell,/\.commandLauncher\{flex:0 0 44px;width:44px/,'przyciski górnego paska na telefonie mają cel dotyku 44 px')
})

test('buttonClass and badgeClass map variants to design-system classes',()=>{
  assert.equal(buttonClass(),'ui-btn ui-btn--secondary')
  assert.equal(buttonClass({variant:'primary',size:'lg',block:true}),'ui-btn ui-btn--primary ui-btn--lg ui-btn--block')
  assert.equal(buttonClass({variant:'unknown',size:'xl',className:'extra'}),'ui-btn extra')
  assert.equal(badgeClass(),'ui-badge')
  assert.equal(badgeClass({tone:'warning',dot:true}),'ui-badge ui-badge--warning ui-badge--dot')
  for(const css of ['ui-btn--primary','ui-btn--ghost','ui-btn--soft','ui-btn--danger','ui-btn--sm','ui-btn--lg','ui-badge--warning','ui-badge--violet','ui-card--interactive','ui-segmented','ui-stat','ui-empty','ui-skeleton','ui-kbd'])
    assert.match(components,new RegExp(`\\.${css}\\b`),`brak stylu .${css}`)
})

test('initials and greeting helpers are deterministic',()=>{
  assert.equal(initialsFor('Jan Kowalski'),'JK')
  assert.equal(initialsFor('  anna  '),'A')
  assert.equal(initialsFor(''),'AL')
  assert.equal(greetingFor(new Date(2026,10,13,8)),'Dzień dobry')
  assert.equal(greetingFor(new Date(2026,10,13,17,59)),'Dzień dobry')
  assert.equal(greetingFor(new Date(2026,10,13,18)),'Dobry wieczór')
  assert.equal(greetingFor(new Date(2026,10,13,2)),'Dobry wieczór')
})

test('UI preferences toggle html.ui2, remember the sidebar and survive blocked storage',()=>{
  const store=memoryStore()
  assert.equal(isUi2Enabled(store),true)
  assert.equal(writeUiPreference('sidebarCollapsed','1',store),true)
  assert.equal(store.data.get(UI_PREFERENCE_KEYS.sidebarCollapsed),'1')
  assert.equal(readUiPreference('sidebarCollapsed',store),'1')
  assert.equal(readUiPreference('unknown',store),null)

  const root=fakeRoot()
  applyUiShell(root,{sidebarCollapsed:true,enabled:true})
  assert.equal(root.classList.contains('ui2'),true)
  assert.equal(root.dataset.sidebar,'collapsed')
  applyUiShell(root,{sidebarCollapsed:false,enabled:isUi2Enabled(memoryStore({'autologika.ui':'legacy'}))})
  assert.equal(root.classList.contains('ui2'),false)
  assert.equal(root.dataset.sidebar,'expanded')

  const blocked={getItem(){throw new Error('SecurityError')},setItem(){throw new Error('QuotaExceededError')}}
  assert.equal(readUiPreference('sidebarCollapsed',blocked),null)
  assert.equal(writeUiPreference('sidebarCollapsed','1',blocked),false)
  assert.equal(isUi2Enabled(blocked),true)
})

test('shell keeps the hooks used by smoke tests and assistive technology',()=>{
  assert.match(mainSource,/<aside aria-label="Menu główne">/)
  assert.match(mainSource,/className="sidebarToggle" aria-pressed=\{!sidebarCollapsed\}/)
  assert.match(mainSource,/<div className="sideModeButtons"><button type="button" className=\{outdoorMode\?'active':''\}/,'pierwszy przycisk stopki to tryb warsztatowy')
  assert.match(mainSource,/title=\{name\} onClick=\{\(\)=>setPage\(id\)\}/,'pozycje menu zachowują atrybut title')
})

test('touch ergonomics: outdoor mode enlarges shell controls and the rail opens on hover only with a fine pointer',()=>{
  assert.match(tokens,/html\.ui2\.workshopOutdoor\{[^}]*--ui-touch-min:52px/)
  const outdoor=shell.slice(shell.indexOf('Tryb warsztatowy — większe cele dotyku'))
  for(const target of ['.navSection button{height:var(--ui-touch-min)','.ui-btn{--btn-h:var(--ui-touch-min)','.studioFilters button'])
    assert.ok(outdoor.includes(target),`tryb warsztatowy nie powiększa: ${target}`)
  const marker='and (hover:hover) and (pointer:fine){'
  const hoverBlocks=shell.split('@media').filter(block=>block.includes(marker)).join('\n')
  const otherBlocks=shell.split('@media').filter(block=>!block.includes(marker)).join('\n')
  assert.match(hoverBlocks,/\.shell>aside:hover\{width:var\(--ui-sidebar-expanded\)/)
  assert.doesNotMatch(otherBlocks,/\.shell>aside:hover/,'rozwijanie po :hover poza blokiem (hover:hover) przykleja menu na tabletach')
})

test('legacy fallback hides markup that only UI 2.0 styles',()=>{
  assert.match(components,/html:not\(\.ui2\) :is\(\.brandMark2,\.sidebarToggle/)
})
