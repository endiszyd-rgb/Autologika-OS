# AutoLogika – zdjęcia pojazdów (PR #2)

## Status
System używa wspólnego komponentu `VehiclePhoto` w przyjęciu, terminarzu, centrum zleceń, pulpicie, hali, Kanbanie oraz wybranych profilach pojazdów. Zdjęcia ręcznie zweryfikowane znajdują się w `src/vehicle-photo-manifest.mjs`. Niezweryfikowane zdjęcia nie są już automatycznie wyświetlane. Brak wpisu w manifeście oznacza neutralną ikonę pojazdu. **To nie jest kompletna biblioteka 171 modeli.**

## Zasady katalogowania
- Zapisuj osobno markę, model, generację, zakres lat, plik, źródło, autora, licencję oraz URL licencji.
- Odróżniaj facelifting i nadwozie. Nie przypisuj zdjęcia tylko po marce.
- Rok zdjęcia nie musi oznaczać rocznika pojazdu. Przed wpisaniem `from` i `to` potwierdź okres danej odmiany.
- Nigdy nie traktuj źródła z ograniczeniem `NC`, `ND` lub `All rights reserved` jako materiału dopuszczonego do ponownego użycia.
- Preferuj fotografie z prawidłowym linkiem do źródła i licencji; podaj autora. W przypadku modyfikacji wymień je w atrybucji.
- Sprawdzaj źródła i licencje ponownie przed dystrybucją z wbudowanymi kopiami fotografii.
- W razie braku dopasowania aplikacja powinna pokazać ikonę, a nie zdjęcie innej generacji.

## Testowanie
`npm run test:vehicle-photos`: test reguł doboru i licencji.
`npm run audit:vehicle-photos`: liczba modeli objętych katalogiem i braki.
`npm test` i `npm run build`: regresja aplikacji przed scaleniem.

## Kolejne zadania
1. Uzupełnić fotografie dla pozostałych modeli, a następnie dla wszystkich generacji.
2. **Wykonane:** wyłączono wyszukiwanie on-demand w interfejsie. Tylko manifest zatwierdzonych zdjęć jest używany w UI.
3. Zapewnić pobieranie miniaturek po stronie serwera i ich trwały cache lub obsługę offline z kontrolą licencji.
4. Zaprojektować ekran atrybucji autorów, źródeł i licencji. W szczególności usunąć zagnieżdżone linki w klikalnych kartach pojazdów.
5. Sprawdzić wizualnie Windows, Android i iOS PWA na rzeczywistych wpisach, także offline.
6. Dodać szczegółowy raport pokrycia wszystkich roczników i generacji (obecny raport obejmuje podstawowe modele i generacje szczegółowe).

## Ręcznie zweryfikowane przykłady
- Volkswagen Golf VII po liftingu (2017–2020)
- Skoda Octavia III przed liftingiem (2012–2016)
- Ford Focus Mk3 po liftingu (2015–2018)
- Audi A4 B8 (2007–2015)
- BMW Seria 3 E46 (1998–2006)
- Toyota Corolla E210 hatchback (2019–2022)

Daty w manifestach ograniczają zastosowanie konkretnej fotografii i mogą nie pokrywać całej produkcji modelu.

## Badanie brakujących zdjęć
`node scripts/research-vehicle-photos.mjs --limit 25 --output vehicle-photo-research.json`
`node scripts/research-vehicle-photos.mjs --make Volkswagen --limit 50 --output volkswagen-research.json`
Narzędzie pobiera kandydatów z publicznego API Wikimedia Commons, ale **nie** dodaje ich do manifestu automatycznie. Każdy znaleziony plik jest oznaczony `reviewed:false`; człowiek powinien potwierdzić model, generację, nadwozie, okres produkcji, licencję i autorstwo. Raport jest plikiem roboczym, nie należy publikować go z danymi osobowymi ani traktować jako licencji.

## Kontrola jakości
W `.github/workflows/vehicle-photos.yml` skonfigurowano sprawdzenie importów, testy resolvera, audyt i kompilację Vite. Samo dodanie workflow nie jest dowodem, że testy już przeszły — sprawdź wynik GitHub Actions przed scaleniem.

## Kolejna decyzja techniczna
Zdjęcia z `Special:FilePath` wymagają łączności z Wikimedia; dotychczasowe wyświetlanie nie zapewnia działania offline. Właściwym kolejnym krokiem jest pobieranie zweryfikowanych miniaturek do lokalnego cache aplikacji i podawanie linków atrybucji w dedykowanym ekranie informacji o fotografiach, bez zagnieżdżonych odnośników w przyciskach.

