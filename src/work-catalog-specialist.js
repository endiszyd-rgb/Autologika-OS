const additions=[
 ['Serwis okresowy i eksploatacja',['Przegląd rozszerzony po dużym przebiegu','Kontrola filtrów i odpowietrzeń układów','Kasowanie inspekcji i weryfikacja interwału']],
 ['Układ hamulcowy',['Diagnostyka nierównej siły hamowania','Serwis prowadnic i jarzm zacisku','Pomiar temperatur hamulców po jeździe próbnej']],
 ['Zawieszenie i układ kierowniczy',['Diagnostyka luzów pod obciążeniem','Wymiana tulei wahacza','Kontrola przekładni kierowniczej i drążków']],
 ['Piasty, łożyska i półosie',['Pomiar bicia piasty koła','Diagnostyka przegubu wewnętrznego półosi','Wymiana uszczelniacza półosi']],
 ['Rozrząd i osprzęt silnika',['Kontrola synchronizacji wału i wałka','Diagnostyka zmiennych faz rozrządu','Wymiana koła pasowego wału korbowego']],
 ['Silnik – uszczelnienia i osprzęt',['Lokalizacja wycieku metodą UV','Wymiana uszczelniacza wału korbowego','Kontrola odmy i ciśnienia skrzyni korbowej']],
 ['Silnik – głowica i remont',['Pomiar płaskości głowicy i bloku','Kontrola luzów zaworowych','Diagnostyka poboru oleju przez silnik']],
 ['Układ chłodzenia',['Test obecności CO2 w płynie chłodzącym','Diagnostyka obiegu nagrzewnicy','Wymiana obudowy termostatu']],
 ['Dolot, turbo i doładowanie',['Próba szczelności dolotu dymem','Pomiar sterowania geometrią turbiny','Czyszczenie intercoolera i przewodów']],
 ['Paliwo – benzyna',['Pomiar wydajności pompy paliwa','Diagnostyka wtryskiwacza benzynowego','Czyszczenie układu wtryskowego']],
 ['Paliwo – Diesel / Common Rail',['Próba przelewowa wtryskiwaczy','Pomiar wydajności pompy wstępnej','Kodowanie wtryskiwaczy Common Rail']],
 ['EGR, DPF/GPF i emisje spalin',['Pomiar ciśnienia różnicowego DPF','Test drogowy regeneracji DPF','Diagnostyka czujnika NOx']],
 ['Wydech',['Lokalizacja nieszczelności układu wydechowego','Wymiana łącznika elastycznego wydechu','Kontrola mocowań i osłon termicznych']],
 ['Sprzęgło i skrzynia manualna',['Pomiar skoku i punktu pracy sprzęgła','Wymiana wysprzęglika hydraulicznego','Diagnostyka hałasu skrzyni manualnej']],
 ['Skrzynie automatyczne / DSG',['Pomiar poziomu i temperatury oleju skrzyni','Adaptacja sprzęgieł DSG','Diagnostyka szarpania skrzyni automatycznej']],
 ['Napęd 4x4 / wały / mosty',['Serwis sprzęgła Haldex','Pomiar luzu wału napędowego','Diagnostyka hałasu mostu napędowego']],
 ['Rozrusznik, alternator i ładowanie',['Test tętnień alternatora','Pomiar poboru prądu rozrusznika','Wymiana regulatora napięcia alternatora']],
 ['Diagnostyka komputerowa i pomiarowa',['Analiza ramek zamrożonych błędów','Pomiar magistrali CAN oscyloskopem','Rejestracja parametrów podczas jazdy próbnej']],
 ['Kodowanie, adaptacje i programowanie',['Adaptacja przepustnicy i biegu jałowego','Kodowanie akumulatora po wymianie','Kopia konfiguracji sterownika przed programowaniem']],
 ['ECU / TCU i performance',['Logi dynamiczne silnika pod obciążeniem','Pomiar AFR i korekt paliwowych','Weryfikacja zabezpieczeń termicznych programu']],
 ['Układ zapłonowy i sterowanie silnikiem',['Pomiar przebiegu cewki zapłonowej','Diagnostyka wypadania zapłonów','Kontrola świec pod kątem spalania']],
 ['Podciśnienie i sterowanie pneumatyczne',['Pomiar wydajności pompy podciśnienia','Test szczelności przewodów podciśnienia','Diagnostyka siłownika pneumatycznego']],
 ['Elektryka nadwozia i komfort',['Lokalizacja zwarcia w instalacji','Naprawa wiązki drzwi lub klapy','Diagnostyka centralnego zamka']],
 ['SRS / systemy bezpieczeństwa',['Pomiar instalacji czujnika zderzenia','Diagnostyka maty zajęcia fotela','Kalibracja czujnika przyspieszeń SRS']],
 ['ADAS i czujniki wspomagania',['Kalibracja kamery przedniej statyczna','Kalibracja radaru po naprawie','Diagnostyka systemu martwego pola']],
 ['Klimatyzacja – diagnostyka pomocnicza',['Pomiar ciśnień dynamicznych klimatyzacji','Diagnostyka zaworu sterującego sprężarki','Kontrola pracy wentylatorów skraplacza']],
 ['Układ wycieraczek i spryskiwaczy',['Naprawa mechanizmu wycieraczek','Diagnostyka pompy spryskiwacza','Udrożnienie dysz i przewodów spryskiwaczy']],
 ['Układ paliwowy / zbiornik – ogólne',['Test szczelności układu EVAP dymem','Wymiana pochłaniacza par paliwa','Diagnostyka odpowietrzenia zbiornika']],
 ['Pomiary i przygotowanie do geometrii',['Pomiar kątów geometrii przed regulacją','Kontrola punktów regulacyjnych zawieszenia','Pomiar przesunięcia osi i śladowości']],
 ['Kontrola przed zakupem / inspekcje',['Inspekcja podwozia kamerą i dokumentacja','Diagnostyka komputerowa wszystkich sterowników','Jazda próbna z oceną układu napędowego']],
 ['Hybrydy i pojazdy elektryczne – diagnostyka',['Pomiar rezystancji izolacji układu HV','Analiza kondycji baterii trakcyjnej','Diagnostyka układu ładowania AC/DC']],
 ['Czynności końcowe i kontrola jakości',['Kontrola momentów dokręcenia po naprawie','Test funkcjonalny systemów powiązanych','Dokumentacja zdjęciowa wykonanej naprawy']],
 ['Mocowania silnika i skrzyni',['Pomiar przemieszczenia zespołu napędowego','Wymiana poduszki hydraulicznej silnika','Adaptacja aktywnego mocowania silnika']],
 ['Napęd paskiem osprzętu',['Pomiar linii prowadzenia paska','Wymiana napinacza paska osprzętu','Diagnostyka drgań paska osprzętu']],
 ['Układ olejowy silnika',['Pomiar ciśnienia oleju manometrem','Płukanie smoka i miski olejowej','Diagnostyka zużycia oleju na podstawie próbki']],
 ['Układ dolotowy i podciśnienie',['Czyszczenie kolektora dolotowego','Test szczelności kolektora dymem','Adaptacja klap kolektora dolotowego']],
 ['Pomiary mechaniczne silnika',['Pomiar kompresji cylindrów','Próba olejowa cylindrów','Pomiar podciśnienia w kolektorze']],
 ['PPF, folie ochronne i stylizacja',['Naprawa krawędzi folii PPF','Demontaż starej folii ochronnej','Aplikacja folii na element wewnętrzny']],
 ['Nadwozie, blacharstwo i elementy zewnętrzne',['Pomiar szczelin elementów nadwozia','Naprawa mocowania zderzaka','Wymiana wzmocnienia pasa przedniego']],
 ['Przygotowanie i prace około-blacharskie',['Zabezpieczenie instalacji przed spawaniem','Demontaż wnętrza do naprawy blacharskiej','Kontrola instalacji po naprawie nadwozia']],
 ['Koła, opony i TPMS',['Pomiar głębokości i nierówności bieżnika','Programowanie kompletu czujników TPMS','Diagnostyka ściągania pojazdu przez opony']],
 ['Klimatyzacja i komfort termiczny',['Płukanie układu klimatyzacji','Wymiana parownika klimatyzacji','Diagnostyka klap mieszania powietrza']],
 ['Szyby, lusterka i uszczelnienia',['Regulacja szyby bezramkowej','Naprawa podnośnika szyby','Udrożnienie odpływów szyberdachu']],
 ['Instalacje LPG i CNG',['Pomiar wydajności wtryskiwaczy LPG','Regeneracja reduktora LPG','Diagnostyka przełączania benzyna–gaz']],
 ['Multimedia, wnętrze i wyposażenie komfortu',['Diagnostyka komunikacji jednostki multimedialnej','Naprawa instalacji kamery cofania','Kodowanie funkcji wyposażenia komfortu']],
 ['Akcesoria, zabudowy i doposażenie',['Montaż modułu monitorowania akumulatora','Naprawa instalacji dodatkowego oświetlenia','Przegląd mocowań zabudowy pojazdu']],
 ['Ochrona nadwozia, detailing i konserwacja',['Pomiar grubości powłoki lakierniczej','Konserwacja profili zamkniętych','Czyszczenie i zabezpieczenie podwozia']],
 ['Pojazdy hybrydowe i elektryczne – serwis HV',['Serwis układu chłodzenia baterii HV','Wymiana grzałki wysokonapięciowej','Kontrola złączy i przewodów ładowania']]
]

