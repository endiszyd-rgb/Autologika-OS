# Audyt stabilizacji AutoLogika OS — 2026-09-30

## Stan wydania

Audyt nie wykazał otwartych problemów klasy CRITICAL ani HIGH w sprawdzonych przepływach. Testy obejmują warstwę SQLite i migracje, IPC, logikę zleceń i wycen, synchronizację, zdalne akceptacje, PDF, katalog prac oraz 33 przepływy interfejsu uruchomione w Electronie.

## Naprawione

### MEDIUM — elementy dostępne wyłącznie myszą

Wiersze zleceń, klientów i pojazdów, karta części, punkt dokumentacji technicznej, komunikat zdalnej akceptacji oraz kafel „Do uwagi” nie miały pełnej obsługi klawiatury. Każdy element otrzymał rolę, kolejność fokusu i aktywację klawiszami Enter/Spacja. Powierzchnia służąca do wskazania współrzędnych na diagramie została jawnie oznaczona jako powierzchnia wskaźnikowa.

Audyt połączeń UI został rozszerzony o kontrolę klikalnych elementów nienatywnych. Kolejna taka regresja zatrzyma `npm test`.

### MEDIUM — zapis części bez stanu oczekiwania i komunikatu błędu

Formularz dodawania części do zamówień pozwalał ponownie kliknąć zapis w trakcie wywołania IPC, a błąd zapisu nie był pokazywany użytkownikowi. Przycisk blokuje się teraz podczas operacji, pokazuje stan „Dodawanie…” i pozostawia formularz otwarty z czytelnym błędem, jeśli zapis się nie powiedzie.

## Otwarte obserwacje

### MEDIUM — rozmiar pakietu startowego (naprawione)

Terminarz, dokumentacja techniczna, magazyn, import dokumentu dostawy, Autologika Care, Ustawienia, Workshop LIVE, Workflow, Szablony prac, Szybkie przyjęcie, ekrany diagnostyczne oraz ekrany Finanse/KPI, Dokumenty i Pracownicy są teraz ładowane dopiero po otwarciu odpowiedniego ekranu. Kod wejściowy aplikacji zmniejszył się z około 718 kB do 219 kB. Łączny JavaScript wymagany na starcie wraz z osobnymi, cache'owanymi modułami React i katalogów wynosi około 548 kB / 161,6 kB gzip, czyli o 23,7% mniej przed kompresją i 22,5% mniej po kompresji względem stanu początkowego. Style startowe zmniejszyły się z około 281 kB do 242 kB.

Środowisko React, katalog pojazdów i katalog prac mają osobne stabilne pliki, dzięki czemu zmiana ekranu nie unieważnia ich cache. Żaden plik wynikowy nie przekracza 500 kB i Vite nie zgłasza już ostrzeżenia o dużym fragmencie. Dalszy podział `main.jsx` pozostaje korzystny dla utrzymania kodu, ale blokada wydajnościowa kompilacji została usunięta.

### MEDIUM — monolityczny renderer

`src/main.jsx` nadal zawiera routing oraz większość ekranów biznesowych. Utrudnia to izolowane testy i zwiększa zakres skutków zmian. Nieużywane implementacje `LegacyOrders`, `LegacyOrderDetail`, starego pulpitu, terminarza i cennika zostały usunięte po potwierdzeniu braku odwołań. Zalecane jest dalsze przenoszenie ekranów do osobnych plików bez zmiany kontraktów IPC.

### LOW — natywne okna potwierdzeń

Ustawienia nie używają już blokujących okien `alert` przy błędach serwera mobilnego, synchronizacji, logowania i zapisu. Komunikat pojawia się w aplikacji jako przyklejony, dostępny status, który można zamknąć bez przerywania pracy. Część pozostałych operacji nadal używa `window.confirm` i `window.alert`; należy zastępować je wspólnym modalem przy okazji pracy nad konkretnym ekranem.

### LOW — ciche błędy procesów okresowych

Odświeżanie licznika uwag i okresowy odczyt stanu synchronizacji ignorują pojedyncze błędy, aby nie przerywać pracy offline. Stan synchronizacji zachowuje ostatni błąd, lecz licznik uwag nie sygnalizuje chwilowego problemu. Warto dodać dyskretny stan „dane mogą być nieaktualne”, bez modalnego komunikatu.

## Spójność logiki

- Zlecenia: kolejność gotowości, zamknięcie, ponowne otwarcie, edycja cen i blokada zapisu zamkniętego zlecenia są objęte testami.
- Wyceny i akceptacje: zakres jest przypisany dokładnie do zlecenia i wersji wyceny; migawki zaakceptowanych danych są niemutowalne.
- Części: wydanie i zwrot magazynowy, numery OE, edycja cen oraz usunięcie pozycji są objęte testami.
- Synchronizacja: kolejka offline, ponowienia, konflikty, stronicowanie, usunięcia zdalne i powiązanie konta są objęte testami.
- Dokumenty/PDF: lokalne archiwum, integralność PDF, bezpieczne ścieżki i ciągłość archiwum po zmianie numeru rejestracyjnego są objęte testami.
- Migracje: aktualizacja pustej i starszej bazy do schematu 15 tworzy kopię bezpieczeństwa i zachowuje wymagane kolumny.

## UX/UI, animacje i wydajność

- Wszystkie kontrolowane ekrany renderują się bez poziomego przepełnienia w widoku zwykłym i kompaktowym.
- Radar pulpitu i Workshop LIVE otwiera właściwe zlecenie.
- Globalny skaner AZTEC i EAN kieruje dane do właściwego przepływu.
- Style zawierają wspólny fokus klawiatury i obsługę `prefers-reduced-motion`.
- Kod wejściowy aplikacji ma 219 kB, żaden plik JavaScript nie przekracza progu 500 kB, a rzadziej używane ekrany są pobierane na żądanie.

## Weryfikacja

- `npm test` — testy CJS, MJS oraz audyt połączeń UI.
- `npm run test:catalog` — 48 grup, 473 prace i 1599 wariantów bez błędów integralności.
- `npm run test:migration` — migracja do schematu 15 i kopie bezpieczeństwa.
- `npm run test:protocol` — generowanie protokołu w Electronie.
- `npm run test:ui` — 33 przepływy UI, brak błędów renderera.
- `npm audit --omit=dev --audit-level=high` — brak znanych podatności zależności produkcyjnych.

## Zalecana kolejność dalszych prac

1. Podział `main.jsx` na ekrany bez zmiany zachowania.
2. Ładowanie rzadziej używanych ekranów na żądanie i pomiar pakietu startowego.
3. Zastępowanie natywnych potwierdzeń wspólnym modalem wraz ze stanem oczekiwania i błędu.
4. Dodanie kontrolowanego komunikatu o nieaktualnym liczniku uwag podczas błędu odświeżenia.
5. Ponowny pełny smoke test PC oraz test instalacyjny Androida przed następnym release.