## Etap 4 — stabilność i atrybucja (2026-11-11)
- Naprawiono niedopuszczalne dopasowanie licencji `CC BY-NC`. Walidator dopuszcza wyłącznie jasno wskazane licencje CC BY, CC BY-SA, CC0 oraz public domain. Konieczna pozostaje kontrola warunków konkretnego pliku.
- GitHub Actions: wcześniejszy błąd testu został poprawiony, a uruchomienia 43014912493 i 43015014280 zakończyły się sukcesem.
- W ustawieniach Windows/iOS PWA dostępna jest sekcja przypisania autorów i źródeł zdjęć (`VehiclePhotoAttributions`). Odnośniki nie są zagnieżdżane w przyciskach kart zleceń.
- `vite.config.js` rejestruje PWA Workbox CacheFirst dla obrazów Wikimedia Commons, limit 250 wpisów / 30 dni. Zdjęcie może być dostępne offline po pierwszym pobraniu w PWA, zależnie od zachowania pamięci iOS/Safari i statusu Service Workera. Nie gwarantuje to offline w aplikacji Windows/Electron.
- Zweryfikowane strony źródłowe zdjęć: Volkswagen Golf VII, Škoda Octavia III, Ford Focus Mk3 FL, Audi A4 B8, BMW E46, Toyota Corolla E210. Audyt samych źródeł nie zastępuje testów UI.
- Po dodaniu panelu licencji należy ponownie sprawdzić aktualny wynik CI, ponieważ poprzedni sukces dotyczył wcześniejszego commita.

## Etap 5 — rzeczywiste fotografie dodane do biblioteki
Dodano 7 pozycji ze sprawdzonymi stronami plików Wikimedia Commons, opisami pojazdów oraz informacjami o autorach i licencjach: Opel Astra H, Skoda Fabia II, Volkswagen Passat B6, Peugeot 308 II, Ford Fiesta (model 2017), Renault Clio IV i Renault Megane III. Każda pozycja ma datowane dopasowanie do wybranej generacji/wersji, a nie pełne pokrycie całego modelu. Katalog obejmuje obecnie **13 z 171 modeli** co najmniej jednym zdjęciem.

Źródła nowych zdjęć:
- https://commons.wikimedia.org/wiki/File:Opel_Astra_H_front.jpg
- https://commons.wikimedia.org/wiki/File:Skoda_Fabia_II_front.jpg
- https://commons.wikimedia.org/wiki/File:Volkswagen_Passat_B6-1.jpg
- https://commons.wikimedia.org/wiki/File:2014_Peugeot_308_Access_HDi_1.6_Front.jpg
- https://commons.wikimedia.org/wiki/File:Ford_Fiesta_MK7.jpg
- https://commons.wikimedia.org/wiki/File:Renault_Clio_(front_quarter)_red.JPG
- https://commons.wikimedia.org/wiki/File:Renault-Megane3.jpg

Uzupełniono testy wymagające unikatowych źródeł i kompletnych informacji o autorze/licencji oraz kontrolujące zakresy roczników. Każdy kolejny model powinien otrzymywać analogiczny rekord i testy. Zdjęcia nadal są pobierane z Wikimedia (cache po wczytaniu w PWA), nie zapisano ich binarnych plików w repozytorium.

## Etap 6 — rozszerzenie generacji i katalogu (11.11.2026)
Dodano sześć źródłowych fotografii z Wikimedia Commons po sprawdzeniu opisów i licencji na stronach plików:
- Volkswagen Golf IV (1J), hatchback, CC BY-SA 3.0, Rudolf Stricker — https://commons.wikimedia.org/wiki/File:VW_Golf_IV_front_20071205.jpg
- Volkswagen Golf V (1K), hatchback, CC BY-SA 3.0, pierwotny autor Stahlkocher (późniejsze wersje: Head) — https://commons.wikimedia.org/wiki/File:VW_golf_V.jpg
- Opel Corsa D, przed liftingiem, CC BY-SA 3.0, Rudolf Stricker — https://commons.wikimedia.org/wiki/File:Opel_Corsa_D_front_20070611.jpg
- Audi A3 8P/8PA Sportback, CC BY-SA 3.0, Bárdos Dezső (Sóhivatal) — https://commons.wikimedia.org/wiki/File:AUDI_A3.jpg
- BMW serii 5 E60 sedan, CC BY-SA 3.0, Rudolf Stricker — https://commons.wikimedia.org/wiki/File:BMW_E60_front_20080515.jpg
- Škoda Octavia II Combi, CC BY-SA 3.0, Rudolf Stricker — https://commons.wikimedia.org/wiki/File:Skoda_Octavia_front_20071001.jpg

