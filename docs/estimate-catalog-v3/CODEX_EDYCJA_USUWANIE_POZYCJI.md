# AutoLogika OS — rozszerzenie wymagań: edycja cen i usuwanie pozycji
Data: 2026-11-11. Repozytorium: `endiszyd-rgb/Autologika-OS`.

## Cel i priorytet
Wdrożyć bezpośrednio w szczegółach zlecenia: (1) zmianę ceny naprawy już po dodaniu do listy, (2) usuwanie naprawy z listy, (3) usuwanie części przypisanej do zlecenia. To funkcjonalność priorytetowa, wykonać przed rozszerzeniem katalogu w etapach 05–08. Nie usuwać definicji napraw z globalnego katalogu ani pozycji z globalnego magazynu.

## Potwierdzony stan kodu (GitHub main, 2026-11-11)
- `src/quote-item-editor.jsx` eksportuje `QuoteItemEditor`, ma pola `labor_hours`, `labor_rate`, `unit_price`, `qty` i wywołuje `api.quotes.updateItem(item.id,d)`; to istniejący punkt zaczepienia, nie duplikować edytora.
- `src/order-workspace.jsx` zawiera nawigację zlecenia i zakładki `quote`, `parts`.
- `src/parts-workspace.jsx` posiada `removePart` do usuwania produktu Z MAGAZYNU (`api.inventory.remove`); NIE UŻYWAĆ tej operacji do usuwania części ze zlecenia.
- `src/confirmation-dialog.jsx` zawiera `confirmAction` do potwierdzenia operacji.
- `src/order-process.mjs` używa list items/parts do obliczania stanu procesu. Przy usuwaniu konieczne jest odświeżenie projekcji zlecenia.
- Właściwe miejsce renderowania listy pozycji, API usuwania, mapowanie lokalnej SQLite i chmurowej Supabase zweryfikować w kodzie przed zmianą; nie zgadywać nazw endpointów.

## Funkcja A — edytowanie ceny naprawy
1. Każda pozycja naprawy na liście zlecenia ma widoczny przycisk `Edytuj cenę` (lub ikona o czytelnym aria-label). Na desktopie i mobile.
2. Po kliknięciu otwórz istniejący `QuoteItemEditor` lub edycję inline. Dla `ROBOCIZNA` umożliwiaj `labor_hours`, `labor_rate`, a także **ręcznie ustaloną cenę końcową pozycji** niezależną od `hours × rate`, z polem uzasadnienia i znakiem `Cena ręczna`. Nie zmieniaj ukradkiem stawki godzinowej ani normy źródłowej, aby wymusić pożądaną kwotę. Przy braku ceny ręcznej korzystaj ze standardowego wzoru.
3. Dla pozycji innych niż robocizna: zmiana `unit_price`, `qty` i wartości pozycji zgodnie z obecnym modelem. Walidacja `>=0`, maksymalnie 2 miejsca po przecinku (kwoty), bez NaN/Infinity; 0 zł możliwe wyłącznie świadomie. Zapis powinien działać po ponownym wejściu do zlecenia, restarcie aplikacji i synchronizacji.
4. Od razu przelicz: sumę pozycji, kwotę całego zlecenia, netto/brutto, kosztorys, PDF, saldo i rentowność — z jednego źródła prawdy. Nie mieszaj historycznych cen zakupu z ceną dla klienta.
5. Jeśli wycena jest zaakceptowana/zamknięta/wystawiono dokument: nie modyfikuj po cichu zatwierdzonego snapshotu. Utwórz nową rewizję lub zastosuj istniejącą blokadę/ponowne zatwierdzenie; zachowaj historię i autora zmiany.

