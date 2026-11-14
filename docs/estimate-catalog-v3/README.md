# AutoLogika OS — Katalog Wycen v3 (pakiet dla Codex)

Data: 2026-11-11. Pakiet źródłowy v3 został rozpakowany do tego katalogu dla łatwego użycia przez Codex. **Ta gałąź nie wdraża jeszcze funkcjonalności do aplikacji.**

## Zawartość
- `katalog_napraw_rynek_2026_v2.csv` i `.json` — 96 obserwacji cenowych, 81 kodów operacji. JSON wygenerowany z tego samego CSV; wersje strukturalnie równoważne, nie są normami OEM.
- `estimate-engine-v2.mjs` — prototyp kalkulacji w groszach i minutach, z utrudnieniami i kontrolą zgody klienta.
- `test-estimate-engine-v2.mjs` — 7 testów jednostkowych.
- `CODEX_WDROZENIE.md` — główne etapy wdrożenia do istniejącego repo.
- `CODEX_EDYCJA_USUWANIE_POZYCJI.md` — **priorytet**: edycja ceny naprawy oraz usuwanie napraw i części ze zlecenia.
- `raport_danych.json` — podstawowe metadane katalogu.

## Kolejność
1. Zbadaj aktualny kod, model danych, ścieżki wyceny i zleceń oraz API `quotes.updateItem`.
2. Najpierw wykonaj wymagania `CODEX_EDYCJA_USUWANIE_POZYCJI.md`: cena naprawy, usuwanie naprawy i usuwanie części ze zlecenia. Uwzględnij magazyn i synchronizację.
3. Następnie wdrażaj `CODEX_WDROZENIE.md`, dopasowując schema i UI do aktualnej architektury, nie kopiując istniejących modułów.
4. Wykonaj migracje, testy jednostkowe/integracyjne, `npm run test:catalog`, `npm test`, `npm run build`. Zapisuj postęp w `docs/estimate-catalog-v3/IMPLEMENTATION_PROGRESS.md` po każdej fazie.

## Ograniczenia danych
- Ceny rynkowe to punkty odniesienia, nie domyślne ceny zleceń.
- Puste czasy pracy nie mogą być zastępowane sztucznymi normami.
- `market_tax_status=not_specified` nie daje prawa do przyjęcia netto ani brutto.
- Zmiany zaakceptowanych wycen wymagają nowej wersji/ponownej zgody klienta.
- Usunięcie pozycji ze zlecenia nie może oznaczać skasowania części z globalnego magazynu.
- Przy wydanych/zamontowanych częściach wymagane są rozliczenia korekcyjne, nie bezpośrednie usunięcie historii.
- Przed publikacją komercyjną zweryfikuj warunki wykorzystania danych z zewnętrznych cenników.

**To materiały pomocnicze dla Codex.** Nic w tym folderze nie zostało jeszcze podłączone do produkcyjnego UI, Supabase ani synchronizacji.
