const fold=value=>String(value||'').toLocaleLowerCase('pl').replaceAll('ł','l').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()

const STOP=new Set(['oraz','jest','sa','sie','nie','dla','przy','pod','nad','lub','bez','po','do','na','w','z','i','a','o','u','od','auto','samochod','pojazd','silnik','uklad','blad','bledy','diagnostyka','sprawdz','kontrola'])
export const diagnosticTokens=value=>[...new Set(fold(value).split(/\s+/).filter(token=>token.length>2&&!STOP.has(token)))]

const RULES=[
 {id:'boost',label:'Układ doładowania',words:['brak mocy','traci moc','utrata mocy','tryb awaryjny','turbo','turbina','doladowanie','underboost','overboost'],dtcs:['P0299','P0234','P2263'],hypothesis:'Nieszczelność dolotu, sterowanie turbosprężarką albo niewłaściwa wydajność doładowania.',tests:['Porównaj ciśnienie doładowania zadane i rzeczywiste w tych samych warunkach.','Wykonaj próbę szczelności dolotu i sprawdź przewody podciśnienia.','Sprawdź wysterowanie oraz pełny zakres pracy siłownika turbiny / zaworu sterującego.'],questions:['Czy utrata mocy występuje przy określonych obrotach lub obciążeniu?','Czy po ponownym uruchomieniu pełna moc chwilowo wraca?'],search:['diagnostyka turbo','diagnostyka ukladu doladowania','test szczelnosci dolotu','logi drogowe']},
 {id:'dpf',label:'DPF / układ emisji',words:['dpf','filtr czastek','regeneracja','wypalanie','roznicy cisnien','sadza','popiol'],dtcs:['P2002','P242F','P2452','P2453','P2463'],hypothesis:'Zapełnienie filtra, błędny pomiar różnicy ciśnień albo niespełnione warunki regeneracji.',tests:['Zapisz masę sadzy i popiołu, przebieg od ostatniej regeneracji oraz status jej blokady.','Porównaj różnicę ciśnień przy wyłączonym silniku, na biegu jałowym i pod obciążeniem.','Sprawdź przewody ciśnieniowe i temperatury spalin przed decyzją o regeneracji.'],questions:['Czy pojazd jeździ głównie na krótkich odcinkach?','Czy ostatnie regeneracje były przerywane?'],search:['diagnostyka dpf','diagnostyka czujnika roznicy cisnien','filtr czastek','regeneracja dpf']},
 {id:'egr',label:'EGR / przepływ spalin',words:['egr','recyrkulacja','przeplyw spalin'],dtcs:['P0400','P0401','P0402','P0403','P0404'],hypothesis:'Nieprawidłowy przepływ EGR, zacięcie zaworu albo problem z jego sterowaniem lub pomiarem.',tests:['Porównaj pozycję EGR zadaną i rzeczywistą.','Wykonaj test elementu wykonawczego i obserwuj MAF / MAP.','Sprawdź drożność kanałów oraz zasilanie i sterowanie zaworu.'],questions:['Czy objaw nasila się na biegu jałowym lub przy małym obciążeniu?'],search:['diagnostyka egr','test egr','przeplyw spalin']},
 {id:'start',label:'Rozruch i zasilanie silnika',words:['nie odpala','nie zapala','kreci nie odpala','ciezki rozruch','dlugo kreci','rozruch'],dtcs:['P0335','P0340','P0087','P0191','P0562'],hypothesis:'Należy rozdzielić problem prędkości rozruchowej, synchronizacji, zasilania paliwem i autoryzacji rozruchu.',tests:['Zmierz napięcie i spadki napięcia podczas rozruchu.','Sprawdź RPM, synchronizację wał/wałek i status autoryzacji rozruchu.','Porównaj wymagane i rzeczywiste ciśnienie paliwa podczas kręcenia.'],questions:['Czy problem występuje na zimnym, ciepłym czy każdym silniku?','Czy rozrusznik obraca silnik z normalną prędkością?'],search:['diagnostyka ukladu rozruchowego','diagnostyka cisnienia paliwa','diagnostyka czujnika polozenia walu']},
 {id:'misfire',label:'Spalanie / wypadanie zapłonu',words:['wypadanie zaplonu','szarpie','nierowna praca','drgania silnika','misfire'],dtcs:['P0300','P0301','P0302','P0303','P0304','P0305','P0306'],hypothesis:'Wypadanie zapłonu może wynikać z zapłonu, dawki paliwa, kompresji lub nieszczelności dolotu.',tests:['Zapisz liczniki wypadania zapłonu i warunki freeze frame.','Porównaj komponent między cylindrami, jeśli konstrukcja i procedura na to pozwala.','Sprawdź korekty paliwowe, szczelność dolotu i kompresję według wyniku pierwszych testów.'],questions:['Czy objaw występuje stale, pod obciążeniem czy tylko po zimnym rozruchu?'],search:['diagnostyka wypadania zaplonu','pomiar kompresji','diagnostyka ukladu zaplonowego']},
 {id:'can',label:'Komunikacja CAN / LIN',words:['can','lin','brak komunikacji','komunikacja ze sterownikiem','magistrala'],dtcs:['U0001','U0100','U0121','U0140'],dtcPrefix:'U',hypothesis:'Zakłócenie komunikacji może wynikać z braku zasilania sterownika, zwarcia magistrali albo usterki węzła.',tests:['Zapisz pełną topologię błędów przed kasowaniem.','Sprawdź zasilania, masy i spadki napięcia podejrzanego sterownika.','Zmierz rezystancję oraz przebiegi magistrali w odpowiednich warunkach.'],questions:['Czy brak komunikacji dotyczy jednego sterownika czy wielu?','Czy usterka pojawiła się po naprawie, rozładowaniu akumulatora lub zalaniu?'],search:['diagnostyka can','diagnostyka komunikacji','oscyloskop can']},
 {id:'cooling',label:'Układ chłodzenia',words:['przegrzewa','temperatura silnika','ubywa plynu','brak ogrzewania','wentylator chlodnicy','termostat'],dtcs:['P0115','P0116','P0117','P0118','P0128','P0217'],hypothesis:'Problem może dotyczyć szczelności, obiegu cieczy, termostatu, czujnika temperatury lub sterowania wentylatorami.',tests:['Wykonaj próbę szczelności i sprawdź rzeczywistą temperaturę względem odczytu sterownika.','Sprawdź obieg cieczy, pracę termostatu i ogrzewanie kabiny.','Wykonaj test wentylatorów i ich sterowania.'],questions:['Czy płyn ubywa i czy widać ślady wycieku?','Czy temperatura rośnie w ruchu, na postoju czy w obu warunkach?'],search:['diagnostyka ukladu chlodzenia','test szczelnosci ukladu chlodzenia','diagnostyka wentylatora']},
 {id:'brakes',label:'ABS / układ hamulcowy',words:['abs','esp','hamulec','hamulce','kontrolka abs','czujnik predkosci kola'],dtcs:[],dtcPrefix:'C',hypothesis:'Wymagana jest kontrola kodów podwozia, sygnałów prędkości kół oraz stanu instalacji i elementów mechanicznych.',tests:['Porównaj prędkości wszystkich kół podczas kontrolowanej próby.','Sprawdź czujnik, pierścień, łożysko i wiązkę wskazanego koła.','Oceń stan mechaniczny hamulców i poziom płynu.'],questions:['Czy kontrolka zapala się od razu, czy dopiero po ruszeniu?'],search:['diagnostyka abs','diagnostyka czujnika predkosci kola','uklad hamulcowy']},
 {id:'charging',label:'Zasilanie i ładowanie',words:['akumulator','ladowanie','alternator','rozladowuje','gasna kontrolki','niskie napiecie'],dtcs:['P0562','P0563'],hypothesis:'Napięcie instalacji może być niestabilne wskutek stanu akumulatora, połączeń, poboru spoczynkowego lub układu ładowania.',tests:['Wykonaj test akumulatora oraz pomiar napięcia pod obciążeniem.','Zmierz spadki napięcia przewodu dodatniego i masy.','Sprawdź prąd ładowania, tętnienia i pobór spoczynkowy zgodnie z objawem.'],questions:['Po jakim czasie postoju pojawia się problem?'],search:['diagnostyka ukladu ladowania','diagnostyka akumulatora','pomiar poboru pradu']}
]

