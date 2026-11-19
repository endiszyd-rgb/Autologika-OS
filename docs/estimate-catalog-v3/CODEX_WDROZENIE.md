# AutoLogika OS — zadanie dla Codex (katalog wycen v2)
Data: 2026-11-11. Repo: `endiszyd-rgb/Autologika-OS`.

## CEL
Zintegrować z istniejącą AutoLogika OS katalog **źródeł cen rynkowych**, a nie przepisać cudze ceny do własnego cennika. Zastąpić bezwarunkową prezentację domyślnych `price` i `hours` w istniejącym `src/work-catalog.js` transparentną wyceną z rozróżnieniem: dane rynkowe, czas z dokumentacji, szacunek mechanika, historia warsztatu, cenę dla klienta.

## ISTNIEJĄCY KOD (zweryfikowane)
- `src/work-catalog.js`: `BASE_WORK_CATALOG` z polami `name`, `variants`, `hours`, `price`, `scope` oraz importami katalogów rozszerzeń.
- `src/work-procedures.js`: `procedureFor(job,variant)` i listy części, materiałów, kroków oraz QC.
- `scripts/audit-work-catalog.mjs`: skrypt sprawdzający unikalność ID, brak cen/czasów/procedur i powtarzane opisy.
- `package.json`: `npm run test:catalog`, `npm test`, `npm run build`; Electron+Vite+React oraz leżący lokalnie SQLite i synchronizacja Supabase.
Nie zakładaj żadnych innych nazw tabel, komponentów ani endpointów. Najpierw zbadaj aktualny stan repo i migracje.

## ARTEFAKTY DO IMPORTU
- `katalog_napraw_rynek_2026_v2.csv` oraz `.json`: **96 niezależnych obserwacji** dla **81 kodów operacji**. Mogą się powtarzać te same kody — to referencje cen od różnych źródeł, a nie duplikaty napraw. Nie scalać ich przez przypadkowe nadpisanie.
- `estimate-engine-v2.mjs`: prototyp kalkulatora wycen w groszach i minutach, nie gotowy backend. Zobacz ograniczenia poniżej.
- `test-estimate-engine-v2.mjs`: zestaw testów do uruchomienia przez `node --test`.
- `raport_danych.json` i `README_V2.md`: statystyka i zasady danych.

