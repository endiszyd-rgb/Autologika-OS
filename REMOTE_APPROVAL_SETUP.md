# Remote Approval 2.0

Zdalna akceptacja jest rozszerzeniem istniejącej wyceny i tabeli `approvals`. Nie tworzy drugiego obiegu decyzji. Proces główny Electron zamraża dokładną wersję kosztorysu, zapisuje kanoniczny snapshot i SHA-256, a klient otrzymuje jednorazowy link do Edge Function.

## Wdrożenie Supabase

1. W SQL Editor uruchom cały `cloud_schema_supabase.sql`. Plik zawiera schemat synchronizacji i kompletny moduł akceptacji. Sama migracja `supabase/migrations/20260925_remote_approval_2.sql` jest idempotentna i potrafi dobudować moduł akceptacji także w starszym projekcie, który ma już tylko podstawową synchronizację.
2. Połącz CLI z projektem: `supabase link --project-ref <PROJECT_REF>`, a migracje repozytorium zastosuj przez `supabase db push --linked --include-all`.
3. Nie zapisuj `SUPABASE_SERVICE_ROLE_KEY` w repozytorium ani aplikacji. Supabase udostępnia funkcji zarezerwowane zmienne `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` automatycznie.
4. Wdróż API klienta: `supabase functions deploy approval --use-api`. Plik `supabase/config.toml` wyłącza weryfikację JWT dla jednorazowego tokenu, a fonty PDF są osadzone w pakiecie funkcji, więc wdrożenie nie wymaga Dockera.
5. Opublikuj katalog `docs` jako GitHub Pages z gałęzi `main`. Formularz znajduje się pod `/Autologika-OS/approval/`; token jest przechowywany wyłącznie we fragmencie `#t=...` i nie trafia do serwera hostującego stronę. Edge Function przyjmuje dane tylko z ustalonego originu GitHub Pages. Starsze linki prowadzące bezpośrednio do funkcji są automatycznie przekierowywane.
6. Sprawdź, że bucket `approval-evidence` ma `public = false`.

Funkcja wymaga zmiennych `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY`, które środowisko Supabase udostępnia funkcji. Aplikacja PC korzysta wyłącznie z Publishable key i sesji zalogowanego właściciela warsztatu.

## Przepływ danych

```text
PC: dokładny kosztorys -> snapshot JSON -> SHA-256 -> losowy token 256 bit
                                      |             |
                                      v             v
                             customer_approval_links (prywatne)
                                                    |
Klient: GitHub Pages (#token) -> Edge API -> zgoda + podpis -> atomowa decyzja RPC
                                                    |
                                      podpis PNG + finalny PDF
                                      private Storage
                                                    |
PC: synchronizacja -> weryfikacja SHA-256 -> lokalne archiwum PDF
```

Token w URL nie jest zapisywany w bazie. Baza przechowuje wyłącznie jego SHA-256. Link wygasa po 7 dniach. Decyzja jest zapisywana przez `decide_customer_approval`, która blokuje rekord `FOR UPDATE`; dwa równoczesne żądania nie mogą zapisać dwóch różnych decyzji.

## Obsługa w aplikacji

1. W zleceniu otwórz wycenę, dodaj pozycje i wybierz **Wyślij do akceptacji**.
2. Wybierz **Generuj link zdalny**. Snapshot powstaje w procesie głównym, a link jest kopiowany do schowka.
3. Klient zaznacza zgodę, podpisuje się palcem, rysikiem lub myszą i zatwierdza. Odrzucenie może zawierać powód i nie wymaga podpisu.
4. Automatyczna synchronizacja albo **Sprawdź decyzję** pobiera wynik. Dla akceptacji aplikacja pobiera finalny PDF, podpis PNG oraz manifest integralności JSON.
5. W panelu **Akceptacje klienta** można otworzyć PDF, podpis, folder, uzupełnić brakujący pakiet oraz uruchomić ręczną kontrolę integralności wszystkich trzech plików.
6. Po zakończonej decyzji przycisk **Dodatkowy zakres naprawy** tworzy nową wersję kosztorysu. Poprzedni snapshot i PDF pozostają niezmienne.

