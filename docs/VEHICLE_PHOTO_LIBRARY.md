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
