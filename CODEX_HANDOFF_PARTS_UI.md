# Handoff dla Codexa: moduł „Części i magazyn” (UI 2.0)

Interfejs magazynu jest już przebudowany na istniejących danych i funkcjach:
`src/parts-workspace.jsx`, `src/parts-model.mjs`, `src/parts-ui.css`,
`src/platform/pwa-document-capture.jsx`, `src/platform/pwa-delivery-review.jsx`
oraz `src/platform/pwa-delivery-capture.css`.

Logika biznesowa nie została zmieniona. Poniżej są funkcje, których UI nie może dziś zrobić bez nowego kontraktu po stronie danych. Przy każdej podaję, jak UI radzi sobie teraz i gdzie podłączyć wynik.

## P1. Operacje magazynowe w PWA (iPhone/Android)

W `src/platform/pwa-api.js` te metody są dziś stubami `unavailable(...)`:
- `inventory.adjust`
- `inventory.issue`
- `inventory.remove`
- `inventory.lookupBarcode`
- `inventory.lookupPartNumber`

Ze względu na to UI na telefonie:
- wyłącza przyciski „−1”, „+1 przyjęta”, „Wydaj do zlecenia” i „Usuń”, z podpowiedzią „Dostępne w aplikacji AutoLogika na Windows”;
- ukrywa internetowe wyszukiwanie po kodzie i numerze katalogowym;
- pokazuje notkę `.stockCloudNote`.

**Kontrakt:** RPC w Supabase o takich samych sygnaturach i zwrotkach jak na PC (`electron/main.cjs`, handlery `inventory:*`):
- transakcyjne;
- idempotentne (klucz żądania);
- z wpisem w historii ruchów (patrz P3).

`issue` zwraca `{remaining}`, a `remove` zwraca `{removed, barcode}`.

**Po wdrożeniu:** usuń warunek `cloudOnly` w `PartsWorkspace` dla tych przycisków i dla bloku `.stockLookupModes`.

## P2. Skanowanie kodu EAN aparatem telefonu

Dziś na PC kod trafia ze skanera Zebra (klawiatura). Na telefonie można tylko wpisać nazwę lub numer w wyszukiwarce.

**Kontrakt UI:** komponent `BarcodeCamera`:
- natywne `BarcodeDetector`, gdy jest dostępne, a jako fallback ZXing (lazy import);
- formaty EAN-13, EAN-8, UPC-A i Code128;
- wynik `{barcode}`, podany dalej do istniejącego `inventory.findBarcode(code)` (PWA już je ma).

**Gdzie podłączyć:** w `.stockThumbBar` dodaj przycisk „Skanuj kod” obok „Skanuj fakturę”.

## P3. Historia ruchów części (karta magazynowa)

Brakuje informacji, kto, kiedy i dlaczego zmienił stan: przyjęcie z dostawy, wydanie do zlecenia, korekta albo zwrot.

```ts
api.inventory.movements(partId,{limit?}): Promise<Array<{
  id, at: string, kind: 'DELIVERY'|'ISSUE'|'ADJUST'|'RETURN'|'IMPORT',
  delta: number, stockAfter: number,
  orderId?: number, deliveryDocumentId?: number, user?: string, note?: string
}>>
```

**Gdzie podłączyć:** rozwijana sekcja „Historia” w karcie `.stockCard.selected` albo zakładka w `PartEditor`.

## P4. Podgląd skanu dokumentu dostawy w aplikacji

Dziś `deliveryDocuments.open(id)` otwiera plik w zewnętrznym programie (PC) albo w nowej karcie (PWA). Okno „Podgląd dokumentu” pokazuje pozycje i sumy, ale nie pokazuje obrazu.

```ts
api.deliveryDocuments.preview(id,{maxSize:1600}): Promise<{
  mime: string, dataUrl?: string, signedUrl?: string, pages?: number
}>
```

**Gdzie podłączyć:** `DeliveryPreview` w `src/parts-workspace.jsx` pokazuje obraz nad tabelą pozycji, z przybliżaniem gestem.

## P5. Spójne dane dostaw i magazynu w PWA