## Funkcja B — usunięcie naprawy ze zlecenia
1. Każda dodana naprawa ma `Usuń` obok `Edytuj cenę`; przycisk wywołuje `confirmAction` z nazwą naprawy i informacją o skutku.
2. Usuń wyłącznie instancję przypisaną do aktualnego zlecenia, nie definicję z `src/work-catalog.js`.
3. Jeżeli naprawa ma powiązane procedury QC, log czasu, akceptację lub zamówione części, zachowaj ich ślad i pokaż wymagane rozstrzygnięcie; nie kasuj ich kaskadowo bez potwierdzenia. Preferuj soft-delete/tombstone i audyt.
4. Po usunięciu odśwież listę, sumy, PDF i sync. Obsłuż cofnięcie przed zatwierdzeniem oraz błędy zapisu bez optymistycznego gubienia danych.

## Funkcja C — usunięcie części ZE ZLECENIA
1. W zakładce części zlecenia i w kosztorysie dodaj `Usuń ze zlecenia` przy każdej pozycji. Widoczne także dla części dodanych skanerem, ręcznie i z magazynu.
2. Wyłącznie usuń powiązanie/order line, NIE wywołuj `api.inventory.remove` i NIE usuwaj rekordu części z magazynu.
3. Zależnie od źródła i statusu: część tylko zaplanowana — anuluj przypisanie; zarezerwowana — zwolnij rezerwację; pobrana/wydana z magazynu — wykonaj udokumentowane przesunięcie zwrotne i korektę stanu dokładnie raz, w jednej transakcji; zamówiona — nie anuluj automatycznie zewnętrznego zamówienia, pokaż ostrzeżenie; zamontowana/rozliczona — blokuj proste usunięcie i zastosuj formalną korektę/zwrot.
4. Nie kasuj kosztu historycznego ani informacji o zamówieniu; zastosuj status anulowania lub tombstone i log działań.
5. Zapewnij idempotencję i zgodność SQLite/Supabase przy offline/retry; usunięta pozycja nie może powracać po synchronizacji.

## UX i dostępność
- Lista napraw: `Nazwa | ilość/czas | cena jednostkowa | suma | Edytuj cenę | Usuń`.
- Lista części: `Nazwa/nr | ilość | cena | status | Usuń ze zlecenia`.
- Na telefonie przyciski w menu akcji / czytelnej dolnej sekcji, bez rozjechania tabeli i bez blokady przewijania w PWA iOS.
- Potwierdzenie usunięcia ma opcje `Anuluj` i `Usuń ze zlecenia`, z komunikatem o nieodwracalnych skutkach dla wydanych części.
- Przy zapisie spinner i blokada wielokrotnego kliknięcia, błędy dostępne czytnikom ekranowym.

## Wymagane testy
1. Zmiana ceny robocizny już dodanej; suma, saldo, PDF po zapisie i ponownym otwarciu.
2. Ręczna cena pozycji nie modyfikuje godzin ani stawki źródłowej.
3. Usunięcie jednej z dwóch identycznych napraw usuwa tylko wybrane ID.
4. Usunięcie części z kosztorysu nie usuwa produktu z magazynu.
5. Zwolnienie rezerwacji i zwrot części wydanej przywraca stan tylko raz (retry/sync).
6. Blokada usunięcia części zamontowanej i korekta zaakceptowanej wyceny.
7. Równoczesna edycja Windows/iOS i odświeżenie po reconnect.
8. Działanie klawiszy, iOS PWA scroll, focus modalu, zero zł i brak uprawnień.
9. Regresja `npm run test:catalog`, `npm test`, `npm run build`.

## Procedura Codex
1. Przeprowadź audyt realnych komponentów list i metod `quotes`, `orders`, `parts` — zapisz pliki i mapowania.
2. Dodaj zmianę ceny i testy; 3. dodaj usuwanie napraw i testy; 4. dodaj usuwanie części i korekty magazynu; 5. testy synchronizacji; 6. testy i dokumentacja.
7. Na końcu każdego kroku dopisz do `docs/estimate-implementation-progress.md`: status, pliki, migracje, wyniki testów, ryzyka oraz commit. Nie oznaczaj zadań jako gotowe bez testów.