## Lokalne archiwum

Domyślna lokalizacja to:

`Pulpit\AutoLogika - Akceptacje\<REJESTRACJA>\`

Każda decyzja tworzy w tym folderze trzy powiązane pliki: `...Akceptacja-02.pdf`, `...Akceptacja-02_Podpis.png` i `...Akceptacja-02_Dowod.json`. Manifest przechowuje zamrożony snapshot, identyfikatory decyzji, nazwy plików oraz rzeczywiste i oczekiwane sumy SHA-256.

Powiązanie folderu opiera się na `vehicle_id`, więc późniejsza zmiana rejestracji nie rozdziela historii pojazdu. W **Ustawienia -> Dokumenty i archiwum akceptacji** można wybrać inną lokalizację i uzupełnić brakujące pakiety. Starsze archiwa zawierające tylko PDF są wykrywane jako niepełne i uzupełniane bez zmiany nazwy dokumentu. Aplikacja nie usuwa ani nie przenosi wcześniejszych folderów automatycznie. Supabase pozostaje źródłem prawdy; usunięte lokalne pliki można pobrać ponownie.

## Integralność i prywatność

- Snapshot zawiera identyfikatory zlecenia, pojazd, klienta, dokładne pozycje, ceny, sumy, wersję zgody i informację o wcześniejszych akceptacjach.
- Snapshot, podpis i PDF mają osobne SHA-256.
- Po decyzji rekord jest niezmienny dzięki triggerowi `protect_finished_approval`.
- PNG podpisu i PDF są w prywatnym bucketcie. Klient nie otrzymuje publicznego URL Storage.
- RLS pozwala zalogowanemu warsztatowi czytać tylko rekordy i pliki we własnej przestrzeni. Zmiana decyzji jest dostępna wyłącznie dla Service Role w Edge Function.
- `customer_approval_events` zapisuje utworzenie, otwarcie, decyzję, utworzenie PDF, wygaśnięcie i odrzucenie z powodu naruszenia integralności.

## Testy i diagnostyka

Uruchom:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:migration
npm.cmd run test:ui
```

Jeśli link zwraca błąd, sprawdź logi Edge Function, datę `expires_at` i zgodność wdrożonej migracji. Jeśli decyzja jest widoczna, ale brakuje PDF, sprawdź prywatny bucket, `pdf_storage_path` i użyj **Pobierz ponownie**. `SNAPSHOT_HASH_MISMATCH` oznacza, że link został trwale unieważniony; należy utworzyć nową akceptację/link po zbadaniu danych.

## Model zagrożeń

- **Zgadnięcie linku:** sekret ma 256 bitów; w bazie istnieje tylko hash.
- **Powtórzenie żądania:** terminalny rekord jest niezmienny, a RPC blokuje wiersz i zmienia tylko `PENDING`.
- **Wyścig dwóch decyzji:** `SELECT ... FOR UPDATE` serializuje zapis; wygrywa pierwsza prawidłowa decyzja.
- **Podmiana kwoty lub pozycji:** Edge ponownie liczy kanoniczny hash snapshotu. Niezgodność unieważnia link i zapisuje zdarzenie bezpieczeństwa.
- **Dostęp do cudzego dokumentu:** RLS i pierwszy segment ścieżki Storage są związane z `auth.uid()` warsztatu.
- **Kradzież komputera:** lokalny PDF jest plikiem użytkownika Windows. Ochrona dysku i konta systemowego pozostaje obowiązkiem administratora stanowiska.
- **Utrata lokalnego pliku:** prywatny Storage jest źródłem prawdy i umożliwia ponowne pobranie po weryfikacji hasha.
