// AutoLogika UI 2.0 — komponenty wielokrotnego użytku.
// Czysto prezentacyjne: nie pobierają danych i nie zawierają logiki biznesowej.
// Wygląd pochodzi z src/design-system/components.css (tokeny z tokens.css).
import React from 'react'

import {BUTTON_VARIANTS,BUTTON_SIZES,TONES,cx,buttonClass,badgeClass,initialsFor,greetingFor} from './ui-classes.mjs'

export {BUTTON_VARIANTS,BUTTON_SIZES,TONES,buttonClass,badgeClass,greetingFor}

export function Button({variant='secondary',size='md',block=false,icon=null,trailing=null,busy=false,type='button',className,onClick,children,...rest}){
 return <button type={type} className={buttonClass({variant,size,block,className})} aria-busy={busy?'true':undefined} onClick={onClick} {...rest}>{icon}{children}{trailing}</button>
}

export function IconButton({label,size='md',variant='default',className,onClick,children,...rest}){
 return <button type="button" className={cx('ui-icon-btn',size==='sm'&&'ui-icon-btn--sm',variant==='ghost'&&'ui-icon-btn--ghost',className)} aria-label={label} title={rest.title??label} onClick={onClick} {...rest}>{children}</button>
}

export function Card({as:Tag='section',variant,interactive=false,className,children,...rest}){
 return <Tag className={cx('ui-card',variant&&`ui-card--${variant}`,interactive&&'ui-card--interactive',className)} {...rest}>{children}</Tag>
}

export function CardHeader({eyebrow,title,subtitle,actions,titleId,level=3}){
 const Heading=`h${Math.min(6,Math.max(2,level))}`
 return <div className="ui-card__header"><div>{eyebrow&&<span className="ui-eyebrow">{eyebrow}</span>}<Heading id={titleId} className="ui-card__title">{title}</Heading>{subtitle&&<span className="ui-card__subtitle">{subtitle}</span>}</div>{actions&&<div className="ui-card__actions">{actions}</div>}</div>
}

export function Badge({tone='neutral',dot=false,className,children,...rest}){
 return <span className={badgeClass({tone,dot,className})} {...rest}>{children}</span>
}

export function Kbd({children}){return <kbd className="ui-kbd">{children}</kbd>}

export function Eyebrow({children,className}){return <span className={cx('ui-eyebrow',className)}>{children}</span>}

export function StatTile({icon,label,value,meta,trailing,tone,className,onClick,...rest}){
 const body=<><span className="ui-stat__top"><span>{label}</span>{icon&&<span className="ui-stat__icon" aria-hidden="true">{icon}</span>}</span><strong className="ui-stat__value">{value}</strong>{(meta||trailing)&&<span className="ui-stat__meta"><span>{meta}</span>{trailing}</span>}</>
 const classes=cx('ui-stat',tone&&`ui-stat--${tone}`,className)
 return onClick?<button type="button" className={classes} onClick={onClick} {...rest}>{body}</button>:<div className={classes} {...rest}>{body}</div>
}

export function EmptyState({icon,title,children,action}){
 return <div className="ui-empty">{icon&&<span className="ui-empty__icon" aria-hidden="true">{icon}</span>}{title&&<b>{title}</b>}{children&&<span>{children}</span>}{action}</div>
}

export function Skeleton({width='100%',height=14,radius,className}){
 return <span className={cx('ui-skeleton',className)} aria-hidden="true" style={{display:'block',width,height,borderRadius:radius}}/>
}

// Segmented: options = [[value,label], ...]
export function Segmented({options,value,onChange,label,className}){
 return <div className={cx('ui-segmented',className)} role="group" aria-label={label}>{options.map(([optionValue,optionLabel])=><button type="button" key={optionValue} aria-pressed={value===optionValue} className={value===optionValue?'active':''} onClick={()=>onChange(optionValue)}>{optionLabel}</button>)}</div>
}

export function Avatar({name='',className}){
 return <span className={cx('ui-avatar',className)} aria-hidden="true">{initialsFor(name)}</span>
}

// Sygnet AutoLogika do zwiniętego menu i małych powierzchni (logo poziome jest za szerokie).
export function BrandMark({size=36,className,decorative=false}){
 const gradientId=`uiBrandMark${React.useId().replace(/[^a-zA-Z0-9_-]/g,'')}`
 const a11y=decorative?{'aria-hidden':'true',focusable:'false'}:{role:'img','aria-label':'AutoLogika'}
 return <svg className={cx('ui-brandmark',className)} width={size} height={size} viewBox="0 0 40 40" {...a11y}>
  <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e04a72"/><stop offset="1" stopColor="#8f2241"/></linearGradient></defs>
  <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${gradientId})`}/>
  <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" fill="none" stroke="rgba(255,255,255,.22)"/>
  <path d="M10 28 18.2 11h3.6L30 28" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M8 23h7l2-3.2 2.6 6 2.2-4.2 1.4 1.4H32" fill="none" stroke="#ffd6e0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>
}
