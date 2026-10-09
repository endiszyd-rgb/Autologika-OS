# Autologika OS

Aplikacja desktopowa do prowadzenia warsztatu samochodowego na Windows 10/11 x64. Łączy przyjęcie pojazdu, diagnozę, kosztorys, naprawę i wydanie auta w jednym obiegu zlecenia. Podstawowe dane są przechowywane lokalnie w SQLite; synchronizacja przez Supabase jest opcjonalna.

[Pobierz aplikację](https://github.com/endiszyd-rgb/Autologika-OS/releases) · [Historia zmian](CHANGELOG.md) · [Instrukcja wydawania wersji](RELEASE_GUIDE.md)

## Co oferuje aplikacja

- **Centrum zlecenia i Workflow** — zgłoszenie klienta, diagnoza, zakres naprawy, akceptacje, części, czas pracy, kontrola jakości, rozliczenie i wydanie. Panel następnego kroku pomaga prowadzić zlecenie przez kolejne etapy.
- **Workshop LIVE** — pulpit z radarem aktywnych zleceń, bieżącymi sprawami, timerami i wskaźnikami warsztatu.
- **Klienci i pojazdy** — szybkie przyjęcie, historia pojazdu, katalog marek i wariantów silnikowych oraz możliwość ręcznego uzupełnienia danych.
- **Kosztorysy i katalog prac** — wyszukiwanie prac i wariantów, edycja opisów, czasu oraz ceny. Pozycje zlecenia zachowują kopię danych katalogowych, więc późniejsze zmiany cennika nie zmieniają historycznej wyceny.
- **Decyzje klienta** — prezentacja kosztorysu w trybie klienta oraz, po konfiguracji Supabase i portalu, zdalna akceptacja zakresu naprawy.
- **Części i magazyn** — zamówienia, dostawcy, stany magazynowe, kody kreskowe oraz import dokumentów dostawy z OCR.
- **Dokumentacja warsztatowa** — zdjęcia i załączniki z etapów naprawy, protokoły PDF, biblioteka dokumentacji technicznej i wyszukiwanie źródeł internetowych.
- **Terminarz i finanse** — planowanie pracy, rejestrowanie czasu, płatności i wskaźniki finansowe z konfigurowalnym celem miesięcznym.
- **Skaner VIN / AZTEC** — obsługa USB HID i danych Zebra CoreScanner/SNAPI oraz dekodowanie polskiego dowodu rejestracyjnego do formularza przyjęcia.
- **Kopie zapasowe i aktualizacje** — backup ręczny i dzienny SQLite, kopie przed migracją oraz aktualizacje dystrybuowane przez GitHub Releases.

Praca na lokalnych danych nie wymaga skonfigurowanej chmury. Synchronizacja, zdalne decyzje klienta i wyszukiwanie dokumentacji w internecie wymagają połączenia z siecią. Wbudowany katalog pojazdów pozwala też wpisywać dane ręcznie i nie zastępuje pełnej, licencjonowanej bazy VIN.

## Instalacja na Windows

1. Otwórz [GitHub Releases](https://github.com/endiszyd-rgb/Autologika-OS/releases) i wybierz wydanie.
2. Pobierz instalator `Autologika-Setup-<wersja>.exe`, jeśli jest dostępny w załącznikach wydania.
3. Uruchom instalator i otwórz Autologika OS ze skrótu.
4. W Ustawieniach skonfiguruj warsztat oraz sprawdź lokalizację danych i kopii zapasowych. Połączenie z Supabase ustaw tylko wtedy, gdy potrzebujesz funkcji chmurowych.

Numer wersji kodu znajduje się w [package.json](package.json); dostępne wydania i instalatory są publikowane w Releases.

## Uruchomienie ze źródeł

Wymagania: Windows, Git i Node.js 22 LTS z npm. Projekt używa natywnego modułu `better-sqlite3`; jego przebudowa wymaga środowiska kompilacji dla Windows, jeśli nie jest dostępny gotowy plik binarny.

```powershell
git clone https://github.com/endiszyd-rgb/Autologika-OS.git
cd Autologika-OS
npm.cmd ci
npm.cmd run rebuild
npm.cmd run dev
```

Interfejs uruchamia Vite, a aplikację desktopową Electron. Aby uruchomić lokalny build:

```powershell
npm.cmd run build
npm.cmd start
```

## Testy i budowanie instalatora

```powershell
npm.cmd test
npm.cmd run dist
```

Artefakty instalatora powstają w katalogu `release/`. Polecenie `dist` buduje lokalnie; publikację wersji opisuje [RELEASE_GUIDE.md](RELEASE_GUIDE.md).

| Polecenie | Zakres |
| --- | --- |
| `npm.cmd run test:catalog` | Spójność katalogu prac i procedur |
| `npm.cmd run test:connections` | Audyt połączeń interfejsu |
| `npm.cmd run test:migration` | Test migracji SQLite w Electron |
| `npm.cmd run test:ui` | Test interfejsu na osobnej bazie demonstracyjnej |
| `npm.cmd run test:protocol` | Weryfikacja protokołów PDF |
| `npm.cmd run dist:portable` | Budowanie wersji portable |

Test aktualizacji z zachowaniem danych opisuje [RELEASE_TEST.md](RELEASE_TEST.md).

## Dane i kopie zapasowe

Dane warsztatu znajdują się poza katalogiem instalacyjnym, w katalogu Electron `userData`, standardowo `%APPDATA%\autologika-os`. Dokładną ścieżkę pokazuje **Ustawienia → Dane i backup**.

- `autologika.db` — lokalna baza SQLite.
- `attachments/` — zdjęcia i załączniki zleceń.
- `technical-manuals/` — lokalne zasoby dokumentacji technicznej.
- `backups/` — kopie dzienne oraz kopie związane z migracjami i aktualizacjami.

Aplikacja tworzy dzienną kopię bazy przy starcie i zachowuje 14 ostatnich kopii automatycznych. Kopia samego pliku SQLite nie obejmuje wszystkich załączników: do zabezpieczenia pełnych danych skopiuj cały katalog danych po zamknięciu aplikacji. Procedurę odzyskiwania opisuje [RELEASE_GUIDE.md](RELEASE_GUIDE.md#7-odzyskiwanie-danych).

## Supabase i zdalna akceptacja

Warstwa chmurowa obsługuje synchronizację danych warsztatowych z aplikacją Autologika Android. Konfiguracja wymaga własnego projektu Supabase, schematu bazy, polityk RLS i konta użytkownika.

- Schemat synchronizacji: [cloud_schema_supabase.sql](cloud_schema_supabase.sql).
- Zdalne akceptacje, Edge Function i portal klienta: [REMOTE_APPROVAL_SETUP.md](REMOTE_APPROVAL_SETUP.md).
- W aplikacji desktopowej używaj URL projektu oraz klucza anon/publishable. Klucze `service_role` i `sb_secret_...` nie są przeznaczone do klienta desktopowego.
- Bucket `order-files` powinien pozostać prywatny i korzystać z polityk RLS.

Przed wdrożeniem synchronizacji w warsztacie sprawdź obieg Desktop ↔ Supabase ↔ Android, załączniki, usuwanie danych oraz odtwarzanie kopii zapasowych na danych testowych.

## Struktura projektu

| Katalog / plik | Przeznaczenie |
| --- | --- |
| `src/` | Interfejs React, moduły warsztatu i katalogi |
| `electron/` | Proces główny, SQLite i integracje desktopowe |
| `supabase/` | Migracje i funkcje chmurowe |
| `docs/` | Portal zdalnej akceptacji klienta |
| `documents/` | Zasoby dokumentów dołączane do aplikacji |
| `scripts/`, `tests/` | Audyty, testy i narzędzia weryfikacji |
| `.github/workflows/` | Automatyzacja wydań Windows |

Stos technologiczny: **Electron · React · Vite · SQLite / better-sqlite3 · Supabase · electron-builder**.

Dekodowanie dowodów rejestracyjnych korzysta z pakietu [`polish-vehicle-registration-certificate-decoder`](https://github.com/dex4er/js-polish-vehicle-registration-certificate-decoder), udostępnionego na licencji GPL-2.0. Informacje o licencjach zależności należy uwzględnić przy dystrybucji aplikacji.