**Stan manifestu:** 19 rekordów fotografii obejmujących 16 różnych modeli z 171 (około 9,4% podstawowych modeli). Wciąż brakuje zdjęć 155 modeli, a dla wielu istniejących modeli nie są pokryte wszystkie generacje i wersje nadwozia. Przy zdjęciach BMW E60 i Octavii Combi zapisano rzeczywisty typ nadwozia; obecny resolver nie uwzględnia nadwozia z danych pojazdu, więc w przyszłości należy rozszerzyć tę identyfikację (sedan/kombi/hatchback), zamiast obiecywać wierność konkretnej wersji klienta.

**Uwaga:** zdjęcia są linkowane przez Special:FilePath, nie zapisane jako pliki JPG w repozytorium. Weryfikacja licencji odbywała się na stronach źródłowych; ważność linków i warunki atrybucji należy ponownie sprawdzić przed redystrybucją instalatora.

## Etap 7 — kolejna partia 8 fotografii (2026-11-11)
Dodano kolejne osiem referencyjnych plików Wikimedia Commons z przypisanymi autorami, licencjami i celowo ograniczonymi rocznikami:
- VW Golf VI TSI 2008 (Golf VI, 2009–2012) — Lothar Spurzem, CC BY-SA 2.0 DE — https://commons.wikimedia.org/wiki/File:VW_Golf_VI_TSI_am_2008-10-11.jpg
- Opel Astra J po lifcie, model 2015 (2013–2015) — Nordenfan, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Opel_Astra_J_Modellpflege_Front.jpg
- Ford Focus II facelift (2008–2010) — M 93, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Ford_Focus_II_(Modellpflege,_seit_2008)_front_MJ.JPG
- Ford Focus Mk3 przed faceliftingiem (2011–2014) — Mike Peel, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Ford_Focus,_Highway_1.jpg
- BMW serii 3 E90 sedan przed liftingiem (2005–2008) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:BMW_E90_front_20070831.jpg
- Kia cee'd ED hatchback przed liftingiem (2007–2009) — Thomas doerfer, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Kia_cee%27d_Front.JPG
- Hyundai i30 GD hatchback (2012–2014) — Overlaet, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Hyundai_i30_(front).jpg
- Toyota Yaris XP130 przed liftingiem (2011–2014) — M 93, CC BY-SA 3.0 DE — https://commons.wikimedia.org/wiki/File:Toyota_Yaris_(XP130)_–_Frontansicht,_21._Juli_2012,_Heiligenhaus.jpg

**Stan:** 27 przypisań zdjęć, 19 modeli z co najmniej jedną referencyjną fotografią, 152/171 modeli bez ręcznego przypisania. Roczniki są orientacyjnymi oknami doboru zdjęć, wymagają dalszego audytu w odniesieniu do wersji nadwoziowych i liftingów; nie utożsamiaj daty wykonania fotografii z rocznikiem auta. Przykładowo E90 w manifeście to sedan, choć nazwa generacji w katalogu obejmuje także E91/E92/E93. Po dodaniu pól wersji nadwozia resolver powinien wymagać zgodności nadwozia.

**Licencje regionalne:** poprawiono walidację tak, by dopuszczała jawnie wariant `DE` (niemiecką jurysdykcję dla wybranych starszych CC BY-SA), bez błędnego dopuszczania `NC`/`ND`.

## Etap 8 — kolejne 8 modeli (11 listopada 2026)
Dodano 8 zweryfikowanych stron fotografii:
- Toyota Auris I (E150), 2007–2010, M 93, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Toyota_Auris_front.jpg
- Honda Civic IX (EU hatchback), 2012–2014, Overlaet, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Honda_Civic_(front).jpg
- Peugeot 207 hatchback, 2006–2009, M 93, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Peugeot_207_(2007)_front.jpg
- Volkswagen Polo VI facelift, 2021–2023, Saro96, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Vw-polo-front.png
- Nissan Qashqai J10, 2007–2010, M 93, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Nissan_Qashqai_front.jpg
- Fiat Panda III, 2012–2016, Overlaet, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Fiat_Panda_(2011)_front.jpg
- Renault Scenic II facelift, 2006–2009, Thomas doerfer, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Renault_Scénic_Facelift_Front.JPG
- Dacia Duster II facelift, 2021–2023, ROCostiTheBunnyCZ, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:2021_Dacia_Duster_(facelift)-_front_angle_view.jpg

**Postęp:** 35 wpisów fotografii dla 27 z 171 modeli, pozostały 144 modele bez referencji; liczby dotyczą przynajmniej jednego zdjęcia w modelu, nie pokrycia generacji/wersji nadwozia. Nowe rekordy mają `bodyType` oraz źródło/licencję. Resolver bierze pod uwagę `bodyType`, `body_type` lub `body_style`, jeżeli dane te występują. Brak danych o nadwoziu w starszych wpisach nie pozwala jeszcze odróżniać wszystkich sedanów/kombi; wymaga dalszej integracji w formularzach pojazdu i bazie.