| Pole | PC | PWA dziś | Skutek w UI |
|---|---|---|---|
| `delivery_document_imports.items` | parsowane z `items_json` w `deliveryDocuments:list` | surowy rekord (`rows(...)`), często bez `items` | karta dostawy na telefonie nie pokazuje pozycji, a podgląd ma pustą tabelę |
| `inventory_parts.supplier` | `LEFT JOIN suppliers` | brak | na telefonie „Dostawca: nieustalony” |

**Kontrakt:** `deliveryDocuments.list()` i `inventory.list()` w `pwa-api.js` zwracają ten sam kształt co na PC, czyli `items: []` oraz `supplier: string|null`.

## P6. Duplikaty i walidacja przy imporcie faktury z telefonu

- PC wykrywa duplikat przed importem (`scan.duplicate`) i blokuje przycisk.
- PWA dowiaduje się o duplikacie dopiero po zapisie (`already_imported`).
- PWA nie blokuje też ilości ułamkowych w UI. Pokazuje tylko ostrzeżenie, a błąd zwraca dopiero `validateDelivery` w `pwa-delivery.mjs` przy zapisie.

**Kontrakt:** `deliveryDocuments.findDuplicate({supplier_name, document_no, document_date})`, które zwraca `{id, external_document_no, supplier}|null`. UI pokaże baner jak na PC i zablokuje „Przyjmij części do magazynu”.

**Decyzja produktowa:** czy blokować przycisk przy niepełnej liczbie sztuk także na telefonie, jak na PC. Dziś to zmiana zachowania, więc UI tylko ostrzega.

## P7. Faktury PDF i wielostronicowe w PWA

Mobilny odczyt przyjmuje tylko zdjęcia (`accept="image/*"`). Faktury z hurtowni często przychodzą jako PDF.

**Kontrakt:** `recognizeDeliveryDocument(file)`, który dla PDF renderuje strony (pdf.js), łączy pozycje ze wszystkich stron i zwraca ten sam kształt co `recognizeDeliveryPhoto`.

## P8. Zestawienia i filtry po stronie serwera

Filtry („Do uzupełnienia”, „Brak na stanie”, „Bez lokalizacji”), sortowanie i liczniki są dziś liczone w przeglądarce na pełnej liście (`parts-model.mjs`). Przy kilku tysiącach pozycji warto przenieść to do zapytania.

```ts
api.inventory.list(q,{filter?:'ALL'|'LOW'|'OUT'|'NO_LOCATION', sort?:'name'|'stock'|'value'|'location', limit?, offset?})
api.inventory.summary(q?): Promise<{positions, units, value, low, out, noLocation}>
```

**Niezmiennik:** `low` liczy `stock <= min_stock`, tak jak dziś licznik „Niski stan” i `stockLevel()`.

## P9. Lista do zamówienia z niskich stanów

Z widoku „Do uzupełnienia” brakuje akcji „Utwórz zamówienie u dostawcy”.

**Kontrakt:** `inventory.reorderDraft({partIds})`, który zwraca propozycję ilości (`max(min_stock*2 - stock, 1)` albo reguła do ustalenia), pogrupowaną po dostawcy. Potem `purchases.create(...)` z pozycjami (istniejący moduł zakupów).

## P10. Zdjęcia części

Kolumna `inventory_parts.image_url` istnieje i wypełnia ją wyszukiwanie online, ale nie ma bezpiecznego pobrania miniatury:
- CSP;
- obrazy z zewnętrznych domen;
- tryb offline.

**Kontrakt:** `inventory.thumbnail(partId,{maxSize:160})`, z cache lokalnym na PC i w Storage w PWA.

**Gdzie podłączyć:** `.stockCardHead` w karcie i pierwsza kolumna listy.

## Definition of Done dla każdego punktu

- [ ] Kontrakt w `electron/preload.cjs`, `electron/main.cjs` i `src/platform/pwa-api.js`, z tym samym kształtem odpowiedzi.
- [ ] Testy jednostkowe kontraktu oraz test niezmiennika (P1: stan po operacji, P5: kształt rekordów, P8: zgodność liczników z `parts-model.mjs`).
- [ ] `npm test` (z audytem połączeń UI), `test:ui`, `test:pwa` i audyt PWA wszystkich modułów na fixture są zielone.
- [ ] Usunięte warunki `cloudOnly` tylko dla funkcji, które naprawdę działają w PWA.
