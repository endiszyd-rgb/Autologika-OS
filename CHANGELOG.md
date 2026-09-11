# Changelog

## 1.0.7 — 2026-09-11

### Poprawki

- Informacje o aktualizacji są wyświetlane jako czytelny tekst zamiast surowych znaczników HTML.
- Wyszukiwanie kodów korzysta z trzech baz: UPCitemDB, upc.dev i Open Products Facts.
- Awaria zewnętrznej bazy nie blokuje dodania części; formularz ręczny otwiera się z już wpisanym kodem.
- Każde zapytanie internetowe ma limit czasu, dzięki czemu skanowanie nie zawiesza interfejsu.

## 1.0.6 — 2026-09-11

### Nowości

- Własny magazyn części z obsługą kodów EAN, UPC i GTIN ze skanera Zebra oraz wyszukiwaniem nieznanych produktów online.
- Wydawanie części z magazynu bezpośrednio do aktywnego zlecenia z automatycznym kosztem i ceną sprzedaży.
- Terminarz ostrzega o kolizjach wizyt i wymaga świadomego potwierdzenia nakładającego się terminu.

### Poprawki

- Usunięcie pozycji zlecenia powiązanej z magazynem automatycznie zwraca wydaną ilość na stan.
- Powiązanie pozycji zlecenia z kartą magazynową jest zachowywane podczas synchronizacji między urządzeniami.
- Przed migracją bazy do schematu `4` aplikacja automatycznie tworzy kopię bezpieczeństwa.

## 1.0.4 — 2026-09-10

### Nowości

- Skaner Zebra działa globalnie niezależnie od aktualnie otwartej zakładki.
- Poprawny skan VIN lub AZTEC automatycznie otwiera Szybkie przyjęcie i uzupełnia dane klienta oraz pojazdu.

### Poprawki

- Długi ciąg AZTEC nie pozostaje już wpisany w aktywnym polu formularza.
- Nierozpoznany skan jest zachowywany diagnostycznie i pokazuje czytelny komunikat bez niszczenia wpisanych danych.

## 1.0.3 — 2026-09-10

### Poprawki

- Adres publicznego repozytorium aktualizacji `endiszyd-rgb/Autologika-OS` jest zapisany bezpośrednio w module aktualizatora.
- Aplikacja nie zależy już od usuwanej podczas pakowania sekcji `build.publish` i jawnie konfiguruje źródło GitHub Releases.

## 1.0.2 — 2026-09-10

### Poprawki

- Autofill z kodu AZTEC dopasowuje markę i model z dowodu rejestracyjnego do wartości katalogowych niezależnie od wielkości liter i znaków diakrytycznych.
- Marki i modele spoza katalogu pozostają widoczne jako dane wpisane ręcznie.

## 1.0.1 — 2026-09-10

### Nowości

- Nowe logo AutoLogika jako ikona programu, znak w menu oraz animowany ekran startowy.
- Dekoder kodów AZTEC z polskich dowodów rejestracyjnych dla skanerów Zebra USB HID i CoreScanner/SNAPI.
- Automatyczne uzupełnianie rejestracji, VIN-u, marki, modelu, roku, silnika, mocy oraz danych posiadacza w Szybkim przyjęciu.
- Edycja i bezpieczne usuwanie klientów, pojazdów oraz aktywnych i archiwalnych zleceń.

### Poprawki

- Powiązano płatności, rentowność, akceptacje, checklistę wydania i zamknięcie zlecenia.
- Dodano kaskadowy wybór prac i procedur oraz tworzenie własnych pozycji naprawy.
- Rozbudowano Terminarz i obsługę wizyt przechodzących przez północ.

## 1.0.0 — 2026-09-09

### Nowości

- Pierwsza instalowalna wersja Autologika OS dla Windows 10/11 x64.
- Instalator NSIS, stała tożsamość `pl.autologika.os` i aktualizacje przez GitHub Releases.
- Widok **Ustawienia → Aktualizacje** z kanałem stabilnym i beta, informacją o wersji, postępem pobierania oraz release notes.
- Połączone etapy zlecenia: wycena z akceptacją, płatność z wynikiem oraz QC z wydaniem.
- Katalog 618 wariantów prac, szablony procedur, Vehicle Intelligence i dokumentacja techniczna.

### Poprawki

- Naprawiono atomowe zamykanie zlecenia i automatyczną checklistę wydania.
- Zwiększono kontrast oraz czytelność zakładek i formularzy.
- Utwardzono dopasowanie akceptacji kosztorysu do konkretnego zlecenia i wersji wyceny.

### Dane / migracje

- Dane pozostają w trwałym katalogu Electron `userData`, poza katalogiem instalacyjnym.
- Wprowadzono wersję schematu SQLite oraz idempotentną migrację schematu `1`.
- Przed migracją istniejącej bazy i przed instalacją aktualizacji powstaje backup wraz z manifestem JSON.

## Historia rozwoju przed 1.0.0

Wersje `0.20.x–0.40.3` były wydaniami developerskimi uruchamianymi z kodu źródłowego. Wprowadziły między innymi tryb offline, synchronizację Supabase, radar warsztatu, Workflow, katalog pojazdów, wyceny, procedury, płatności, archiwum zleceń oraz moduł dokumentacji technicznej.
