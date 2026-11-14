# Zadanie: nowy ekran „Hala na żywo” w AutoLogika OS

Załączony plik `Hala.dc.html` to **makieta** (prototyp z Claude Design). Zawiera cały layout, CSS,
animacje i logikę stanu. Użyj go jako źródła prawdy dla wyglądu — przenieś do stacku aplikacji
(Electron/React), NIE kopiuj 1:1 jako HTML.

## Jak czytać makietę
- `<helmet><style>` → globalne klasy i `@keyframes` (rise, pulse, hoist, idle, scan, sheen, ekg, ticker). Przenieś do CSS modułu / styled-components.
- Wszystko wewnątrz `<x-dc>` → JSX. Style inline zostaw inline albo wyciągnij do klas.
- `<sc-for list="{{bays}}" as="b">` → `bays.map(b => …)`; `<sc-if value="…">` → `cond && (...)`.
- `{{accent}}` → prop/CSS variable `--accent` (domyślnie `#F43F5E`, do zmiany w ustawieniach motywu).
- `renderVals()` w `<script type="text/x-dc">` → to jest model danych i handlery. Przenieś do hooka
  `useHala()` (stan: `picked`, `t` – animacja count-up przez requestAnimationFrame).

## Zakres
1. Komponent `HalaPage` z trzema sekcjami w gridzie 12 kolumn:
   - `BayMap` – 2 stanowiska, auta rysowane z profilu (SVG w pliku), podnośnik animowany, skaner na diagnostyce; klik ustawia `picked`.
   - `BayDetails` – panel prawy: opis, ring postępu, mechanik, ETA, „następne na to stanowisko”, CTA do zlecenia.
   - `NewsFeed` – ticker + lista newsów; `ActionList` – „Co wymaga Ciebie” + mini wykres „Puls dnia”.
2. Dane stanowisk pobierz z istniejącego API zleceń (status, procent, mechanik, ETA, kolejne zlecenie na stanowisko). Pola widać w obiekcie `raw[]` w makiecie.
3. Newsy: moduł `newsFeed` czytający RSS (Motofakty, Interia Motoryzacja, MotoFocus, warsztat.pl) + kursy z API NBP (`https://api.nbp.pl/api/exchangerates/rates/a/eur/`), cache 1 h, fallback offline (ostatnie pobrane). Komunikat „odświeżono HH:MM” w stopce.
4. Nagłówek: „Dzień dobry, {imię}” + linia statusu (zajęte stanowiska · najbliższy odbiór · obrót dziś).
5. Zachowaj dostępność z makiety: prawdziwe `<button>`/`<a>`, `aria-label` na ikonach, kontrast tekstu.
6. Responsywność: poniżej 900 px lewy rail się chowa, grid łamie się do 1 kolumny.

## Nie rób
- Nie dodawaj sekcji „Droga zlecenia” (świadomie usunięta).
- Nie zmieniaj palety (bordo/czerń) poza `--accent`.
- Nie używaj emoji jako ikon — tylko SVG stroke (jak w makiecie).

Zacznij od statycznego widoku na mockowych danych z makiety, pokaż mi screenshot, potem podłącz API.