const dtcCodes=value=>[...new Set(String(value||'').toUpperCase().match(/[PBCU][0-9A-F]{4}/g)||[])]
const includesPhrase=(text,phrase)=>fold(text).includes(fold(phrase))

function matchedRules(text,codes){
 return RULES.map(rule=>{
   const wordHits=rule.words.filter(word=>includesPhrase(text,word))
   const codeHits=codes.filter(code=>rule.dtcs.includes(code)||(rule.dtcPrefix&&code.startsWith(rule.dtcPrefix)))
   return{...rule,wordHits,codeHits,score:wordHits.length*2+codeHits.length*4}
 }).filter(rule=>rule.score>0).sort((a,b)=>b.score-a.score)
}

function rankCatalog(text,rules,rows){
 const query=diagnosticTokens([text,...rules.flatMap(rule=>rule.search)].join(' '))
 return (rows||[]).map(row=>{
   const hay=fold([row.group,row.job?.name,row.job?.scope,row.variant?.name,row.variant?.customer_description,row.variant?.technical_description].join(' '))
   let score=query.reduce((sum,token)=>sum+(hay.includes(token)?(fold(row.job?.name).includes(token)?4:1):0),0)
   for(const rule of rules)if(rule.search.some(term=>includesPhrase(hay,term)))score+=8
   return{...row,score}
 }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||String(a.job?.name).localeCompare(String(b.job?.name),'pl')).slice(0,6)
}

