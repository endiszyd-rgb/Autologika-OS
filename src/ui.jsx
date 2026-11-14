import React from 'react'

const paths = {
 dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 intake:'M12 5v14 M5 12h14',
 center:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
 schedule:'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2 M7 3v4 M17 3v4 M3 10h18 M7 14h3 M14 14h3',
 kanban:'M3 4h5v12H3z M10 4h5v16h-5z M17 4h4v9h-4z',
 notifications:'M12 8v5 M12 17h.01 M10 3 2 18a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 3a2 2 0 0 0-4 0',
 orders:'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4',
 customers:'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M2 21v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 7 M18 15a5 5 0 0 1 4 5',
 inventory:'m3 7 9-4 9 4v11l-9 4-9-4z M3 7l9 4 9-4 M12 11v11 M7 5l10 4v5',
 debtors:'M3 6h17v14H3z M3 6V4h14 M15 11h7v5h-7z',
 scanner:'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M7 7v10 M11 7v10 M15 7v10 M18 7v10',
 diagnostics:'M2 12h4l3-8 6 16 3-8h4',
 knowledge:'M12 5Q7 1 2 4v16q5-3 10 0 5-3 10 0V4q-5-3-10 1v15',
 assistant:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
 employees:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M5 21v-3a7 7 0 0 1 14 0v3 M9 14l3 4 3-4',
 reminders:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l4 2',
 finance:'M3 3v18h18 M7 16v-5 M12 16V7 M17 16V4',
 documents:'M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h6',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
 search:'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15 M16 16l5 5',
 arrow:'M5 12h14 M13 6l6 6-6 6',
 car:'M5 9l2-5h10l2 5 M3 10l2-1h14l2 1v8H3z M5 18v3 M19 18v3 M6 13h2 M16 13h2',
 check:'m5 12 4 4L19 6',
 play:'m8 4 12 8-12 8z',
 chevron:'m9 5 7 7-7 7',
 bolt:'m13 2-9 12h7l-1 8 10-12h-7z',
 sidebar:'M4 4h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1 M9 4v16 M15 10l-2 2 2 2',
 contrast:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 3v18 M12 7h5 M12 11h7 M12 15h6',
 apps:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M17 14v6 M14 17h6',
 cloud:'M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5 4.75 4.75 0 0 1 17.5 18z',
 device:'M4 5h16v11H4z M2 19h20 M10 16v3 M14 16v3',
 camera:'M4 8h3l2-3h6l2 3h3v11H4z M12 10.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
 barcode:'M4 6v12 M7 6v12 M10 6v12 M14 6v12 M16 6v12 M20 6v12',
 grid:'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
 list:'M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01',
 pin:'M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11z M12 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
 plus:'M12 5v14 M5 12h14',
}
export function Icon({name,size=18,...props}) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]||paths.center}/></svg>
}

export function LoadingState({label='Wczytuję dane',detail='To potrwa tylko chwilę.',compact=false}){
 return <div className={'appLoadingState'+(compact?' compact':'')} role="status" aria-live="polite" aria-busy="true">
  <div className="appLoadingMark" aria-hidden="true"><i/><i/><i/></div>
  <div className="appLoadingCopy"><b>{label}</b><span>{detail}</span></div>
  <div className="appLoadingSkeleton" aria-hidden="true"><i/><i/><i/></div>
 </div>
}

const statusTones={PRZYJETE:'info',PLAN:'info',DIAGNOZA:'warning',WYCENA:'warning',AKCEPTACJA:'violet',POTWIERDZONY:'violet',NAPRAWA:'active',W_TRAKCIE:'active',QC_NAPRAWY:'active',QC_WYDANIA:'active',PLATNOSC:'info',GOTOWE:'success',ZAKONCZONY:'success',APPROVED:'success',WYDANE:'neutral',ANULOWANY:'danger',DECLINED:'danger',EXPIRED:'warning'}
export function StatusBadge({status,label}){
 const key=String(status||'BRAK').toUpperCase(),tone=statusTones[key]||'neutral'
 return <span className={'statusBadge '+tone} data-status={key}><i aria-hidden="true"/>{label||String(status||'Brak statusu')}</span>
}
