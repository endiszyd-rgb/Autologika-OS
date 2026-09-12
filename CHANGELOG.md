# Changelog

## Następna wersja

### Numery OE na liście zamówień

- Dodawanie części do zlecenia pokazuje dokładny pojazd, silnik i VIN, dla których wybierany jest numer OE.
- Formularz podpowiada pasujące pozycje z własnej bazy części i przenosi ich numer katalogowy, producenta, ceny, dostawcę oraz numery OE lub zamienników.
- Wybrany numer OE jest zapisywany razem z migawką pojazdu, widoczny na liście zamówień i kopiowany na listę dla dostawcy.
- Po oznaczeniu części jako zamontowanej numer OE przechodzi także do pozycji zlecenia.

### Zgodność modułów

- Powiązanie części zamawianej z magazynem jest synchronizowane przez stabilny identyfikator chmurowy zamiast lokalnego numeru SQLite.
- Po pobraniu zmian z innego urządzenia koszty i sprzedaż części są ponownie wyliczane z pozycji zlecenia.
- Wydanie części z magazynu wymaga numeru OE, pokazuje wybrany pojazd i zapisuje OE w pozycji zlecenia.
- Ręcznie dodawane pozycje części również obsługują numer OE, widoczny następnie w zestawieniu zlecenia.
## 1.0.17 — 2026-09-12

### Wyszukiwanie części po kodzie

- Skan kodu w zakładce Części uruchamia wyszukiwanie automatycznie, także gdy skaner nie wysyła klawisza Enter ani Tab.
- Uzupełniono rozpoznawanie producentów i numerów katalogowych z tytułu oraz opisu wyniku; zweryfikowany kod `5901532528992` zapisuje się jako TEKNOROT V-557, łącznik stabilizatora.
- Dodano odporniejsze wyszukiwanie przez DuckDuckGo Lite, używane także wtedy, gdy Brave ogranicza automatyczne zapytania.
- Wynik automatycznie uzupełnia czytelną nazwę części, producenta, numer katalogowy, pasujące pojazdy oraz znalezione numery OE i zamienników.
- Katalogi motoryzacyjne mają pierwszeństwo przed ogólnymi ofertami marketplace, a dopasowanie pojazdów jest oczyszczane z cen i danych technicznych produktu.
- W formularzu można wymusić ponowne pobranie danych bez czekania na wygaśnięcie lokalnej pamięci wyniku.

### Autologika Care

- Połączono przypomnienia z Centrum zlecenia, profilu pojazdu i ekranu Autologika Care w jeden synchronizowany rejestr.
- Przypomnienia są automatycznie klasyfikowane jako zaległe, bliskie lub zaplanowane według daty i aktualnego przebiegu pojazdu.
- Z przypomnienia można przejść bezpośrednio do cyfrowego profilu pojazdu albo powiązanego zlecenia.
- Starsze przypomnienia są automatycznie przenoszone do nowego rejestru podczas aktualizacji bazy.

## 1.0.16 — 2026-09-12

### Ulepszenia

- Globalne wyszukiwanie `Ctrl+K` otwiera teraz bezpośrednio znaleziony profil klienta lub pojazdu.
- Wyszukiwarka obejmuje aktywne, wydane i archiwalne zlecenia.
- Wyniki z archiwum są jednoznacznie oznaczone i otwierają wskazane zlecenie.
- Wyszukiwanie marek, modeli i nazw działa niezależnie od polskich oraz innych europejskich znaków diakrytycznych.

### Testy

- Dodano automatyczny przepływ `Ctrl+K` dla klienta, pojazdu oraz zarchiwizowanego zlecenia.

## 1.0.15 — 2026-09-12

### Poprawki