const variantsFor=name=>{
 const value=name.toLowerCase()
 if(/diagnost|pomiar|test|analiz|kontrol|lokaliz|inspek|weryfik|próba|logi|rejestrac/.test(value))return ['kontrola podstawowa','pełny pomiar i dokumentacja','usterka okresowa','kontrola po naprawie']
 if(/wymiana|naprawa|serwis|regeneracja|czyszczenie|płukanie|konserwacja|montaż|demontaż/.test(value))return ['zakres podstawowy','zakres rozszerzony','utrudniony dostęp','z kontrolą elementów współpracujących']
 return ['wariant standardowy','wariant rozszerzony','z diagnostyką wstępną','z testem końcowym']
}

const specialistJob=(group,name,index)=>({
 name,variants:variantsFor(name),hours:/(?:diagnost|pomiar|test|kontrol|analiz)/i.test(name)?1.3:2.0,price:/(?:diagnost|pomiar|test|kontrol|analiz)/i.test(name)?290:440,
 scope:`Wykonanie usługi „${name}” w obszarze „${group}”. Zakres obejmuje potwierdzenie stanu początkowego, bezpieczne przygotowanie stanowiska, realizację właściwych czynności oraz zapis wyników. Po zakończeniu wykonywana jest kontrola elementów współpracujących, test funkcjonalny i opis dalszych zaleceń dla klienta.`,catalog_extension:`specialist-${index+1}`
})

export const CATALOG_SPECIALIST_ADDITIONS=Object.fromEntries(additions.map(([group,names])=>[group,names]))

export function expandCatalogSpecialists(groups){
 return groups.map(group=>{
  const names=CATALOG_SPECIALIST_ADDITIONS[group.group]||[]
  const jobs=names.filter(name=>!group.jobs.some(job=>job.name===name)).map((name,index)=>specialistJob(group.group,name,index))
  return jobs.length?{...group,jobs:[...group.jobs,...jobs]}:group
 })
}