## Etap 9 — siedem kolejnych modeli (11 listopada 2026)
Nowe, sprawdzone źródła Wikimedia Commons (autor / deklarowana licencja):
- Volkswagen Touran I 1T, 2003–2010, MPV — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:VW_Touran_front_20070926.jpg
- Mazda 3 BK, 2004–2008, hatchback — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Mazda_3_front_20070926.jpg
- Hyundai Tucson JM, 2004–2009, SUV — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Hyundai_Tucson_front_20071004.jpg
- Toyota RAV4 II po liftingu, 2003–2005, SUV — M 93, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Toyota_Rav4.2_Facelift_front.jpg
- SEAT Ibiza 6L po liftingu, 2006–2008, hatchback — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Seat_Ibiza_front_20070518.jpg
- Fiat Punto II przed liftingiem, 1999–2003, hatchback — Rudolf Stricker (zdjęcie), Typ932 (edycja kadru/kontrastu), CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Fiat_Punto_front_20071212.jpg
- Honda Accord VII Europa, 2003–2007 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Honda_Accord_front_20070928.jpg

**Stan:** 42 rekordy fotografii, 34 spośród 171 modeli posiadają przynajmniej jedno przypisanie; 137 modeli wciąż bez zdjęcia. To nie oznacza kompletnego pokrycia generacji, wersji nadwozia i rynku. Roczniki dobrano zachowawczo.

**Poprawki jakości:** Cache ID obejmuje typ nadwozia. Jeżeli karta ma podany typ nadwozia, fotografia bez takiej informacji w manifeście nie zostanie użyta. Nadal trzeba dodać pole nadwozia do trwałego modelu danych w osobnej migracji; obecny resolver odczytuje je tylko wtedy, gdy zostało dostarczone w rekordzie.

## Etap 10 — pięć nowych modeli (11.11.2026)
Wpisy z bezpośrednio sprawdzonymi stronami Commons:
- Škoda Superb II 3T, 2008–2012, liftback — M 93, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Skoda_Superb_front.JPG
- Ford Mondeo Mk3 Turnier, 2001–2006, kombi — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Ford_Mondeo_front_20071203.jpg
- Citroën C4 I, 2004–2008, hatchback — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Citroen_C4_front_20070926.jpg
- Suzuki Swift (2004), 2005–2009, hatchback — Luftfahrrad, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Suzuki_Swift_front-1.jpg
- Opel Insignia B, 2017–2019, nadwozie niezweryfikowane — Alexander Migl, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Opel_Insignia_B.jpg

**Stan po aktualizacji:** 47 fotografii / 39 różnych modeli spośród 171, czyli 132 modele bez ręcznego zdjęcia. Lata dopasowania są konserwatywne i nie oznaczają pełnych okresów produkcji. Dla Insignii nie wpisano typu nadwozia, aby nie przypisywać niezweryfikowanej wersji sedan/kombi. Testy obejmują również ten przypadek. Nadal potrzebne są kontrola wszystkich źródeł w automatycznym audycie i trwały zapis nadwozia w bazie danych, zanim uznamy pokrycie poszczególnych wersji za pełne.

## Etap 11 — siedem zweryfikowanych fotografii nowszych SUV-ów (11.11.2026)
Zapisano 7 kolejnych przypisań w `src/vehicle-photo-manifest.mjs`:
- Volkswagen Tiguan II (AD/BW), 2017–2020, Vauxford, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2017_Volkswagen_Tiguan_SE_TDi_4MOTION_2.0.jpg
- Škoda Kodiaq I, 2017–2019, KGC626, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2018_Škoda_Kodiaq_Style.jpg
- Renault Captur I po lifcie, 2017–2019, Vauxford, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2018_Renault_Captur_Iconic_TCE_900cc.jpg
- Volvo XC60 II (SPA), 2018–2020, Vauxford, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2019_Volvo_XC60_T8_Inscription_Hybrid_2.0.jpg
- Kia Sportage IV (QL) po lifcie, 2018–2020, Vauxford, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2018_Kia_Sportage_facelift_1.6.jpg
- Mazda CX-5 II (KF), 2017–2020, Vauxford, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2018_Mazda_CX-5_Sport_NAV_Diesel_Automatic_2.2.jpg
- Peugeot 3008 II, 2017–2020, Bindydad123, CC BY-SA 4.0: https://commons.wikimedia.org/wiki/File:2018_Peugeot_3008_1.6_Allure_(1).jpg

**Stan po etapie 11:** 54 wpisy fotografii dla 46 modeli spośród 171; 125 modeli bez zdjęcia referencyjnego. Zakresy lat opisują okno bezpiecznego dopasowania do zdjęć, nie wszystkie warianty produkcyjne; nie wolno uznawać tego za pełne pokrycie roczników, nadwozi ani liftingów. Testy uwzględniają różnice nadwozi i generacji. Każda fotografia jest nadal odnośnikiem do Wikimedia Commons, a nie plikiem binarnym w repozytorium.

