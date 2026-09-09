# Autologika OS 0.31.0 — Studio

Nowy ciemny interfejs z animowanym radarem warsztatu, interaktywną listą zleceń, celem miesiąca i panelem bieżących spraw. Punkty radaru otwierają zlecenia. Animacje respektują systemową preferencję ograniczenia ruchu. Formularze, nawigacja, kosztorysy i Workflow korzystają ze wspólnego motywu.

Test interfejsu na osobnej bazie demonstracyjnej: `npm.cmd run test:ui`. Szczegóły bieżących prac: `DEVELOPMENT.md`.

Nowość: Workflow 2.0 z kontekstowym sugerowaniem kolejnego etapu i przyciskiem „Zastosuj krok”. System uwzględnia wniosek diagnostyczny, akceptacje, części, QC i płatności. Wydanie auta nadal wymaga świadomej akcji operatora.

# Autologika OS Desktop 0.20.2

Electron + React + SQLite dla Windows, offline-first, synchronizowany rekordowo z aplikacją Autologika Android przez Supabase.

## Hotfix 0.20.2 — Supabase
- pole Publishable key nie jest już zastępowane maską w stanie formularza; po zapisaniu pozostaje puste, a aplikacja pokazuje tylko bezpieczny skrót i długość klucza,
- wklejenie nowego pełnego `sb_publishable_...` zawsze zastępuje poprzedni klucz; puste pole zachowuje zapisany klucz,
- adres Supabase jest normalizowany — końcówki `/rest/v1`, `/auth/v1` i `/storage/v1` są usuwane automatycznie,
- aplikacja odrzuca `sb_secret_...`, żeby uprzywilejowany klucz nie trafił do klienta,
- dodano **Test połączenia** przed rejestracją/logowaniem,
- komunikaty błędów sieci pokazują endpoint i przyczynę zamiast samego `TypeError: fetch failed`,
- połączenia chmurowe używają `electron.net.fetch`, co lepiej integruje się ze stosem sieciowym Electron/Windows.


## Nowe w 0.20
- dokumentacja zdjęciowa zlecenia podzielona na PRZYJĘCIE / DIAGNOZA / NAPRAWA / WYDANIE,
- załączniki mogą obejmować zdjęcia oraz PDF,
- usunięcie załącznika jest soft-delete i synchronizuje się z Androidem,
- po synchronizacji binarny plik jest usuwany także z prywatnego Supabase Storage,
- zdalne usunięcie usuwa lokalną kopię pliku,
- automatyczny backup SQLite raz dziennie przy starcie; przechowywane jest 14 ostatnich kopii,
- nadal dostępny backup ręczny,
- poprawiono konfigurację electron-builder: katalog `documents/**/*` jest teraz dołączany do instalatora/portable,
- zachowane Auth + RLS, podpisy klienta i pełna synchronizacja danych warsztatowych z 0.19.

## Uruchomienie
Na Windows zalecany Node 22 LTS. Ze względu na natywny `better-sqlite3` po instalacji zależności może być potrzebny rebuild pod ABI Electron:
```powershell
npm.cmd install
npm.cmd run rebuild
npm.cmd run dev
```

## Build Windows
```powershell
npm.cmd run dist:win
# albo portable
npm.cmd run dist:portable
```

## Bezpieczeństwo
Do aplikacji wpisuj Supabase URL + anon/publishable key i loguj się kontem użytkownika. Nie używaj `service_role`. Bucket `order-files` powinien pozostać prywatny i korzystać z polityk RLS z `cloud_schema_supabase.sql`.

## Uwaga testowa
Kod jest wersją rozwojową. Przed użyciem danych klientów trzeba przeprowadzić test PC ↔ Cloud ↔ Android, załączników, tombstone i odtwarzania backupu.


## 0.20.2 — poprawka React effect cleanup
- Naprawiono sporadyczny błąd `destroy is not a function`.
- Efekty React nie zwracają już Promise z funkcji `load()`.
- Subskrypcja `sync:changed` zwraca cleanup tylko wtedy, gdy jest funkcją.

## 0.26.0 — baza pojazdów w Szybkim Przyjęciu
- Marka, model, rok i silnik są teraz kaskadowymi listami rozwijanymi.
- Wbudowany lokalny katalog obejmuje najczęstsze marki i modele rynku europejskiego i działa offline.
- Zmiana marki resetuje model/rok/silnik, a zmiana modelu resetuje rok/silnik — brak przypadkowych kombinacji.
- Każde pole ma opcję „Inny / wpisz ręcznie”, więc katalog nigdy nie blokuje przyjęcia auta.
- Katalog jest w osobnym pliku `src/vehicle-catalog.js`, dzięki czemu można go później podmienić na pełny import licencjonowanej bazy (np. TecDoc) bez przebudowy formularza.

Uwaga: katalog wbudowany nie jest deklarowany jako kompletna, homologacyjna baza wszystkich wariantów silnikowych. Pełna baza VIN/typ/silnik/kod silnika wymaga zewnętrznego, licencjonowanego źródła danych.

