// Polish Ł/ł has no canonical decomposition, unlike the other accented
// letters, so fold it explicitly before stripping combining marks.
const normalize=value=>String(value||'').replace(/[Łł]/g,'l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const roundHours=value=>Math.max(.1,Math.round((Number(value)+Number.EPSILON)*10)/10)

// Public cross-vehicle typical times are starting points, not OEM book times.
// For unmatched jobs we preserve the existing workshop estimate and still
// assign a separate value to every variant through the scope adjustments below.
const benchmarks=[
 {key:'vehicle-inspection',hours:1,match:(g,j)=>/przeglad okresowy pojazdu|inspekcja okresowa pojazdu/.test(j)},
 {key:'engine-removal',hours:20.7,match:(g,j)=>/demontaz.*montaz silnika|wymiana silnika|silnik.*demontaz|engine r r/.test(j)},
 {key:'engine-head-gasket',hours:12.5,match:(g,j)=>/uszczelk.*pod glowica|wymiana glowicy|demontaz i montaz glowicy/.test(j)},
 {key:'automatic-transmission-removal',hours:9.8,match:(g,j)=>/demontaz.*skrzyni.*automatycz|wymiana.*skrzyni.*automatycz|skrzynia automatyczna.*demontaz/.test(j)},
 {key:'dual-mass-flywheel',hours:9.8,match:(g,j)=>/kolo dwumasowe|dwumasow.*kolo/.test(j)},
 {key:'timing-chain',hours:8.4,match:(g,j)=>/wymiana.*lancucha rozrzadu|wymiana lancucha.*rozrzad|wymiana zestawu lancucha rozrzadu/.test(j)},
 {key:'clutch-kit',hours:7.5,match:(g,j)=>/zestaw sprzegla|komplet sprzegla|wymiana sprzegla|sprzeglo.*demontaz/.test(j)},
 {key:'manual-transmission-removal',hours:7.5,match:(g,j)=>/demontaz.*skrzyni.*manual|wymiana.*skrzyni.*manual|skrzynia manualna.*demontaz/.test(j)},
 {key:'timing-belt-water-pump',hours:5.5,match:(g,j)=>/rozrzad.*pompa|pompa.*rozrzad/.test(j)},
 {key:'timing-belt',hours:5,match:(g,j)=>/wymiana.*zestawu rozrzadu|wymiana paska rozrzadu|wymiana rozrzadu(?: |$)/.test(j)},
 {key:'ac-evaporator',hours:8.5,match:(g,j)=>/parownik klimatyzacji/.test(j)},
 {key:'heater-core',hours:6.5,match:(g,j)=>/wymiana nagrzewnic/.test(j)},
 {key:'turbocharger',hours:9,match:(g,j)=>/wymiana turbosprezarki|montaz turbosprezarki/.test(j)},
 {key:'alternator',hours:1.5,match:(g,j)=>/wymiana alternatora|alternator.*wymian/.test(j)},
 {key:'starter',hours:1.5,match:(g,j)=>/wymiana rozrusznika|rozrusznik.*wymian/.test(j)},
 {key:'12v-battery',hours:.4,match:(g,j)=>/wymiana akumulatora/.test(j)&&!/(hybryd|elektryczn|trakcyjn|hv)/.test(g+' '+j)},
 {key:'water-pump',hours:3,match:(g,j)=>/pompa wody|pompe wody|pompa cieczy|pompy cieczy/.test(j)},
 {key:'radiator',hours:2.5,match:(g,j)=>/wymiana chlodnicy|chlodnica silnika/.test(j)},
 {key:'ac-compressor',hours:2.5,match:(g,j)=>/sprezark.*klimatyzacji|klimatyzacji.*sprezark/.test(j)},
 {key:'wheel-bearing-press-in',hours:2.5,match:(g,j)=>/wymiana.*lozysk.*wcisk|wymiana.*lozyska.*prasa|prasa.*lozysk/.test(j)},
 {key:'wheel-bearing-hub',hours:1.7,match:(g,j)=>/wymiana.*lozysk.*kola|wymiana.*piast.*lozysk|wymiana.*lozysk.*piast/.test(j)},
 {key:'front-struts-pair',hours:3.7,match:(g,j)=>/wymiana amortyzatorow|wymiana kolumn zawieszenia/.test(j)},
 {key:'control-arm',hours:2.4,match:(g,j)=>/wymiana wahacza|wymiana dolnego wahacza/.test(j)},
 {key:'sway-bar-link',hours:.8,match:(g,j)=>/wymiana lacznika stabilizatora/.test(j)},
 {key:'tie-rod-end',hours:.8,match:(g,j)=>/wymiana koncowki drazka|wymiana koncowek drazkow/.test(j)},
 {key:'brake-pads-and-rotors',hours:1.8,match:(g,j)=>/wymiana.*klock.*tarcz|wymiana.*tarcz.*klock/.test(j)},
 {key:'brake-pads',hours:1.2,match:(g,j)=>/wymiana.*klock.*hamulc/.test(j)},
 {key:'brake-rotors-pair',hours:1.5,match:(g,j)=>/wymiana.*tarcz.*hamulc|wymiana.*hamulc.*tarcz/.test(j)},
 {key:'brake-caliper',hours:1.5,match:(g,j)=>/wymiana.*zacisk.*hamulc|wymiana.*hamulc.*zacisk/.test(j)},
 {key:'brake-fluid-service',hours:.8,match:(g,j)=>/plyn.*hamulc|hamulc.*plyn|odpowietrz.*hamulc/.test(j)},
 {key:'oil-and-filter',hours:.4,match:(g,j)=>/wymiana oleju.*filtr|serwis olejowy|wymiana oleju silnikowego/.test(j)},
 {key:'cabin-filter',hours:.3,match:(g,j)=>/wymiana.*filtr.*kabin|filtr.*kabin.*wymian/.test(j)},
 {key:'air-filter',hours:.3,match:(g,j)=>/wymiana.*filtr.*powietrza/.test(j)},
 {key:'fuel-filter',hours:.7,match:(g,j)=>/wymiana.*filtr.*paliwa|wymiana.*paliwa.*filtr/.test(j)},
 {key:'glow-plugs',hours:2,match:(g,j)=>/swiec.*zarow|zarow.*swiec/.test(j)},
 {key:'spark-plugs',hours:1,match:(g,j)=>/swiec.*zaplon|zaplon.*swiec/.test(j)},
 {key:'thermostat',hours:1.2,match:(g,j)=>/wymiana termostat/.test(j)},
 {key:'wheel-alignment',hours:1,match:(g,j)=>/geometr.*kola|ustawienie zbiezn|geometria zawieszenia/.test(j)},
 {key:'tire-mount-balance',hours:1,match:(g,j)=>/montaz.*wywaz|wymiana opon|przelozenie kol/.test(j)},
 {key:'windshield',hours:2,match:(g,j)=>/wymiana.*szyb.*przedni|szyb.*czo|szyb.*windshield/.test(j)},
 {key:'diagnostic-scan',hours:1,match:(g,j)=>/diagnost|odczyt bledow|skanowanie sterownik/.test(j)},
 {key:'ac-recharge',hours:1,match:(g,j)=>/nabijanie klimatyzacji|serwis klimatyzacji|uzupelnienie czynnika/.test(j)}
]

function benchmarkFor(group,job,variant){
 const g=normalize(group),j=normalize(job),scope=normalize(variant)
 if(/wymiana zestawu rozrzadu/.test(j)&&/lancuch/.test(scope))return benchmarks.find(row=>row.key==='timing-chain')
 if(/reset|kasowanie|kasuj/.test(j))return null
 if(/diagnost|kontrol|pomiar|proba|test |sprawdzen|inspekcj|ocena/.test(j)&&!/(wymian|demontaz|montaz|regenerac|napraw)/.test(j))return benchmarks.find(row=>row.key==='diagnostic-scan')
 return benchmarks.find(row=>row.match(g,j))||null
}

export function catalogTimeForVariant({group,job,variant,baseHours,explicitHours=false}){
 const title=normalize(job),scope=normalize(variant),benchmark=explicitHours?null:benchmarkFor(group,job,variant)
 let hours=Number(benchmark?.hours??baseHours)||1
 let adjustment=''

 if(/reset|kasowanie|kasuj/.test(title)){hours=.3;adjustment='reset z weryfikacją'}
 if(['brake-pads','brake-pads-and-rotors'].includes(benchmark?.key)&&/epb|elektryczn.*hamul|elektryczny hamulec/.test(scope)){hours+=.3;adjustment='EPB'}
 if(benchmark?.key==='timing-chain'&&/wielorzedowy|rozbudowan/.test(scope)){hours+=1.2;adjustment='rozbudowany napęd łańcuchowy'}
 if(benchmark?.key==='brake-pads-and-rotors'&&/tyl|rear/.test(scope)){hours+=.2;adjustment='tylna oś'}
 if(benchmark?.key==='brake-rotors-pair'&&/tyl|rear/.test(scope)){hours+=.3;adjustment='tylna oś'}
 if(benchmark?.key==='spark-plugs'&&/5 6 cylind|v6|v8|utrudnion/.test(scope)){hours+=.5;adjustment='większy silnik lub dostęp'}
 if(benchmark?.key==='front-struts-pair'&&/tyl|rear/.test(scope)){hours=2.2;adjustment='tylna oś'}
 if(benchmark?.key==='front-struts-pair'&&/przod|front/.test(scope)){hours=3.7;adjustment='przednia para'}
 if(benchmark?.key==='front-struts-pair'&&/pojedyncz|jedna strona|single/.test(scope)){hours=2;adjustment='pojedynczy element'}
 if(benchmark?.key==='sway-bar-link'&&/para|komplet|oba|obie|os przednia|os tylna/.test(scope)){hours=1.4;adjustment='para'}
 if(benchmark?.key==='tie-rod-end'&&/para|komplet|oba|obie|obustron/.test(scope)){hours=1.4;adjustment='obie strony'}
 if(/utrudnion.*dostep|ograniczon.*dostep|zapieczon|dodatkow.*demontaz/.test(scope)){hours=Math.max(hours+.3,hours*1.25);adjustment=adjustment||'utrudniony dostęp'}
 if(/pelny przeglad|rozszerzon.*przeglad/.test(scope)&&benchmark?.key==='vehicle-inspection'){hours=1.8;adjustment='rozszerzony zakres'}
 if(/podstawow.*diagnost|odczyt samych bledow/.test(scope)&&benchmark?.key==='diagnostic-scan'){hours=.6;adjustment='podstawowy odczyt'}
 if(/podstawowa kontrola|kontrola podstawowa|odczyt podstawowy/.test(scope)&&benchmark?.key==='diagnostic-scan'){hours=.6;adjustment='podstawowa kontrola'}
 if(/pomiary|parametr|test potwierdzaj|lokalizacj/.test(scope)&&benchmark?.key==='diagnostic-scan'){hours=1.2;adjustment='pomiary i test'}
 if(/rozszerzon|zaawansowan|oscyloskop|instalacj|sygnal/.test(scope)&&benchmark?.key==='diagnostic-scan'){hours=1.5;adjustment='diagnostyka rozszerzona'}
 if(/czyszczeniem obudowy/.test(scope)&&benchmark?.key==='cabin-filter'){hours+=.2;adjustment='czyszczenie obudowy'}
 if(/demontaz.*oslon|oslon.*demontaz/.test(scope)){hours+=.2;adjustment=adjustment||'demontaż osłon'}
 if(/plukan/.test(scope)){hours+=.3;adjustment=adjustment||'płukanie układu'}
 if(/przygotowanie ukladu olejowego/.test(scope)&&benchmark?.key==='turbocharger'){hours+=.8;adjustment=adjustment||'przygotowanie układu olejowego'}
 if(/diesel/.test(scope)&&benchmark?.key==='fuel-filter'){hours+=.1;adjustment=adjustment||'odpowietrzenie diesla'}
 if(/odpowietrzen|procedur.*serwis/.test(scope)&&benchmark?.key==='fuel-filter'){hours+=.2;adjustment=adjustment||'odpowietrzenie układu'}
 if(/programow|kodowan|adaptacj|kalibracj/.test(scope)&&!/(programow|kodowan|adaptacj|kalibracj)/.test(title)){hours+=.5;adjustment=adjustment||'programowanie lub adaptacja'}

 const resolved=roundHours(hours)
 return {
  hours:resolved,
  timeBasis:explicitHours?'CATALOG_CURATED':benchmark?'PUBLIC_COMPARATOR':'AUTLOGIKA_ESTIMATE',
  timeReference:benchmark?.key||null,
  timeAdjustment:adjustment||null
 }
}

export const CATALOG_TIME_POLICY='Generic time catalog values are starting estimates. Confirm vehicle-specific operations and safety-critical work against OEM service information.'
