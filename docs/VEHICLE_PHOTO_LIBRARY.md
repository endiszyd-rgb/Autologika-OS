# AutoLogika – zdjęcia pojazdów (PR #2)

## Status
System używa wspólnego komponentu `VehiclePhoto` w przyjęciu, terminarzu, centrum zleceń, pulpicie, hali, Kanbanie oraz wybranych profilach pojazdów. Zdjęcia ręcznie zweryfikowane znajdują się w `src/vehicle-photo-manifest.mjs`. Inne zdjęcia są wyszukiwane z Wikimedia Commons tylko w razie braku pozycji w manifeście; nie daje to gwarancji prawidłowej identyfikacji ani dostępności. **To nie jest kompletna biblioteka 171 modeli.**

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
2. Zastąpić wyszukiwanie on-demand wyłącznie zweryfikowanym manifestem. Obecny mechanizm automatyczny jest wyłącznie rozwiązaniem przejściowym.
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