## 0.26.0 — szczegółowa identyfikacja pojazdu
Szybkie przyjęcie obsługuje teraz kaskadę: Marka → Model → Generacja → Rok → Silnik → Moc [KM] → Kod silnika. Dla popularnych platform VAG, BMW i Mercedes dostępny jest katalog szczegółowy; pozostałe modele korzystają z katalogu podstawowego i zawsze pozwalają na ręczne uzupełnienie danych. Pola generation, power_hp i engine_code są zapisywane w lokalnej bazie i synchronizowane przez istniejącą warstwę cloud sync.

## 0.26.0 — Advanced Workshop UI
- nowy ciemny system wizualny o większym kontraście i lepszej hierarchii,
- poszerzony, sekcyjny sidebar z wyraźnym aktywnym modułem,
- przyklejony nagłówek z bieżącym kontekstem i statusem bazy,
- bardziej kompaktowe i czytelne KPI, panele, tabele, formularze i statusy,
- poprawiona czytelność Workflow/Kanban, terminarza, modali i kart zleceń,
- responsywne zachowanie dla mniejszych ekranów.


## 0.26.0 — Centrum Dowodzenia
Nowy animowany pulpit: radar aktywnych zleceń, live status, szybkie akcje, animowane KPI, przepływ warsztatu, źródła klientów i aktywne timery. Animacje respektują prefers-reduced-motion.


## 0.26.0
Rozwinięte Centrum Dowodzenia: cel 50k, tempo dzienne, koszty bezpośrednie, marża brutto, panel reakcji, dynamiczny radar, stan operacyjny i kompaktowy hero.


## 0.26.0
Dodano konfigurowalny cel miesięczny w Ustawieniach. Cel zasila Centrum Dowodzenia i Finanse/KPI, ma szybkie presety 30/50/75/100/150k i synchronizuje się z Androidem przez rekord `app_settings/monthly-target`.


## 0.26.0
- Globalna paleta poleceń Ctrl+K i wyszukiwanie VIN/rejestracja/klient/telefon/kod silnika/zlecenie.
- Interaktywny radar: punkty aktywnych aut otwierają konkretne Centrum zlecenia.
- Klikalne rekordy na pulpicie prowadzą bezpośrednio do zlecenia.

## 0.26.0 — Operational Workflow
- Centrum zlecenia 2.0: panel „Następna czynność” zależny od statusu i blokady.
- Kontrola procesu: diagnoza → zakres/wycena → części → QC/wydanie.
- „Do uwagi” prowadzi bezpośrednio do zlecenia.
- Workflow: dwuklik karty otwiera Centrum zlecenia.

## 0.28.0 — Kosztorys 2.0
- kosztorys ma stan decyzji klienta,
- wysłanie do akceptacji zamraża edycję wyceny,
- tworzy rekord PENDING i ustawia zlecenie na AKCEPTACJA / DECYZJA,
- zakres można przenieść do właściwego zlecenia dopiero po APPROVED,
- decyzja jest widoczna w historii akceptacji i osi czasu.


## 0.29.0
- Tryb klienta dla kosztorysu: pełnoekranowa prezentacja pojazdu, wyniku diagnozy, pozycji i sumy.
- Akceptacja / odrzucenie bezpośrednio na ekranie klienta, zapisywane przez istniejący rejestr approvals.
- Pole uwag klienta i status decyzji.

## 0.30.0 — zdalna akceptacja
Dodano generowanie bezpiecznego linku do kosztorysu przez Supabase Edge Function, publiczny mobilny widok klienta, decyzję APPROVED/DECLINED z notatką i import decyzji do lokalnego Workflow. Konfiguracja: `REMOTE_APPROVAL_SETUP.md`.

## 0.31.0 — decyzje klienta LIVE
- automatyczne sprawdzanie zdalnych decyzji podczas każdej synchronizacji chmurowej,
- natywne powiadomienie Windows oraz toast w Autologika OS po akceptacji/odrzuceniu,
- kliknięcie powiadomienia prowadzi do właściwego zlecenia,
- decyzja trafia automatycznie do `approvals`, osi czasu i Workflow,
- zaakceptowany kosztorys jest automatycznie materializowany: robocizna trafia do zlecenia, części powstają jako `DO_ZAMOWIENIA`, materiały jako pozycje zlecenia,
- jeśli zaakceptowany zakres zawiera części, zlecenie przechodzi w oczekiwanie `CZESCI`; jeśli nie — do `NAPRAWA`,
- `Do uwagi` pokazuje decyzje klienta wymagające dalszej reakcji,
- ręczne „Sprawdź decyzję” korzysta z tego samego automatu i pozostaje jako awaryjna kontrola.

Uwaga: automatyczna zdalna decyzja działa po wdrożeniu `customer_approval_links` i Edge Function opisanych w `REMOTE_APPROVAL_SETUP.md`. Powiadomienie Windows wymaga uruchomionej aplikacji; portal klienta działa niezależnie w Supabase.
