const META={
 WAIT:{group:'WAITING',label:'Oczekiwanie',tone:'warning',rank:3},
 REPLY:{group:'CONTACT',label:'Kontakt',tone:'warning',rank:2},
 PART_LATE:{group:'PARTS',label:'Spóźniona część',tone:'critical',rank:0},
 APPROVAL:{group:'DECISIONS',label:'Decyzja klienta',tone:'decision',rank:2},
 VEHICLE_FINDING:{group:'VEHICLE',label:'Stan pojazdu',tone:'warning',rank:1}
}

export function attentionMeta(row={}){
 const base=META[row.kind]||{group:'OTHER',label:'Inne',tone:'neutral',rank:4}
 if(row.kind==='VEHICLE_FINDING'&&row.severity==='CRITICAL')return {...base,tone:'critical',rank:0}
 if(row.kind==='APPROVAL'&&row.text==='DECLINED')return {...base,tone:'critical',rank:1}
 if(row.kind==='APPROVAL'&&row.text==='APPROVED')return {...base,tone:'positive',rank:2}
 return base
}

const normalize=value=>String(value||'').toLocaleLowerCase('pl-PL').normalize('NFD').replace(/[\u0300-\u036f]/g,'')

export function filterAttention(rows,{group='ALL',query=''}={}){
 const needle=normalize(query)
 return [...(rows||[])].filter(row=>group==='ALL'||attentionMeta(row).group===group).filter(row=>!needle||normalize([row.plate,row.title,row.text,row.note,row.severity].join(' ')).includes(needle)).sort((a,b)=>attentionMeta(a).rank-attentionMeta(b).rank||String(a.created_at||'').localeCompare(String(b.created_at||'')))
}

export function attentionStats(rows=[]){
 return rows.reduce((stats,row)=>{const meta=attentionMeta(row);stats.total++;stats[meta.group]=(stats[meta.group]||0)+1;if(meta.tone==='critical')stats.critical++;return stats},{total:0,critical:0,WAITING:0,CONTACT:0,PARTS:0,DECISIONS:0,VEHICLE:0})
}

export function ageLabel(value,now=Date.now()){
 const time=Date.parse(value||'');if(!Number.isFinite(time))return 'bez daty'
 const minutes=Math.max(0,Math.round((now-time)/60000))
 if(minutes<60)return `${minutes} min temu`
 const hours=Math.round(minutes/60);if(hours<24)return `${hours} godz. temu`
 const days=Math.round(hours/24);return `${days} dni temu`
}

export function attentionHeadline(value){
 const count=Number(value||0),last=count%10,lastTwo=count%100
 if(count===0)return 'Warsztat jest pod kontrolą'
 if(count===1)return '1 sprawa wymaga reakcji'
 if(last>=2&&last<=4&&(lastTwo<12||lastTwo>14))return `${count} sprawy wymagają reakcji`
 return `${count} spraw wymaga reakcji`
}