export function analyzeDiagnostic({order={},diagnostic={},symptoms='',knowledge={results:[],hints:[]},catalog=[]}={}){
 const text=[order.complaint,order.title,symptoms,diagnostic.symptom_confirmed,diagnostic.dtcs,diagnostic.measurements].filter(Boolean).join('\n')
 const codes=dtcCodes([diagnostic.dtcs,symptoms].join(' ')),rules=matchedRules(text,codes),primary=rules[0]
 const suggestions=rankCatalog(text,rules,catalog)
 const similarCases=(knowledge.results||[]).slice(0,4)
 const evidenceCount=(codes.length?1:0)+(rules.length?1:0)+(String(diagnostic.measurements||'').trim()?1:0)+(similarCases.length?1:0)
 const confidence=evidenceCount>=3?'ŚREDNIA':evidenceCount>=1?'WSTĘPNA':'NISKA'
 const hypotheses=rules.slice(0,3).map(rule=>({id:rule.id,title:rule.label,text:rule.hypothesis,evidence:[...rule.codeHits,...rule.wordHits]}))
 if(!hypotheses.length)hypotheses.push({id:'general',title:'Diagnoza ogólna',text:'Za mało danych, aby zawęzić obszar. Zacznij od potwierdzenia objawu, pełnego autoskanu i podstawowych parametrów.',evidence:[]})
 const checklist=[...new Set(rules.slice(0,3).flatMap(rule=>rule.tests).concat(knowledge.hints||[]))].slice(0,10)
 if(!checklist.length)checklist.push('Potwierdź objaw i warunki jego występowania.','Wykonaj pełny autoscan przed kasowaniem błędów.','Zapisz wartości rzeczywiste powiązane z objawem i wykonaj test rozstrzygający.')
 return{
   mode:'offline-workshop-intelligence',confidence,codes,
   summary:primary?`${primary.label}: ${primary.hypothesis}`:'Brak jednoznacznego obszaru. Uzupełnij objaw, DTC lub wyniki pomiarów.',
   hypotheses,checklist,
   questions:[...new Set(rules.slice(0,3).flatMap(rule=>rule.questions))].slice(0,6),
   suggestions:suggestions.map(row=>({group:row.group,workId:row.job.id,variantId:row.variant.id,name:row.job.name,variant:row.variant.name,scope:row.variant.customer_description||row.job.scope||'',score:row.score})),
   similarCases,
   basis:{rules:rules.length,dtcs:codes.length,measurements:Boolean(String(diagnostic.measurements||'').trim()),cases:similarCases.length}
 }
}
