# Test aktualizacji Autologika OS

Test wykonuj na osobnym komputerze lub koncie Windows. Nie używaj produkcyjnej bazy warsztatu.

1. Ustaw w `package.json` wersję `1.0.0` oraz prawidłowe `build.publish.owner` i `build.publish.repo`.
2. Uruchom `npm.cmd ci`, `npm.cmd run rebuild`, `npm.cmd test` i `npm.cmd run dist`.
3. Zainstaluj `release\Autologika-Setup-1.0.0.exe`.
4. Uruchom aplikację i utwórz klienta `TEST AKTUALIZACJI`, pojazd `TEST 100` oraz zlecenie. Zmień jedną cenę katalogową i cel miesięczny.
5. Zanotuj ścieżkę bazy widoczną w **Ustawienia → Dane i backup**. Zamknij aplikację.
6. Zmień wersję przez `npm.cmd version 1.0.1 --no-git-tag-version`, uzupełnij `CHANGELOG.md`, zatwierdź zmiany i wypchnij tag `v1.0.1`.
7. Poczekaj, aż workflow **Windows release** opublikuje instalator, `latest.yml` i plik `.blockmap` w jednym GitHub Release.
8. Uruchom zainstalowaną wersję 1.0.0 i wybierz **Ustawienia → Aktualizacje → Sprawdź aktualizacje**.
9. Potwierdź wykrycie 1.0.1, wyświetlenie release notes i zmianę postępu podczas pobierania.
10. Kliknij **Zainstaluj i uruchom ponownie**. Jeśli backup się nie powiedzie, aplikacja ma pozostać w wersji 1.0.0 i pokazać błąd.
11. Po restarcie potwierdź wersję 1.0.1 oraz obecność klienta, pojazdu, zlecenia, zmienionej ceny i celu miesięcznego.
12. W katalogu `backups` sprawdź pliki `autologika-before-update-1.0.0-to-1.0.1-*.db` oraz odpowiadający manifest `.json`.
13. W `logs\updater.log` potwierdź wpisy `CHECK`, `AVAILABLE`, `DOWNLOAD START`, `DOWNLOADED`, `BACKUP START`, `BACKUP OK` i `INSTALL`.

Po teście wykonaj ręczny backup i sprawdź jego otwarcie w SQLite przed wdrożeniem aktualizacji na komputerze warsztatowym.

