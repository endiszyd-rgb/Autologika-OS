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