## Etap 12 — pełny indeks, 25 kolejnych zdjęć i masowe badanie źródeł (2026-11-11)
Wdrożono:
- 3 ręcznie zweryfikowane fotografie nowych generacji: VW Golf VIII, Škoda Octavia IV, BMW Seria 3 F30 (patrz wpisy manifestu).
- 4 zdjęcia nowych modeli: BMW X3 G01, Mercedes-Benz C W205, Škoda Scala, Ford Kuga I.
- 5 zdjęć dla Audi A6 (sedan i Avant), BMW X1 F48, Dacia Sandero II i VW Caddy Maxi.
- 18 fotografii modeli z metadanych Wikimedia Commons: Audi A1, A5, A7, A8, Q2, Q3, Q5, Q7, Q8, TT; BMW X5, X6; Renault Kadjar; Fiat Doblo; Toyota Avensis; Honda CR-V; Nissan Micra, Navara.
- `src/vehicle-photo-inventory.mjs`: deterministyczny indeks **wszystkich 171 marek/modeli** z polem `status: partial|missing`, liczbą fotografii i szczegółowymi generacjami.
- W Ustawieniach: licznik pokrycia zdjęciami i wyszukiwalna lista wszystkich modeli, braków i źródeł.
- `scripts/research-all-vehicle-photos.mjs`: wyszukiwanie brakujących modeli w API Commons; wszystkie kandydatury mają `reviewStatus: unverified` i nigdy nie są automatycznie dodawane do produkcyjnego manifestu.
- `.github/workflows/vehicle-photo-research.yml`: raport kandydatów do ręcznej kontroli jako artefakt GitHub Actions (wywoływany z workflow_dispatch lub przy zmianach skryptu, bez zmian w produkcyjnym manifeście).
- `scripts/validate-vehicle-photo-sources.mjs` i `.github/workflows/vehicle-photo-source-audit.yml`: kontrola istnienia plików i zmian licencji u źródła, bez błędnego kwalifikowania limitu API jako błędnej fotografii.

**Stan po nowej partii:** 84 wpisy zdjęć / 72 modele spośród 171; pozostało 99 modeli bez zatwierdzonej referencji. Indeks jest kompletny, ale BIBLIOTEKA ZDJĘĆ NIE JEST jeszcze kompletna: pokrycie pojedynczego modelu nie oznacza wszystkich generacji/roczników/nadwozi.

**Ograniczenia pierwszej próby automatycznych badań:** raport z Actions `43031445608` przetworzył 125 brakujących wówczas modeli, ale tylko 25 miało kandydata po filtracji, a 95 zapytań zakończyło się HTTP 429 (przekroczony limit API). Poprawiono kod o pojedynczą kolejkę z odstępem i retry. Do ukończenia weryfikacji nie wystarcza samo pomyślne wykonanie Actions; potrzebna jest analiza wynikowych zdjęć i praw licencyjnych.

## Kontrola zewnętrznych źródeł — wyniki GitHub Actions
Audyt plików Wikimedia Commons uruchomiony jako `43033254809` sprawdził wszystkie 84 odwołania w manifeście bezpośrednio w API Commons. Wynik początkowy: **83 poprawne, 1 do przeglądu, 0 brakujących, 0 bez odpowiedzi**. Jedyną niezgodnością była licencja fotografii Passata B6: w manifeście `CC BY-SA 2.5`, na Commons `CC BY-SA 3.0`. Poprawiono ten wpis w commicie `532095d6`. Kolejny audyt będzie uruchamiany po zmianach manifestu; należy sprawdzić jego wynik przed ostatecznym scaleniem.

Audyt potwierdza istnienie pliku, odczyt licencji i autora — nie zastępuje wizualnej inspekcji dopasowania do generacji. Nie należy opisywać wszystkich 171 modeli jako posiadających fotografie, dopóki status `missing` nie spadnie do zera.

## Etap 13 — kolejne 17 fotografii (11 listopada 2026)
W tej partii przybyło **17 fotografii** nowych modeli i wariantów:
- Fiat Tipo II hatchback, Fiat 500 po lifcie, Fiat Ducato X250
- Honda Jazz III, Toyota Land Cruiser Prado J150
- Citroën C3 III, Peugeot 208 I po liftingu, Suzuki Vitara LY i Mercedes-Benz Klasa A W176
- Hyundai i20 GB po liftingu, Dacia Logan II MCV, Mitsubishi ASX
- SEAT Leon III hatchback i Leon ST kombi; Peugeot 508 I sedan i 508 SW kombi; Citroën Berlingo II furgon.

