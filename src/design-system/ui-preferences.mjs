// AutoLogika UI 2.0 — preferencje wyglądu powłoki (bez logiki biznesowej).
// Klucze w localStorage mają prefiks "autologika.", jak pozostałe ustawienia interfejsu.
// "autologika.ui" = "legacy" wyłącza UI 2.0 (awaryjny powrót do poprzedniego wyglądu).

export const UI_PREFERENCE_KEYS=Object.freeze({
 ui:'autologika.ui',
 sidebarCollapsed:'autologika.sidebarCollapsed'
})

function storage(){
 try{return globalThis.localStorage||null}catch{return null}
}

export function readUiPreference(name,store=storage()){
 const key=UI_PREFERENCE_KEYS[name]
 if(!key||!store)return null
 try{return store.getItem(key)}catch{return null}
}

export function writeUiPreference(name,value,store=storage()){
 const key=UI_PREFERENCE_KEYS[name]
 if(!key||!store)return false
 try{store.setItem(key,String(value));return true}catch{return false}
}

export function isUi2Enabled(store=storage()){
 return readUiPreference('ui',store)!=='legacy'
}

// Ustawia klasę html.ui2 i atrybut data-sidebar na elemencie głównym dokumentu.
export function applyUiShell(root,{sidebarCollapsed=false,enabled=isUi2Enabled()}={}){
 if(!root)return
 root.classList.toggle('ui2',Boolean(enabled))
 root.dataset.sidebar=sidebarCollapsed?'collapsed':'expanded'
}
