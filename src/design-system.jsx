import React from 'react'
import {Icon} from './ui.jsx'

/** Presentational primitives: callers own values, formatting and actions. */
export function MetricCard({icon,title,value,description,onClick,tone='default'}){
 return <button type="button" className={`studioKpi uiMetric uiMetric--${tone}`} onClick={onClick}>
  <div className="kpiTop"><span>{title}</span><Icon name={icon}/></div>
  <strong>{value}</strong>
  <div className="kpiBottom"><span>{description}</span><Icon name="arrow" size={16}/></div>
 </button>
}

export function PageIntro({eyebrow,title,children,actions}){
 return <div className="uiPageIntro"><div><span className="uiEyebrow">{eyebrow}</span><h2>{title}</h2>{children}</div><div className="uiPageActions">{actions}</div></div>
}
