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