Źródła są w manifeście, ze wskazaniem autorów, odpowiednich licencji Creative Commons i zakresów roczników. Fotografie nadwozi kombi/sedan/hatchback są rozróżniane na podstawie jawnej deklaracji nadwozia. Kiedy dla tego samego modelu i rocznika występuje więcej niż jeden typ nadwozia, a karta samochodu nie podaje typu, resolver **nie wybiera losowej fotografii** — pokazuje neutralny symbol.

**Stan:** 101 fotografii dla 87 z 171 modeli. Pozostało **84 modele bez zweryfikowanego zdjęcia**, a również wiele generacji i wersji nadwozia już częściowo pokrytych modeli nie ma odrębnego zdjęcia.

Wykonano automatyczny audyt źródeł w GitHub Actions `43040183320`: **101/101 zdjęć ma dostępny plik, autora i licencję zgodną z manifestem; 0 brakujących / 0 wymagających przeglądu**. Audyt metadanych nie zastępuje kontroli wizualnej zgodności modelu i nadwozia.

## Etap 14 — pełne pokrycie nazw modeli (11.11.2026)
Uzupełniono **wszystkie 171 par marka/model** katalogu przynajmniej jednym rekordem referencyjnej fotografii. Łącznie **188 wpisów**, w tym osobne nadwozia dla części modeli. W ostatnich partiach uzupełniono m.in. BMW, Mercedes, dostawcze VW/Ford, Cupra, starsze Peugeot, Renault Laguna, Mazda 2/6, Hyundai, Kia, Volvo, Alfa Romeo, Mitsubishi, Subaru, Suzuki, Jeep i Land Rover.

Ważne: `171/171 modeli ze zdjęciem` **nie jest równoznaczne** z 100% zdjęć każdej generacji, roku modelowego, liftingu i nadwozia. Resolver pozostaje ostrożny i w wielu takich przypadkach pokaże symbol samochodu zamiast niewłaściwej fotografii. Wymagane nadal:
1. Pokrycie poszczególnych generacji, nadwozi, liftingów i odmian regionalnych (lista generacji w `src/vehicle-photo-inventory.mjs`).
2. Integracja wiarygodnych danych nadwozia w przyjęciu i trwałej kartotece pojazdów.
3. Sprawdzenie obrazów na prawdziwych urządzeniach Windows/iOS/Android i offline na Windows.
4. Kontrola wizualna wszystkich 188 przypisań; audyt Commons zapewnia wyłącznie istnienie pliku i metadane licencji, nie identyfikację modelu.

**Audyt licencji:** przedostatni audyt 188 fotografii wykrył 1 niezgodność licencji `Volvo V70 front 20080801.jpg` (Commons opis `Attribution`, manifest `CC BY-SA`). Ten plik został zastąpiony zgodnym CC BY-SA 4.0 zdjęciem `2002 Volvo V70 S 20V Automatic 2.4 Front.jpg` (model V70 II P2), a testy rocznika zostały zaktualizowane. Nowy audyt po tej korekcie powinien wykazać 188/188, ale wynik musi być zweryfikowany na GitHub Actions.

**PR #2 pozostaje draftem**. Ukończono podstawowy indeks zdjęć i pokrycie wszystkich nazw modeli. Dalsze etapy to zapewnienie pełnego pokrycia generacji, a nie sztuczne zwiększanie licznika 171.

### Wynik finalnego CI po poprawce (11.11.2026)
GitHub Actions `43079435743`: **40/40 testów, 0 błędów; build Vite poprawny**. Skrypt audytu podaje **171/171 modeli**, **0 brakujących modeli**, ale tylko **17 z 48 zdefiniowanych szczegółowych generacji** dopasowanych według wybranego punktu roku (audyt bada środek okresu generacji, zatem nie jest pełną statystyką każdej wersji). Zewnętrzna kontrola Wikimedia Commons `43079402058`: **188/188 plików zgodnych z licencją i obecnych**, 0 brakujących, 0 do przeglądu.

**Zakres tego ukończenia:** 100% par marka/model ma co najmniej jedno źródłowe zdjęcie; zdjęcia poszczególnych generacji (aktualnie niekompletne), wersji i nadwozi nadal wymagają dalszego kuratorowania.

