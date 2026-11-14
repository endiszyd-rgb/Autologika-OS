// AutoLogika UI 2.0 — czyste funkcje pomocnicze komponentów (testowane w tests/design-system.test.mjs).

export const BUTTON_VARIANTS=Object.freeze(['primary','secondary','ghost','soft','danger'])
export const BUTTON_SIZES=Object.freeze(['sm','md','lg'])
export const TONES=Object.freeze(['neutral','accent','success','warning','danger','info','violet'])

export const cx=(...parts)=>parts.filter(Boolean).join(' ')

export function buttonClass({variant='secondary',size='md',block=false,className}={}){
 return cx('ui-btn',BUTTON_VARIANTS.includes(variant)&&`ui-btn--${variant}`,size!=='md'&&BUTTON_SIZES.includes(size)&&`ui-btn--${size}`,block&&'ui-btn--block',className)
}

export function badgeClass({tone='neutral',dot=false,className}={}){
 return cx('ui-badge',TONES.includes(tone)&&tone!=='neutral'&&`ui-badge--${tone}`,dot&&'ui-badge--dot',className)
}

export function initialsFor(name=''){
 return String(name).trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase()||'AL'
}

// Powitanie na pulpicie zależne od pory dnia.
export function greetingFor(date=new Date()){
 const hour=date.getHours()
 return hour>=5&&hour<18?'Dzień dobry':'Dobry wieczór'
}
