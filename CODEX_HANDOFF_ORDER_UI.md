# Przekazanie dla Codexa — kontrakty danych dla widoku zlecenia (UI 2.0)

Interfejs przyjęcia i Centrum zlecenia (`src/order-hub.jsx`, `src/order-hub-model.mjs`, `src/order-hub.css`) korzysta wyłącznie z danych, które `OrderCenter` już pobiera. Poniższe kontrakty są potrzebne, żeby usunąć przybliżenia opisane przy każdym punkcie. **Interfejs działa bez nich.** Po dodaniu kontraktu wystarczy podmienić źródło danych we wskazanym miejscu.

Każdy kontrakt musi mieć tę samą sygnaturę w trzech miejscach:

- `electron/preload.cjs` i `electron/main.cjs`, przez `ipcMain.handle`;
- `src/platform/pwa-api.js` (iOS/Android PWA, Supabase);
- testy w `tests/`.

Audyt `npm run test:connections` wymaga, żeby każde wywołanie `api.*` miało obsługę w preload.

---

## 1. Miniatury zdjęć zlecenia — `attachments.thumbnail`

**Problem:** karta „Zdjęcia i pliki” i podgląd zlecenia pokazują tylko typ pliku (`IMG`/`PDF`), etap i datę. Renderer nie może bezpiecznie wczytać `file_path`, bo nie ma dostępu do `file://`. W PWA pliki są w prywatnym buckecie `order-files`.

```ts
api.attachments.thumbnail(id: number|string, opts?: { maxSize?: number /* px, domyślnie 320 */ })
  : Promise<{ id, src: string /* data:image/webp;base64,... lub podpisany URL https */, width: number, height: number, expiresAt?: string } | null>
```

- **PC:** `nativeImage.createFromPath(file_path).resize({width|height:maxSize})`, wynik `toDataURL()`. Wynik zapisz w pamięci podręcznej po `sha256`. Dla plików innych niż obrazy zwróć `null`.
- **PWA:** podpisany URL Supabase Storage z transformacją (`/render/image/sign/order-files/...?width=320`), ważny 10 minut. Zwróć `null`, gdy transformacje są niedostępne w planie.
- **Bezpieczeństwo:** zwracaj tylko pliki należące do `order_id` z bieżącej bazy lub do zalogowanego użytkownika (RLS). Nigdy nie zwracaj ścieżki z dysku.
- **Gdzie podłączyć:** `OrderPhotoDocs` → lista `photoRecent` (zamiast `photoRecentKind`) oraz nowa siatka zdjęć w `OrderPreview`.

## 2. Zdjęcie konkretnego auta klienta — `vehicles.coverPhoto`

**Problem:** karta pojazdu pokazuje zweryfikowane zdjęcie *modelu* z katalogu Wikimedia (`VehiclePhoto`), a nie zdjęcie auta klienta. Dla nietypowych modeli pokazuje symbol zastępczy.

```ts
api.vehicles.coverPhoto(vehicleId): Promise<{ attachmentId, orderId, src, takenAt } | null>
```

- **Reguła:** najnowsze zdjęcie z kategorii `PRZYJECIE` dowolnego zlecenia tego pojazdu, które nie jest usunięte (`deleted_at IS NULL`). Plik musi spełniać warunek `mime LIKE 'image/%'`.
- **Gdzie podłączyć:** `orderHeroMedia` w `OrderCenter` i `OrderSummaryPreview`. Zdjęcie auta ma pierwszeństwo, a `VehiclePhoto` zostaje jako zapas. Przy zdjęciu pokaż etykietę „Zdjęcie z przyjęcia”.

## 3. Spójność sumy PC ↔ PWA oraz koszt, marża i VAT — `orders.financeSummary`

**Jak UI liczy dziś (bez nowych danych):** `orderFinance()` w `src/order-hub-model.mjs` stosuje te same reguły co raporty PC (`electron/main.cjs`, przychód produktywny) i `orderMoney()` w `src/platform/pwa-data.mjs`:

- suma = `order.total`, zawsze z bazy;
- części = `parts_sale`;
- robocizna = pozycje `ROBOCIZNA` plus robocizna z kolumn zlecenia (`labor_hours×labor_rate`, a w PWA `legacy_labor`);
- inne = `other_sale` − robocizna z pozycji, bo `syncOrderItemTotals` wlicza do `other_sale` wszystko poza `CZESC`;
- osobno diagnoza (`diagnosis_fee`) i rabat (`discount`);
- cena ustawiona ręcznie (`final_price`) jest pokazana jako jawna korekta.

Rekordy zleceń na PC i w PWA mają te kolumny, więc podział jest dokładny na obu platformach.