## Etap 15 — identyfikacja zdjęć według generacji i rocznika (11.11.2026)
Dodano **7 dodatkowych, jednoznacznie opisanych zdjęć** generacji:
- Škoda Octavia I (1U) Combi, roczniki 1997–2009 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Skoda_Octavia_front_20071007.jpg
- BMW serii 5 F10 sedan, 2010–2016 — Renée Kools, CC BY 4.0 — https://commons.wikimedia.org/wiki/File:White_BMW_5_Series_F10_front_view.jpg
- Mercedes-Benz Klasa C W204 sedan po liftingu, 2011–2014 — M 93, CC BY-SA 3.0 DE — https://commons.wikimedia.org/wiki/File:Mercedes-Benz_C_220_CDI_BlueEFFICIENCY_Avantgarde_(W_204,_Facelift)_–_Frontansicht_(1),_17._April_2011,_Düsseldorf.jpg
- VW Passat B8 (3G) sedan, 2015–2018 — KGC626, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:VW_Passat_B8_Sedan.jpg
- VW Passat B8 (3G) Variant, 2015–2018 — Tomáš Meňuš, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Passat_B8_Variant.jpg
- Audi A4 B9 (8W), 2016–2019 — KGC626, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Audi_A4_B9.jpg
- Audi A4 B9 (8W) Avant kombi, 2016–2019 — Alexander Migl, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Audi_A4_Avant_B9_IMG_1973.jpg

**Stan:** 195 wpisów fotografii, 171/171 modeli z co najmniej jednym zdjęciem. Audyt zewnętrzny Wikimedia Commons `43082833845`: 195 poprawnych plików i metadanych licencji, 0 wymagających przeglądu i 0 brakujących. Fotografie generacji nie oznaczają pełnego pokrycia nadwozi, liftingów czy wszystkich rynków.

Poprawiono raportowanie pokrycia szczegółowych generacji: dotychczasowy audyt sprawdzał tylko środkowy rok każdej generacji. Nowy `src/vehicle-photo-inventory.mjs` i `scripts/audit-vehicle-photos.mjs` sprawdzają **każdy rok** w każdej generacji, uwzględniają dopasowanie typu nadwozia i pokazują brakujące lata. Gdy jednego modelu/roku dotyczą dwie wersje nadwoziowe, rocznik jest liczony jako pokryty, jeśli istnieje poprawna fotografia co najmniej jednego nadwozia — to nie znaczy, że są zdjęcia wszystkich wersji.

Ustawienia → Biblioteka zdjęć pojazdów: wyszukiwalna lista samochodów pokazuje teraz częściowo pokryte generacje i konkretne roczniki do uzupełnienia. Naprawiono także test z zakodowaną na stałe liczbą 188; każdy następny przyrost liczby źródeł nie powinien powodować fałszywej awarii testu.

## Etap 16 — dziewięć przypisań do konkretnych generacji (2026-11-11)
Dodano kolejne **9 fotografii** dla generacji z wcześniejszymi lukami:
- Volkswagen Tiguan I (5N) SUV, 2008–2010 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:VW_Tiguan_front_20071228.jpg
- Volkswagen Passat B7 (36) sedan, 2011–2014 — Bene Riobó, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Volkswagen_Passat_B7.jpg
- Volkswagen Passat B7 (36) Variant kombi, 2011–2014 — M 93, CC BY-SA 3.0 DE — https://commons.wikimedia.org/wiki/File:VW_Passat_Variant_(B7)_–_Frontansicht,_10._Juli_2011,_Velbert.jpg
- Audi A3 8V sedan, 2013–2016 — Tokumeigakarinoaoshima, CC0 1.0 — https://commons.wikimedia.org/wiki/File:Audi_A3_Sedan_(8V)_front.JPG
- BMW serii 3 G20/G21 (zdjęcie G20 sedan), 2019–2022 — Tokumeigakarinoaoshima, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:BMW_320i_M_Sport_(G20)_front.jpg
- Audi A3 8Y hatchback, 2020–2023 — Alexander Migl, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Audi_A3_8Y_IMG_3386.jpg
- BMW serii 5 G30/G31 (zdjęcie G30 sedan), 2017–2020 — Ivomachielse, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:BMW_G30.jpg
- Mercedes-Benz Klasa C W206 sedan, 2021–2024 — Tokumeigakarinoaoshima, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Mercedes-Benz_C_200_AVANTGARDE_(W206)_front.jpg
- SEAT Leon 1P hatchback, 2006–2009 — Thomas doerfer, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Seat_Leon_1P_1.9_TDI_Stylance_Magicoschwarz_Front.JPG

**Stan manifestu:** 204 fotografie dla 171 modeli. Wspólny resolver nadal wymaga odpowiedniej generacji, rocznika i — gdy znane — typu nadwozia. Nie należy interpretować zdjęcia sedana G20 jako pokrycia G21 Touring ani sedana G30 jako pokrycia G31.

**Do sprawdzenia:** wyniki ponownego audytu Wikimedia (204 pliki), pełna liczba generacji z pokryciem każdego roku, uruchomienie interfejsu na rzeczywistych urządzeniach. Projekt nie został scalony do `main`.

