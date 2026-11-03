# AutoLogika OS PWA — wdrożenie i instalacja na iPhone

## Co jest potrzebne

PWA jest statycznym buildem istniejącego renderera AutoLogika. Nie wymaga App Store, IPA ani komputera Mac. Musi być udostępniona przez **HTTPS**. Repozytorium nie zawiera obecnie skonfigurowanego hostingu, dlatego ta zmiana niczego samodzielnie nie publikuje.

PWA korzysta z istniejącego Supabase i tabeli `sync_records`. Użytkownik loguje się przez Supabase Auth; RLS ogranicza rekordy do `workshop_id = auth.uid()`. W przeglądarce wolno użyć wyłącznie publicznego klucza anon/publishable.

## Build na Windows

1. Skopiuj `.env.pwa.example` jako `.env.production.local`.
2. Uzupełnij `VITE_SUPABASE_URL` i publiczny `VITE_SUPABASE_ANON_KEY` (lub zmień nazwę na `VITE_SUPABASE_PUBLISHABLE_KEY`).
3. Nie wpisuj `service_role`, `sb_secret_…`, haseł ani tokenów użytkownika.
4. Uruchom:

```powershell
npm ci
npm run test:pwa
```

Gotowe pliki znajdują się w `dist`. Opublikuj **zawartość** tego katalogu na istniejącym hostingu statycznym z HTTPS. Serwer powinien:

- zwracać `index.html` dla wejścia na katalog aplikacji;
- podawać `manifest.webmanifest` jako `application/manifest+json`;
- podawać `sw.js` bez długiego, niezmiennego cache (`Cache-Control: no-cache`);
- nie przepisywać żądań do Supabase przez własny publiczny proxy;
- wymuszać HTTPS.

Build ma relatywną bazę `./`, więc może działać w katalogu domeny. Przed produkcją sprawdź adres testowy; nie publikuj danych warsztatu ani plików `.env`.

## Instalacja na iPhone

1. Otwórz adres HTTPS w **Safari**.
2. Zaloguj się do tego samego konta AutoLogika Cloud co na PC/Androidzie.
3. Dotknij **Udostępnij** (kwadrat ze strzałką).
4. Wybierz **Dodaj do ekranu początkowego** / **Do ekranu początkowego** (nazwa zależy od wersji iOS).
5. Potwierdź nazwę `AutoLogika` i wybierz **Dodaj**.
6. Uruchamiaj aplikację z nowej ikony, nie z karty Safari.

## Aktualizacje

Po opublikowaniu nowego builda Service Worker pobierze zasoby w tle. AutoLogika pokaże komunikat „Dostępna jest nowa wersja”. Przeładowanie następuje dopiero po świadomym wybraniu **Aktualizuj** i jest blokowane, gdy formularz zawiera niezapisane zmiany.

## Offline i bezpieczeństwo

- Offline buforowana jest tylko powłoka oraz statyczne zasoby aplikacji.
- Pełna baza klientów i zleceń nie jest zapisywana w cache Service Workera.
- Otwarty formularz pozostaje w pamięci widoku, a zamknięcie karty z niezapisanymi zmianami wyświetla ostrzeżenie.
- Zapisy nie są automatycznie ponawiane po powrocie sieci, aby nie tworzyć duplikatów.
- Po odzyskaniu połączenia wykonywane jest świeże pobranie danych.

## Funkcje zależne od platformy

Na iOS działają: klienci, pojazdy, zlecenia, terminarz, diagnoza i notatki, części zsynchronizowane z chmurą, płatności, QC, zdjęcia/załączniki z aparatu lub biblioteki, prywatny Storage, druk widoku oraz udostępnianie pliku obsługiwane przez Safari.

Lokalna SQLite, backup pliku DB, foldery Windows, aktualizator EXE, Zebra USB HID, lokalna Ollama, lokalne OCR i transakcyjne operacje magazynowe wymagające desktopowej bazy mają jawny komunikat zamiast awarii. Zdalne linki akceptacji wymagają istniejącej Edge Function i nie są deklarowane jako gotowe w PWA bez osobnej weryfikacji.

Web Push na zainstalowanych PWA iOS jest możliwy, ale obecny backend nie ma bezpiecznego rejestru subskrypcji ani funkcji wysyłającej. Nie dodano pozornego przycisku: ten etap wymaga osobnej konfiguracji backendu, kluczy VAPID i testu na urządzeniu.

## Diagnostyka

- **Ekran konfiguracji zamiast logowania:** zmienne Vite nie były dostępne podczas `npm run build`.
- **Brak instalacji:** sprawdź HTTPS, otwarcie w Safari oraz poprawność manifestu i `sw.js`.
- **401 / sesja wygasła:** wyloguj i zaloguj się ponownie.
- **403:** sprawdź RLS oraz czy rekordy należą do UID zalogowanego warsztatu.
- **Zdjęcie się nie otwiera:** sprawdź prywatny bucket `order-files` i ścieżkę zaczynającą się od UID użytkownika.
- **Stara wersja:** zamknij formularz, wybierz aktualizację, a w razie potrzeby zamknij aplikację z przełącznika i uruchom ponownie.

## Checklista prawdziwego iPhone'a

Do wykonania na iPhone 16 Plus (nie zastępuje jej emulator): instalacja i uruchomienie standalone, safe-area, klawiatura bez zoomu, długie formularze i modale, terminarz dotykowy, zdjęcie HEIC oraz JPEG, biblioteka zdjęć, pobranie i Web Share dokumentu, druk do PDF, utrata/odzyskanie sieci, ostrzeżenie niezapisanego formularza i aktualizacja oczekująca.
