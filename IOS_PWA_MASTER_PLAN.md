# AutoLogika OS — iOS PWA Master Plan

Aktualizacja: 2026-11-03. Branch roboczy: `feature/ios-pwa`.

## Stan wejściowy

- Desktop: React 18 + Vite 6 + Electron 34, lokalna SQLite i preload `window.autologika`.
- Android: osobny projekt Expo/React Native 0.31.0, lokalna SQLite, ten sam kontrakt `sync_records`, Supabase Auth i prywatny bucket `order-files`.
- Chmura: pojedyncza tabela `sync_records` z RLS `workshop_id = auth.uid()` oraz prywatne pliki; klient używa tylko anon/publishable key i tokenu użytkownika.
- Web/PWA przed pracą: brak manifestu, Service Workera, instalacji, ekranu offline i adaptera przeglądarkowego. Bez preloadu Electron renderer kończyłby się błędem już przy `window.autologika`.
- Routing: wewnętrzny stan React, bez routera URL. Moduły są ładowane leniwie, ale korzystają ze wspólnego API preloadu.
- Natywne zależności: SQLite, system plików/dialogi, druk PDF, aktualizator Electron, schowek, otwieranie folderów, skaner Zebra i lokalna Ollama. Na iOS wymagają adapterów albo jawnego, bezpiecznego odpowiednika webowego.
- Hosting produkcyjny nie jest skonfigurowany w repozytorium. Publikacja i produkcyjne sekrety są poza zakresem bez osobnej zgody.

## Decyzje architektoniczne

1. Nie powstaje druga aplikacja ani drugi backend. Ten sam renderer React wybiera adapter Electron lub PWA.
2. PWA komunikuje się bezpośrednio z istniejącym Supabase przez Auth/REST/Storage i respektuje obecne RLS.
3. Dane klientów i zleceń nie trafiają do cache Service Workera. Cache obejmuje wyłącznie zasoby aplikacji.
4. Mutacje używają stabilnych `cloud_id`, upsertu i świadomego ponowienia; nie ma automatycznego replay zapisu po odzyskaniu sieci.
5. Funkcje niedostępne w Safari nie mogą powodować czarnego ekranu. Adapter pokazuje czytelne ograniczenie lub używa wyboru pliku, Web Share, druku przeglądarki i aparatu przez `input capture`.
6. Aktualizacja PWA jest wyświetlana użytkownikowi i nie przeładowuje aplikacji automatycznie w trakcie edycji.

## Etapy

- [x] Analiza repozytorium, platform, kontraktu chmury, RLS i funkcji natywnych.
- [x] Fundament PWA: plugin Vite 2.0.0, manifest, ikony, Apple metadata, Service Worker i kontrolowany update prompt.
- [x] Warstwa platformowa Electron/PWA i ekran logowania Supabase bez sekretów serwerowych.
- [x] Odczyt i bezpieczne zapisy encji przez istniejące `sync_records`, stabilne mapowanie UUID na ID UI i kontrola konfliktu przed zapisem/usunięciem.
- [x] Zdjęcia/załączniki z aparatu lub biblioteki oraz prywatny Supabase Storage (kod gotowy; prawdziwy iPhone i HEIC wymagają testu urządzenia).
- [x] Zastępstwa iOS dla PDF/drukowania, Web Share/pobierania, linków, telefonu/SMS i schowka.
- [x] Stan sieci, ekran offline, ochrona formularzy i odświeżenie po odzyskaniu połączenia.
- [x] Adaptacja iPhone: safe-area, dynamic viewport, klawiatura bez zoomu, dotyk, modal i brak globalnego overflow. Terminarz ma dotykową edycję czasu jako zamiennik niespójnego HTML5 drag-and-drop na iOS.
- [x] Walidacja manifestu, rejestracji SW, bezpieczeństwa cache i obu stanów startowych (brak konfiguracji / logowanie).
- [x] Regresja Vite/Electron oraz dostępne testy Android bez modyfikacji jego logiki.
- [x] Dokumentacja wdrożenia HTTPS z Windows i checklista testu na prawdziwym iPhonie w `PWA_DEPLOYMENT.md`.

## Powiadomienia Web Push

- [ ] Backend subskrypcji, klucze VAPID i wysyłka nie istnieją w aktualnym projekcie. Etap wymaga osobnej konfiguracji i zgody; nie dodano pozornej funkcji.

## Wyniki testów

- `npm run test:pwa`: PASS — build Vite/PWA, manifest, ikony, statyczny precache bez danych Supabase oraz rejestracja SW w przeglądarce 430 × 932.
- Browser smoke bez konfiguracji: PASS — czytelny ekran konfiguracji, brak fatal error i brak poziomego overflow.
- Browser smoke z bezpieczną przykładową konfiguracją publiczną: PASS — ekran logowania, brak fatal error i rejestracja SW.
- `npm test`: PASS — 233 testy CJS + 79 testów MJS oraz audyt 462 przycisków, 234 metod API, 262 kanałów IPC i 23 ekranów menu.
- Android `npm test`: PASS — 116/116.
- Android `npm run check:source`: PASS — 43 pliki JavaScript/JSX.
- Android Expo export: PASS po czystym `npm ci` — 822 moduły, bundle Hermes Android 2,9 MB. Pierwsza próba ujawniła niekompletny lokalny `node_modules`, nie błąd źródeł.
- `npm run dist`: PASS — instalator NSIS `release/Autologika-Setup-1.1.1.exe` (113 252 576 B) i blockmap. Paczka nie jest podpisana certyfikatem producenta.
- `git diff --check`: PASS — brak błędów whitespace; Git zgłasza wyłącznie informacyjne ostrzeżenia o konwersji LF/CRLF.
- `npm audit --omit=dev`: 0 podatności produkcyjnych. Audyt pełnego toolchainu wykazuje istniejące podatności dev/build wymagające osobnego, potencjalnie breaking upgrade Electron/Vite.

## Ograniczenia wymagające testu urządzenia

- instalacja z Safari i zachowanie w trybie standalone;
- aparat, HEIC/HEIF, biblioteka zdjęć i Web Share;
- klawiatura i Visual Viewport na iPhone 16 Plus;
- druk/podgląd PDF;
- gesty oraz terminarz dotykowy;
- Web Push z zainstalowanej aplikacji ekranu głównego.

## Świadome ograniczenia adaptera PWA

- Transakcyjne wydanie/rezerwacja/zwrot stanu magazynowego pozostają operacją desktopową do czasu dodania bezpiecznej funkcji RPC w Supabase. Bez takiej transakcji bezpośredni zapis z PWA mógłby rozjechać stan przy pracy wielu urządzeń.
- Zebra USB HID, lokalna Ollama, lokalny OCR dokumentów, kopia pliku SQLite i foldery Windows mają jawny komunikat zamiast awarii.
- Zdalne linki akceptacji wymagają osobnej tabeli i wdrożonej Edge Function; adapter nie deklaruje ich jako działających bez testu z prawdziwą konfiguracją.
- Nie wykonano testu z produkcyjnym kontem Supabase, ponieważ wymagałby sekretów/uprzywilejowanego dostępu użytkownika. Nie zmieniono schematu ani danych chmury.