## Etap 16 — kolejna partia generacji (11.11.2026)
Wprowadzono **12 zdjęć** z ręcznie sprawdzonych stron Wikimedia Commons (marka/model/generacja/rocznik/nadwozie):
- VW Tiguan I (5N), SUV, 2008–2010 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:VW_Tiguan_front_20071228.jpg
- VW Passat B7 (36), sedan, 2011–2014 — Bene Riobó, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Volkswagen_Passat_B7.jpg
- VW Passat B7 (36), Variant, 2011–2014 — M 93, CC BY-SA 3.0 DE — https://commons.wikimedia.org/wiki/File:VW_Passat_Variant_(B7)_–_Frontansicht,_10._Juli_2011,_Velbert.jpg
- Audi A3 8V, sedan, 2013–2016 — Tokumeigakarinoaoshima, CC0 1.0 — https://commons.wikimedia.org/wiki/File:Audi_A3_Sedan_(8V)_front.JPG
- BMW Seria 3 G20, sedan, 2019–2022 — Tokumeigakarinoaoshima, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:BMW_320i_M_Sport_(G20)_front.jpg
- Audi A3 8Y, hatchback, 2020–2023 — Alexander Migl, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Audi_A3_8Y_IMG_3386.jpg
- BMW Seria 5 G30, sedan, 2017–2020 — Ivomachielse, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:BMW_G30.jpg
- Mercedes Klasa C W206, sedan, 2021–2024 — Tokumeigakarinoaoshima, CC BY-SA 4.0 — https://commons.wikimedia.org/wiki/File:Mercedes-Benz_C_200_AVANTGARDE_(W206)_front.jpg
- SEAT Leon 1P, hatchback, 2006–2009 — Thomas doerfer, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Seat_Leon_1P_1.9_TDI_Stylance_Magicoschwarz_Front.JPG
- Audi A4 B6, sedan, 2001–2004 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Audi_A4_B6_front_20071030.jpg
- Audi A4 B6, Avant kombi, 2001–2004 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Audi_A4_B6_Kombi_front_20071115.jpg
- Mercedes Klasa E W211, sedan po liftingu, 2006–2009 — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Mercedes_W211_front_20080127.jpg

Łącznie **207 przypisań fotografii, 171/171 nazw modeli w katalogu**. Nowa partia uzupełnia 10 kombinacji marka/model/generacja, ale nie wszystkie roczniki i typy nadwozi każdej generacji.

**Status w chwili zapisu:** audyty źródeł i testy po ostatnich zmianach uruchomione przez GitHub Actions, ale wykonanie w kolejce; nie wolno uznawać ich za zaliczone bez wyniku. Ostatni w pełni zaliczony audyt przed tymi 12 zdjęciami dotyczył 195 plików.

## Etap 17 — historyczne generacje VAG i naprawa CI (14.11.2026)
Dodano 7 fotografii z ręcznie potwierdzonych stron Wikimedia Commons:
- Audi A3 8L hatchback (1997–2003) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Audi_A3_front_20080326.jpg
- Volkswagen Passat B5/B5.5 (3B) sedan (1997–2000) — Rudolf Stricker, Public domain — https://commons.wikimedia.org/wiki/File:Volkswagen_Passat_B5_front_20070323.jpg
- Volkswagen Golf V (1K) hatchback (2004–2008) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:VW_Golf_V_front_20080123.jpg
- Audi A4 B7 (8E) sedan (2005–2008) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Audi_A4_B7_front_20080318.jpg
- Audi A4 B7 (8E) Avant kombi (2005–2008) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:Audi_A4_B7_Avant_front_20080111.jpg
- Volkswagen Passat B6 (3C) sedan (2005–2009) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:VW_Passat_B6_front_20070926.jpg
- Volkswagen Passat B6 (3C) Variant kombi (2005–2009) — Rudolf Stricker, CC BY-SA 3.0 — https://commons.wikimedia.org/wiki/File:VW_Passat_B6_Kombi_front_20070518.jpg

**Weryfikacja zewnętrzna:** GitHub Actions `43557264378`: 214/214 plików potwierdzonych z metadanymi autora i licencji, 0 błędów, 0 brakujących. Dla pliku Audi A3 8V ujednolicono zapis `CC0 1.0` → `CC0` zgodnie z aktualną nazwą licencji w metadanych Commons. Test poprawiono tak, by dopuszczał adres dedykacji CC0 (`/publicdomain/zero/`). Dla Passata B6 zapis bez typu nadwozia celowo nie wybiera losowo sedana ani kombi — test regresji używa jawnie `bodyType='sedan'`.

**Stan:** 214 przypisań, 171/171 modeli podstawowych. Pełne pokrycie generacji i nadwozi wciąż nieukończone. Rozszerzono workflow kontroli na commit push na gałęzi roboczej i anulowanie zbędnych wcześniejszych uruchomień CI. PR pozostaje draftem bez merge.