- Naprawiono zakładkę Należności, która korzystała z nieistniejącej kolumny i mogła nie pokazywać zaległych płatności.
- Saldo jest obliczane z tego samego zakresu finansowego co wartość zlecenia i prawidłowo uwzględnia płatności częściowe.
- Z należności można przejść bezpośrednio do właściwego zlecenia, także gdy auto zostało już wydane lub zlecenie znajduje się w archiwum.
- Klient nieprzypisany do pojazdu jest wyświetlany czytelnym opisem zamiast pustej wartości.

### Testy spójności

- Rozszerzono test interfejsu o wszystkie wcześniej nieobjęte nim główne zakładki oraz przepływ należność → zlecenie.

## 1.0.14 — 2026-09-12

### Nowości

- Kliknięcie klienta otwiera profil Customer 360 z jego pojazdami, historią zleceń i ostatnimi płatnościami.
- Profil pokazuje łączną wartość historii, wpłaconą kwotę, saldo do rozliczenia, marżę oraz liczbę aktywnych zleceń.
- Z karty klienta można przejść bezpośrednio do profilu pojazdu lub wybranego zlecenia.

### Poprawki

- Rozliczenia klienta uwzględniają częściowe płatności i wszystkie przypisane do niego pojazdy.
- Pojazdy bez właściciela pozostają poza historią i podsumowaniem klientów.

## 1.0.11 — 2026-09-11

### Nowości

- Po zeskanowaniu części aplikacja automatycznie odczytuje numer katalogowy oraz markę lub producenta.
- Karta części zawiera teraz pola „Pasuje do — marki i modele” oraz „Numery OE / zamienniki”.
- Wyszukiwarka magazynu znajduje zapisane części także po modelu pojazdu i numerze krzyżowym.

### Poprawki

- Wyniki są wzbogacane z danych strukturalnych strony produktu, podpisanych sekcji OE/OEM oraz tytułu wyniku.
- Pamięć starszych wyników jest odświeżana, aby pobrać nowe pola zgodności i numerów zamiennych.
- Dane zgodności i numery krzyżowe synchronizują się między wersją PC i Android.

## 1.0.10 — 2026-09-11

### Nowości

- Wyszukiwanie części rozszerzone o wyniki WWW zawierające dokładny zeskanowany kod EAN, UPC lub GTIN.
- Automatyczne uzupełnianie nazwy, producenta, numeru katalogowego, opisu i strony źródłowej znalezionej części.
- Przycisk otwierający stronę źródłową bezpośrednio z formularza przed zapisaniem produktu w magazynie.

### Poprawki

- Kody części samochodowych nieobecne w ogólnych bazach produktów mogą zostać rozpoznane na stronach katalogów i sprzedawców.
- Stare negatywne wyniki z wersji 1.0.9 są pomijane i wyszukiwane ponownie nową metodą.
- Kandydat z internetu jest wyraźnie oznaczony jako wymagający porównania z opakowaniem.

## 1.0.9 — 2026-09-11

### Nowości

- Lokalna pamięć wyników wyszukiwania kodów EAN, UPC i GTIN w bazie SQLite.
- Znalezione opisy części są dostępne bez internetu przez 180 dni.
- Aplikacja rozpoznaje, czy wynik pochodzi z magazynu, lokalnej pamięci czy katalogu internetowego.

### Poprawki

- Brak produktu jest zapamiętywany przez 24 godziny, co ogranicza powtarzanie nieskutecznych zapytań do zewnętrznych baz.
- Wygasłe i uszkodzone wpisy pamięci kodów są automatycznie usuwane.

## 1.0.8 — 2026-09-11

### Nowości

- Przebudowany ekran Finanse i KPI z czytelnym podsumowaniem bieżącego miesiąca.
- Osobne wskaźniki wartości zleceń, wpłat i należności pozostałych do rozliczenia.
- Wykres obrotu z 30 dni, struktura sprzedaży, prognoza celu i progi rozwoju warsztatu.

### Poprawki

- Wykres finansowy ma prawidłową wysokość i nie wyświetla już dni jako pionowej listy.
- Układ finansów jest responsywny dla szerokości 1500 i 1100 pikseli.

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
