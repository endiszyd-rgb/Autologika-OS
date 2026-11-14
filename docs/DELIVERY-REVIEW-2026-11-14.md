# Skanowanie dostaw i potwierdzanie propozycji

Przepływ: **pulpit / Dokumenty → aparat lub galeria → lokalny OCR → korekta
pozycji → osobne potwierdzenie podsumowania → transakcyjny zapis magazynowy**.

## Dostęp i przetwarzanie

- Pulpit zachowuje callback `scanDocument` i przycisk „Skanuj dokument”.
  PWA korzysta z `PwaDocumentCapture`, Windows z `DeliveryDocumentImport`.
- iOS i Android korzystają z tych samych natywnych wejść `image/*`:
  aparat z `capture="environment"` oraz galeria bez `capture`.
- Zdjęcie pozostaje w podglądzie. PWA skaluje obraz do maksymalnie 2800 px,
  nakłada białe tło i uruchamia Tesseract z automatycznym obrotem.
  Silnik i polski model są hostowane razem z aplikacją; brak płatnego API OCR.
  Oryginał trafia do Storage dopiero po potwierdzeniu importu.
- Nieobsługiwane zdjęcie daje komunikat o JPEG/PNG i możliwość ręcznego
  wprowadzenia pozycji. PDF pozostaje osobnym załącznikiem, bez OCR pozycji.
- Parser rozpoznaje tabelę, nie gwarantuje obsługi każdego układu faktury.
  Odczyt można poprawić, ponowić, uzupełnić ręcznie lub wyłączyć błędny wiersz.

## Propozycja i zapis

`shared/delivery-review.cjs` zapewnia wspólne przeliczenia i walidację.
Cena zakupu oznacza netto za sztukę, brutto oznacza wartość całego wiersza.
Zmiana ilości, netto lub VAT przelicza brutto; zmiana brutto wylicza netto.
Koszt wynikający z brutto jest zaokrąglany do groszy; kontrola zgodności
uwzględnia skumulowaną różnicę zaokrąglenia na sztukach.
VAT 0% nie jest zastępowany przez 23%. Parser obsługuje także jawne 5%.
Ilości części pozostają dodatnimi liczbami całkowitymi zgodnie z kontraktem
magazynu. Puste, ujemne, nieskończone i niespójne dane blokują zapis.

Oba interfejsy wymagają osobnego potwierdzenia liczby pozycji, sztuk oraz
wartości netto/brutto. Powtórzone numery części i różnica względem sumy
dokumentu są wskazywane w potwierdzeniu. Powtórzone wiersze nie są usuwane
automatycznie — mogą oznaczać rzeczywiste osobne pozycje faktury.
Drugi przebieg OCR dopasowuje wiersze jeden do jednego.

Dotychczasowe API, props komponentów i RPC pozostają zgodne. Desktop
waliduje ponownie przed transakcją; niejednoznaczne numery istniejących kart
blokują całą dostawę. Istniejące zabezpieczenia hash zdjęcia oraz numer
dokumentu + dostawca chronią przed ponownym zwiększeniem stanu. PWA sprawdza
sesję również po odczycie zdjęcia, obliczeniu hasha i synchronizacji.

## Weryfikacja i ograniczenia

- Testy jednostkowe: przeliczenia, VAT 0/5%, błędne wartości, anulowane
  potwierdzenie, powtórzone wiersze OCR, zmiana sesji podczas odczytu zdjęcia.
- SQLite: import, duplikaty dokumentów, niejednoznaczna kartoteka i rollback.
- Istniejące testy PostgreSQL/PGlite: transakcje i izolacja warsztatów.
- Smoke PWA używa syntetycznej faktury, prawdziwego lokalnego OCR i atrapy
  chmury. Sprawdza wejście z pulpitu, obecność aparatu i galerii, brak RPC po
  anulowaniu oraz dokładnie jeden RPC po potwierdzeniu.
- `PWA_TEST_UA` pozwala uruchomić smoke dla UA iPhone oraz Android.
  Jest to Chromium z emulacją UA i viewportu, nie Safari ani fizyczny aparat.
- Fizyczny iPhone/Android, systemowy picker, HEIC i produkcyjna chmura:
  **NOT_RUN**. Pierwsze uruchomienie OCR wymaga pobrania jego plików.
- Nie wykonano migracji, wdrożenia, push ani merge. PWA nadal wymaga
  istniejącego RPC `import_mobile_delivery`; jego dostępności live nie badano.

Logi lokalne: `artifacts/delivery-tests.log`, `delivery-focused.log`,
`delivery-build.log`, `delivery-ios.log`, `delivery-android.log`.

Wynik lokalny: pełny zestaw 244 CJS + 192 MJS i audyt połączeń UI — PASS;
14 testów ukierunkowanych (w tym PGlite i rollback SQLite) — PASS;
końcowe 8 testów importu i obsługi uszkodzonego zdjęcia — PASS.
Oba przebiegi Chromium (UA iPhone i Android), z OCR i kontrolą potwierdzenia
zapisu — PASS. Build z atrapą konfiguracji służył wyłącznie smoke; po nim
przywrócono build z domyślną lokalną konfiguracją.
