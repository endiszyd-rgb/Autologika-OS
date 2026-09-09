# Stan prac — 2026-09-08

Wzmocniono obsługę kosztorysów w wersji 0.31.0:

- Akceptacja dotyczy dokładnego numeru kosztorysu i zlecenia (nr 1 nie pasuje do nr 10).
- Zapis i usunięcie pozycji są blokowane w backendzie po wysłaniu do akceptacji, również po odrzuceniu.
- Ponowne wysłanie zwraca istniejącą akceptację; pusty kosztorys nie może zostać wysłany.
- Zdalne przenoszenie zakresu sprawdza zgodność zlecenia kosztorysu i akceptacji.
- Formularz pokazuje błędy zapisu, usuwania i wysyłania.
- Zaktualizowano instrukcję automatycznego pobierania decyzji.

Weryfikacja: `npm.cmd test` (Node 22.13+; tymczasowa baza SQLite, bez danych użytkownika), `npm.cmd run build`, kontrola składni plików Electron.
Zależności Electron i better-sqlite3 są zainstalowane i przebudowane dla desktopu (`npm.cmd rebuild electron better-sqlite3`, `npm.cmd run rebuild`).

Do kolejnego etapu: test całego przepływu Desktop ↔ Supabase ↔ Android. Zdalne decyzje nadal są wyszukiwane przez `approval_local_id`; trzeba zaprojektować migrację na identyfikatory chmurowe przed obsługą wielu niezależnych baz desktopowych. Nie przeprowadzono testu działającej usługi Supabase ani instalatora Windows.

## Przebudowa interfejsu — Autologika Studio

Preferencja użytkownika: bardzo ciemna kolorystyka, animacje i zachowanie radaru na pulpicie.

- Nowy pulpit w `src/dashboard.jsx`: animowany radar otwierający zlecenia, łuk celu miesięcznego, KPI, filtrowanie ostatnich zleceń, przepływ etapów, blokady, terminarz, źródła klientów i aktywne timery.
- Wspólny motyw w `src/studio.css`: prawie czarny grafit, subtelny zielony akcent, spójne formularze, modale, tabele, nawigacja i Workflow. Importowany po dotychczasowych stylach, które nadal zawierają układy pozostałych modułów.
- Lokalne ikony SVG w `src/ui.jsx`, bez dodatkowych zależności ani połączeń sieciowych.
- Animacje skanowania, punktów radaru, liczników, aktywnej pracy i wejścia widoku respektują `prefers-reduced-motion`.
- Wskaźnik efektywnej godziny czeka na co najmniej minutę zarejestrowanego czasu, aby świeży timer nie generował mylących wartości.

Walidacja: kompilacja Vite, 4 testy kosztorysów oraz uruchomienie prawdziwego renderera Electron na izolowanej bazie demonstracyjnej. Sprawdzono szerokości 1500 i 1100 px (bez poziomego przepełnienia), filtr diagnozy, otwieranie zlecenia z radaru, przyjęcie, Workflow, wyszukiwanie i pusty pulpit. Bez błędów renderera.

`npm.cmd run test:ui` odtwarza test i zapisuje zrzuty w `artifacts/ui/`. Skrypt `scripts/ui-preview.cjs` używa nowego profilu w katalogu tymczasowym; nie otwiera danych ani konfiguracji chmury użytkownika. Zrzuty zawierają wyłącznie dane demonstracyjne. Profile testowe pozostają w katalogu tymczasowym do ewentualnego debugowania.

Uruchomienie gotowego interfejsu: `npm.cmd start`. Rozwój z odświeżaniem: `npm.cmd run dev`.

## Centrum zlecenia — kolejny etap Studio

- Nowa karta pojazdu, podsumowanie wartości, pozostałej płatności i czasu pracy.
- Jeden panel „Następny krok” oparty na dotychczasowych regułach procesu. Ręczna zmiana statusu i oczekiwania pozostaje w rozwijanej sekcji.
- Menu dokumentów PDF oraz boczna nawigacja w trzech grupach; przejście do zakładki przewija do jej treści. Główne moduły otwierają się od góry strony.
- Nowy przegląd: zgłoszenie, diagnoza, stan realizacji, szybkie akcje, oczekujące części i ostatnie zdarzenia. Części odebrane nie są przedstawiane jako oczekujące na dostawę.
- Naprawione puste zakładki `payment`, `reminders` i `closeout`: podłączono istniejące komponenty do danych zlecenia.
- Usunięto ponowne montowanie całego Centrum po każdym zapisie. Zapis i odświeżenie zachowują wybraną zakładkę i zlecenie.
- Nowe komponenty i style: `src/order-workspace.jsx` oraz `src/order-workspace.css`.

Rozszerzony test Electron sprawdza wszystkie 13 zakładek poza przeglądem, zapis diagnozy, zapis płatności oraz przełączenie na inne zlecenie i zapis bez powrotu do poprzedniego. Wszystkie operacje testowe wykonuje w osobnej bazie demonstracyjnej.