**⚠ Rozbieżność logiki biznesowej (do decyzji, poza zakresem UI):**

- PC: `ORDER_BASE_SQL` w `electron/order-financials.cjs` **zawsze** dolicza `labor_hours×labor_rate`.
- PWA: `orderMoney()` w `pwa-data.mjs` dolicza ją **tylko wtedy, gdy zlecenie nie ma pozycji `ROBOCIZNA`**.

Przykład: zlecenie z `labor_hours>0` i pozycjami robocizny (np. starsze zlecenie uzupełnione z katalogu prac) ma różną wartość na PC i na telefonie. Trzeba ustalić jedną regułę i pokryć ją testem wspólnym dla `order-financials.cjs` i `pwa-data.mjs`.

**Brakuje też** kosztu i marży w rozbiciu na kategorie oraz kwot VAT. `contribution` jest dziś jedną liczbą dla całego zlecenia.

```ts
api.orders.financeSummary(orderId): Promise<{
  orderId: number,
  labor:  { net, cost }, parts: { net, cost }, other: { net, cost },
  diagnosisFee: number, discount: number,
  calculatedTotal: number,    // ORDER_BASE_SQL (po ujednoliceniu reguły robocizny)
  finalPrice: number|null, total: number /* == orders.get(id).total */,
  contribution: number,       // == orders.get(id).contribution
  vat?: { rate, net, gross }
}>
```

- **Niezmienniki (test):**
  - `labor.net + parts.net + other.net + diagnosisFee - discount === calculatedTotal`;
  - `total` i `contribution` są identyczne z `orders.get(id)`;
  - ten sam wynik na PC i w PWA dla tych samych danych.
- **Gdzie podłączyć:** `OrderFinanceSummary`. Dodaj wiersz „Marża” dla każdej kategorii, widoczny tylko dla właściciela. Po dodaniu kontraktu `orderFinance()` bierze z niego `split`.

## 4. Historia etapów z datami — `orders.statusHistory`

**Problem:** pasek „Realizacja” zna tylko bieżący `status` i `wait_state`. Nie pokazuje, kiedy auto weszło w dany etap ani jak długo w nim jest. Dane istnieją, ale w formie tekstowej:

- PC (`electron/order-lifecycle.cjs`) zapisuje do `order_events` wpis `event_type='STATUS'` z `details` w formacie `"STARY → NOWY"`. Podobnie zapisuje zmianę oczekiwania.
- PWA (`pwa-api.js`) zapisuje `createEvent(id,'Zmieniono status',status,'STATUS')`, ale w `details` podaje tylko nowy status, bez strzałki.
- `timeline.list` zwraca te wpisy razem z innymi zdarzeniami. Parsowanie tekstu `details` w UI byłoby kruche, bo formaty PC i PWA się różnią.

```ts
api.orders.statusHistory(orderId): Promise<Array<{ status: string, previousStatus: string|null, waitState: string|null, enteredAt: string /* ISO */, source: 'PC'|'MOBILE'|'REMOTE_APPROVAL' }>>
```

- **Odczyt:** z `order_events` o typach `STATUS` i `WAIT` oraz z `MOBILE_UPDATE`, którego JSON `{status,wait_state}` też niesie informację o etapie. Wynik posortuj rosnąco. Zlecenie bez zdarzeń zwraca jeden wpis `{status:'PRZYJETE', enteredAt: orders.opened_at}`.
- **Ujednolicenie zapisu (opcjonalne, ale zalecane):** PWA powinna zapisywać `details` w tym samym formacie co PC.
- **Gdzie podłączyć:** `OrderProgress`. Pod każdym zakończonym etapem pokaż datę, a przy bieżącym czas w etapie.

## 5. Zgodność PWA

Żaden kontrakt nie wymaga zmian w schemacie bazy ani w tabelach Supabase. Każdy kontrakt potrzebuje implementacji w `pwa-api.js`. Do czasu jej powstania `pwa-api.js` powinien zwracać `null` lub `[]`, a UI ma wtedy wrócić do obecnego zachowania.

## Definicja ukończenia

- [ ] Decyzja i test dla rozbieżności legacy-robocizny PC ↔ PWA (punkt 3).
- [ ] Kontrakty od 1 do 4 w preload, main i `pwa-api.js`, z testami jednostkowymi. Punkt 3 ma test niezmiennika sumy.
- [ ] `npm test`, `npm run test:ui`, `npm run test:pwa` są zielone.
- [ ] Podmiana źródeł w `order-hub-model.mjs` i `order-hub.jsx`. Istniejące testy `tests/order-hub-model.test.mjs` muszą przechodzić, bo stare zachowanie zostaje jako zapas.