## KROKI — REALIZUJ ŚCIŚLE PO KOLEI
### [ ] 01 Audyt kodu
Zidentyfikuj miejsca użycia `variant.price`, `variant.hours`, `catalogRows`, tworzenia zamówień, generowania PDF, historii zmian, dostępnych ról, VAT, lokalnej bazy, sync Supabase i sposobu mapowania pojazdów. Zapisz listę plików i ryzyk do `docs/estimate-implementation-progress.md`. NIE USUWAJ katalogów i procedur.
### [ ] 02 Import cen porównawczych
Dodaj odrębne rekordy obserwacji rynku (kod operacji, warsztat/źródło, link, data sprawdzenia, cena, status VAT, zakres części, rodzaj ceny `od`/punkt/range). Import idempotentny na stabilnym kluczu (`source URL` + `operation code` + `unit` + `observation date` + oznaczenie wariantu). Oddziel obserwację od katalogu prac; nie traktuj ich jako własnych cen i nie wyświetlaj jako ceny zatwierdzonej.
### [ ] 03 Model wycen
Wycena: klient/pojazd/VIN-kod silnika/zlecenie, części z dostawcy, materiały, robocizna minutowa, stawka (netto/brutto zależnie od konfiguracji), rabaty, VAT zgodnie ze statusem firmy, typ szacunku, wersje, odrębne pozycje i historia zmian. Dodatkowe opłaty: `CORRODED_FASTENERS`, `SEIZED_BOLT`, `RESTRICTED_ACCESS`, `CUTTING_HEAT`, `THREAD_REPAIR`, `EXTRA_DISASSEMBLY`; wpisuj minutę, przyczynę, zdjęcie i identyfikator mechanika. Zaakceptuj koszt dodatkowy przed wykonaniem, z audytem akceptacji.
### [ ] 04 Unikanie podwójnej robocizny
Współdzielenie demontażu, np. tarcze+klocki, sprzęgło+dwumasa, pasek rozrządu+pompa wody. Nie sumuj bezwarunkowo pełnych operacji; odejmowanie tylko po pozytywnie zweryfikowanej regule lub wyniku licencjonowanego źródła. Reguły mają ID, zakres kompatybilności i wersję.
### [ ] 05 Frontend
W istniejącym widoku zleceń dodaj dostęp do kosztorysu z polami: pozycja robocizny, źródło czasu, przedział pewności, ceny referencyjne z datą i źródłem (tylko panel wewnętrzny), cena warsztatu, części, utrudnienia, szczegółowe rozliczenie i znacznik zgody klienta. Zachowaj działanie Windows/Android/iOS; przeanalizuj formularze/modale PWA, unikaj blokowania scrolla na telefonie.
### [ ] 06 Lokalnie i w chmurze
Przygotuj migracje do obecnie używanej bazy SQLite + Supabase według faktycznych schematów. Stabilne UUID, RLS, uprawnienia, idempotentna synchronizacja, przechowywanie zdjęć w Storage, kolejka offline oraz rozwiązywanie konfliktów zmian. Nie umieszczaj sekretów API u klienta. Zatwierdzone wersje wycen są niemodyfikowalne; poprawki przez nową rewizję.
### [ ] 07 PDF
Kosztorys PDF: klient, pojazd, zakres, części i robocizna, wariant podatkowy, cena całkowita, ważność wyceny, wyłączenia i zasady dodatkowych napraw. Nie publikuj w PDF porównawczych cen innych warsztatów, fragmentów cudzych treści ani wymyślonych norm.
### [ ] 08 Testy + wdrożenie
`node --test test-estimate-engine-v2.mjs` z pakietu. Dodaj do testów repo osobno: brutto/netto i zwolnienie VAT, brak ceny części, naprawy pakietowe, części 0 zł, brak internetu, równoczesne zmiany, zepsute zdjęcia, RLS, zatwierdzenie przez klienta, przycisk anuluj/wycofaj, ekran mobilny, PDF. Uruchom `npm run test:catalog`, `npm test`, `npm run build`; porównaj błędy sprzed i po zmianie. Aktualizuj dziennik postępu po KAŻDYM etapie.

## WYMAGANIA KRYTYCZNE
- Nigdy nie przedstawiaj danych z cennika jako normy OEM lub rzeczywistej ceny dla konkretnego VIN.
- Pole `estimated_hours` jest puste. Nie generuj godzin z ceny rynkowej ani dzielenia przez arbitralną stawkę.
- `labor_only` puste = nieustalony zakres ceny. Nie zakładaj, że jest to wyłącznie robocizna. Części wliczone w ofertę konkurenta nie oznaczają, że własne części są gratis.
- W pliku v2 inne źródła mają różną podstawę VAT; nie uśredniaj zł netto i brutto bez konwersji i oznaczenia statusu.
- Komplikacja i koszt dodatkowy wymagają akceptacji; do wyceny wstępnej można pokazać **scenariusze ryzyka**, ale nie dodawać ich do zatwierdzonej kwoty bez zgody.
- Szablon kalkulatora ma przykładowe `taxBps=2300`: w aplikacji VAT musi wynikać z konfiguracji firmy i rodzaju sprzedaży, nie z domyślnego parametru.
- Dokument z forum = anegdota i potencjalne ryzyko, nie oficjalna norma.
- Kodów operacji nie mapuj wyłącznie po podobieństwie tekstowym, potrzebna kontrola różnic zakresu (np. przód/tył, sztuka/oś, EPB).
- Zweryfikuj warunki dalszej redystrybucji zewnętrznych cenników przed rozpowszechnianiem SaaS. Przechowuj odnośniki i metadane, nie scrapuj stale stron bez zgody.

## FORMAT PROGRESS LOG
W `docs/estimate-implementation-progress.md` po każdym etapie wpisz:
- `etap / status / data / commit SHA`
- `zmienione pliki / migracje / testy (wynik)`
- `co działa / czego nie ukończono / ryzyko regresji`
- `następne zadanie`.
Nie deklaruj wdrożenia bez wykonanych testów.