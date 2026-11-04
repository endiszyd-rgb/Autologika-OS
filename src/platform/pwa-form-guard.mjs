// Draft values stay in memory; no customer fields are stored in browser storage.
export function createDraftTracker(){
 const entries=new Map()
 return {
  capture(key,value){if(!entries.has(key))entries.set(key,{baseline:value,current:value})},
  change(key,value,initial=value){if(!entries.has(key))entries.set(key,{baseline:initial,current:value});else entries.get(key).current=value},
  dirty(key){return key===undefined?[...entries.values()].some(e=>e.current!==e.baseline):entries.has(key)&&entries.get(key).current!==entries.get(key).baseline},
  keys(){return [...entries.keys()]},
  forget(key){entries.delete(key)},
  clear(){entries.clear()},
  checkpoint(keys){const captured=keys.filter(key=>entries.has(key)).map(key=>[key,entries.get(key).current]);return()=>{for(const [key,value] of captured){const entry=entries.get(key);if(entry?.current===value)entry.baseline=value}}}
 }
}
const ignored=control=>control.readOnly||['hidden','submit','button','file'].includes(control.type)||control.closest('[data-pwa-ignore-dirty]')||/szukaj|wyszuk|search/i.test(`${control.placeholder||''} ${control.getAttribute('aria-label')||''}`)
const controls=root=>[...root.querySelectorAll('input,textarea,select')].filter(control=>!ignored(control))
const signature=(root,defaults=false)=>JSON.stringify(controls(root).map(control=>[control.name||control.id||control.type,control.type==='checkbox'||control.type==='radio'?(defaults?control.defaultChecked:control.checked):defaults&&control.tagName!=='SELECT'?control.defaultValue:control.value]))
const scopeFor=node=>node?.closest?.('.modal,.plannerModal,.intakePage')
let activeGuard=null
export function confirmPwaNavigation(){return activeGuard?activeGuard.confirm():true}
export function preparePwaFormSave(scope){return activeGuard?activeGuard.prepare(scope):()=>{}}

export function installPwaFormGuard(win=window,doc=document,onDirty=()=>{}){
 const tracker=createDraftTracker();let disposed=false,lastDirty=false
 const notify=()=>{const dirty=tracker.dirty();win.autologikaPwaDirty=dirty;if(dirty!==lastDirty){lastDirty=dirty;onDirty(dirty);if(!dirty)win.dispatchEvent(new Event('autologika:pwa-form-clean'))}}
 const sweep=()=>{if(disposed)return;for(const root of tracker.keys()){if(!root.isConnected)tracker.forget(root);else tracker.change(root,signature(root))}notify()}
 const relevant=scope=>tracker.keys().filter(root=>!scope||scope===root||scope.contains(root))
 const confirm=scope=>{sweep();const keys=relevant(scope);if(!keys.some(key=>tracker.dirty(key)))return true;if(!win.confirm('Masz niezapisane zmiany. Czy chcesz je odrzucić i opuścić formularz?'))return false;keys.forEach(key=>tracker.forget(key));notify();return true}
 const prepare=scope=>{sweep();const container=scope||doc.activeElement?.closest?.('.modal,.plannerModal,.panel,.intakePage')||doc.activeElement;const finish=tracker.checkpoint(relevant(container));return()=>{sweep();finish();notify()}}
 const focus=event=>{const root=scopeFor(event.target);if(root)tracker.capture(root,signature(root))}
 const input=event=>{if(!event.target.matches?.('input,textarea,select')||ignored(event.target))return;const root=scopeFor(event.target);if(!root)return;tracker.change(root,signature(root),signature(root,true));notify()}
 const changed=event=>{const root=event.detail?.root||scopeFor(doc.activeElement);if(root&&tracker.keys().includes(root)){tracker.change(root,signature(root));notify()}}
 const click=event=>{const button=event.target.closest?.('button');if(!button)return;const modal=button.closest('.modal,.plannerModal');if(modal&&(/^(Anuluj|Zamknij)(\b|:)/i.test(button.textContent.trim())||/^Zamknij/i.test(button.getAttribute('aria-label')||'')))if(!confirm(modal)){event.preventDefault();event.stopImmediatePropagation()}}
 const backdrop=event=>{if(event.target.matches?.('.modalback,.plannerModalShade')){const modal=event.target.querySelector('.modal,.plannerModal');if(modal&&!confirm(modal)){event.preventDefault();event.stopImmediatePropagation()}}}
 const key=event=>{if(event.key==='Escape'){const modal=doc.querySelector('.modal,.plannerModal');if(modal&&!confirm(modal)){event.preventDefault();event.stopImmediatePropagation()}}}
 const unload=event=>{sweep();if(tracker.dirty()){event.preventDefault();event.returnValue=''}}
 doc.addEventListener('focusin',focus,true);doc.addEventListener('input',input,true);doc.addEventListener('change',input,true);doc.addEventListener('click',click,true);doc.addEventListener('mousedown',backdrop,true);doc.addEventListener('keydown',key,true);win.addEventListener('beforeunload',unload);win.addEventListener('autologika:pwa-form-changed',changed)
 const observer=new win.MutationObserver(sweep);observer.observe(doc.body,{childList:true,subtree:true})
 const guard={confirm,prepare,clear:()=>{tracker.clear();notify()}};activeGuard=guard
 return {clear:guard.clear,dispose:()=>{disposed=true;observer.disconnect();doc.removeEventListener('focusin',focus,true);doc.removeEventListener('input',input,true);doc.removeEventListener('change',input,true);doc.removeEventListener('click',click,true);doc.removeEventListener('mousedown',backdrop,true);doc.removeEventListener('keydown',key,true);win.removeEventListener('beforeunload',unload);win.removeEventListener('autologika:pwa-form-changed',changed);if(activeGuard===guard)activeGuard=null;win.autologikaPwaDirty=false}}
}
