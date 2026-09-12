const rows=[
 ['Serwis okresowy i eksploatacja','Diagnostyka stanu płynów i materiałów eksploatacyjnych'],
 ['Układ hamulcowy','Pomiar bicia tarcz i piast'],
 ['Zawieszenie i układ kierowniczy','Diagnostyka czujnika kąta skrętu'],
 ['Piasty, łożyska i półosie','Diagnostyka łożyska koła i piasty'],
 ['Rozrząd i osprzęt silnika','Diagnostyka napinacza i rolek osprzętu'],
 ['Silnik – uszczelnienia i osprzęt','Diagnostyka wycieku oleju silnikowego'],
 ['Silnik – głowica i remont','Próba szczelności cylindrów'],
 ['Układ chłodzenia','Diagnostyka czujnika temperatury cieczy'],
 ['Dolot, turbo i doładowanie','Diagnostyka czujnika ciśnienia doładowania'],
 ['Paliwo – benzyna','Diagnostyka regulatora ciśnienia paliwa'],
 ['Paliwo – Diesel / Common Rail','Diagnostyka czujnika ciśnienia paliwa rail'],
 ['EGR, DPF/GPF i emisje spalin','Diagnostyka czujnika różnicy ciśnień'],
 ['Wydech','Pomiar przeciwciśnienia układu wydechowego'],
 ['Sprzęgło i skrzynia manualna','Diagnostyka hydrauliki sprzęgła'],
 ['Skrzynie automatyczne / DSG','Diagnostyka mechatroniki skrzyni'],
 ['Napęd 4x4 / wały / mosty','Diagnostyka drgań układu napędowego'],
 ['Rozrusznik, alternator i ładowanie','Pomiar spadków napięcia układu rozruchu'],
 ['Diagnostyka komputerowa i pomiarowa','Diagnostyka oscyloskopowa czujników położenia'],
 ['Kodowanie, adaptacje i programowanie','Weryfikacja po kodowaniu i adaptacji'],
 ['ECU / TCU i performance','Diagnostyka spalania stukowego i korekt zapłonu'],
 ['Układ zapłonowy i sterowanie silnikiem','Diagnostyka czujnika wału i wałka rozrządu'],
 ['Podciśnienie i sterowanie pneumatyczne','Diagnostyka elektrozaworu podciśnienia'],
 ['Elektryka nadwozia i komfort','Diagnostyka poboru prądu po uśpieniu'],
 ['SRS / systemy bezpieczeństwa','Diagnostyka napinacza pasa bezpieczeństwa'],
 ['ADAS i czujniki wspomagania','Kontrola ustawienia radaru i pola widzenia kamery'],
 ['Klimatyzacja – diagnostyka pomocnicza','Diagnostyka czujnika ciśnienia klimatyzacji'],
 ['Układ wycieraczek i spryskiwaczy','Diagnostyka czujnika deszczu i sterowania wycieraczek'],
 ['Układ paliwowy / zbiornik – ogólne','Diagnostyka czujnika poziomu paliwa i EVAP'],
 ['Pomiary i przygotowanie do geometrii','Pomiar wysokości nadwozia i punktów bazowych'],
 ['Kontrola przed zakupem / inspekcje','Pomiar grubości lakieru i ocena napraw nadwozia'],
 ['Hybrydy i pojazdy elektryczne – diagnostyka','Diagnostyka przetwornicy DC/DC'],
 ['Czynności końcowe i kontrola jakości','Rozszerzona jazda próbna po naprawie'],
 ['Mocowania silnika i skrzyni','Diagnostyka drgań mocowań zespołu napędowego'],
 ['Napęd paskiem osprzętu','Diagnostyka sprzęgła jednokierunkowego alternatora'],
 ['Układ olejowy silnika','Diagnostyka zaworu regulacji ciśnienia oleju'],
 ['Układ dolotowy i podciśnienie','Diagnostyka klap kolektora dolotowego'],
 ['Pomiary mechaniczne silnika','Test względnej kompresji metodą prądową'],
 ['PPF, folie ochronne i stylizacja','Inspekcja powłoki i kwalifikacja pod folię PPF'],
 ['Nadwozie, blacharstwo i elementy zewnętrzne','Diagnostyka czujnika parkowania po naprawie nadwozia'],
 ['Przygotowanie i prace około-blacharskie','Pomiar geometrii punktów mocowania nadwozia'],
 ['Koła, opony i TPMS','Diagnostyka nieszczelności zaworu i czujnika TPMS'],
 ['Klimatyzacja i komfort termiczny','Diagnostyka czujników temperatury i jakości powietrza'],
 ['Szyby, lusterka i uszczelnienia','Diagnostyka ogrzewania szyby i lusterek'],
 ['Instalacje LPG i CNG','Diagnostyka czujnika ciśnienia i temperatury gazu'],
 ['Multimedia, wnętrze i wyposażenie komfortu','Diagnostyka czujników parkowania i kamery cofania'],
 ['Akcesoria, zabudowy i doposażenie','Diagnostyka modułu haka i instalacji przyczepy'],
 ['Ochrona nadwozia, detailing i konserwacja','Inspekcja lakieru i powłoki ochronnej'],
 ['Pojazdy hybrydowe i elektryczne – serwis HV','Diagnostyka czujników temperatury układu HV']
]

export const CATALOG_DIAGNOSTIC_ADDITIONS=Object.fromEntries(rows.map(([group,name])=>[group,{name}]))

const diagnosticJob=name=>({
 name,
 variants:['kontrola podstawowa','pomiary i parametry bieżące','diagnostyka instalacji i sygnału','test potwierdzający usterkę'],
 hours:1.2,
 price:260,
 scope:`Potwierdzenie zgłoszonego objawu i wykonanie usługi „${name}” metodą pomiarową. Zakres obejmuje oględziny, odczyt błędów i parametrów, kontrolę zasilania lub warunków pracy oraz test elementów współpracujących. Wyniki, warunki pomiaru i dalsze zalecenia są zapisywane w zleceniu przed wymianą części.`
})

export function expandCatalogDiagnostics(groups){
 return groups.map(group=>{const addition=CATALOG_DIAGNOSTIC_ADDITIONS[group.group];if(!addition||group.jobs.some(job=>job.name===addition.name))return group;return {...group,jobs:[...group.jobs,diagnosticJob(addition.name)]}})
}
