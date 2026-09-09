# Publikowanie Autologika OS

## 1. Repozytorium GitHub

Utwórz puste repozytorium, najlepiej publiczne, aby zainstalowane aplikacje mogły pobierać aktualizacje bez tokenu. W katalogu projektu wykonaj:

```powershell
git remote add origin https://github.com/TWOJ_OWNER/TWOJE_REPO.git
git push -u origin master
```

W [package.json](package.json) zamień dokładnie:

- `build.publish.owner`: `GITHUB_OWNER` → nazwa konta lub organizacji,
- `build.publish.repo`: `GITHUB_REPO` → nazwa repozytorium.

Tych wartości nie zmieniaj pomiędzy zwykłymi aktualizacjami. Nie dodawaj tokenu do pliku.

## 2. GitHub Secrets

Workflow korzysta z automatycznego `GITHUB_TOKEN`, więc do publikowania w tym samym repozytorium nie trzeba tworzyć PAT. W **Settings → Actions → General → Workflow permissions** ustaw **Read and write permissions**.

Podpisywanie instalatora można dodać później przez sekrety `CSC_LINK` i `CSC_KEY_PASSWORD`. Certyfikat ogranicza ostrzeżenia SmartScreen i powinien być używany przed szeroką dystrybucją.

## 3. Pierwsza wersja 1.0.0

```powershell
npm.cmd ci
npm.cmd run rebuild
npm.cmd test
npm.cmd run dist
```

Lokalne artefakty znajdziesz w `release`. Lokalny `dist` niczego nie publikuje. Po sprawdzeniu instalatora:

```powershell
git add .
git commit -m "release: Autologika OS 1.0.0"
git tag v1.0.0
git push origin master --tags
```

Tag uruchamia [.github/workflows/release.yml](.github/workflows/release.yml). Workflow sprawdza zgodność taga z `package.json`, przebudowuje `better-sqlite3` dla Electron, uruchamia testy i publikuje jeden spójny zestaw instalatora oraz metadanych aktualizacji.

## 4. Kolejne wersje

Poprawka 1.0.1:

```powershell
npm.cmd version 1.0.1 --no-git-tag-version
```

Nowa funkcja 1.1.0:

```powershell
npm.cmd version 1.1.0 --no-git-tag-version
```

Przed tagiem uzupełnij `CHANGELOG.md`, uruchom testy, zatwierdź oba pliki wersji (`package.json` i `package-lock.json`) i utwórz tag zgodny z wersją.

## 5. Kanał beta

```powershell
npm.cmd version 1.2.0-beta.1 --no-git-tag-version
git add .
git commit -m "release: Autologika OS 1.2.0 beta 1"
git tag v1.2.0-beta.1
git push origin master --tags
```

Workflow oznaczy release jako prerelease. Na komputerze testowym wybierz kanał **BETA** w **Ustawienia → Aktualizacje**. Komputery na kanale **STABILNY** nie pobiorą wersji beta.

## 6. Lokalizacja danych

Stałe `appId` to `pl.autologika.os`, a dane są przechowywane w `%APPDATA%\autologika-os`:

- `autologika.db` — SQLite,
- `attachments` — zdjęcia i załączniki zleceń,
- `technical-manuals` — zasoby dokumentacji technicznej,
- `backups` — kopie dzienne, przed migracją i przed aktualizacją,
- `cloud-sync.json` i `remote-access.json` — ustawienia połączeń,
- `logs\updater.log` — trwały log aktualizacji,
- `migration-errors.log` — błędy migracji bazy.

Dokładną ścieżkę bazy pokazuje aplikacja w **Ustawienia → Dane i backup**.

## 7. Odzyskiwanie danych

1. Zamknij Autologika OS.
2. Skopiuj cały katalog `%APPDATA%\autologika-os` w bezpieczne miejsce.
3. W katalogu `backups` wybierz kopię sprzed aktualizacji lub migracji i odpowiadający manifest JSON.
4. Zmień nazwę bieżącego `autologika.db` na `autologika-uszkodzona.db`.
5. Skopiuj wybrany backup jako `autologika.db`.
6. Uruchom tę samą lub nowszą wersję programu. Nie uruchamiaj starszej wersji na bazie o nowszym numerze schematu.

## 8. Rzeczywisty test aktualizacji

Pełna procedura znajduje się w [RELEASE_TEST.md](RELEASE_TEST.md). Testuj instalację 1.0.0 → 1.0.1 przed publikacją dla warsztatu.
