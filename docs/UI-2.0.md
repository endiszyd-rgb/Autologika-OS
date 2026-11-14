# AutoLogika UI 2.0 — pierwszy etap

Zakres: rama aplikacji, nawigacja, pulpit i fundamenty komponentów. Bez zmian API,
obliczeń, zapisu danych, uprawnień i przepływów biznesowych.

## Audyt

Dotychczasowa rama łączy styles.css, studio.css, analytics-shell.css i theme-bordo.css
oraz arkusze mobilne. Wielokrotne nadpisania, drobna typografia i rozwijany przy
najechaniu pasek ikon utrudniały orientację. Pulpit miał już właściwe dane i akcje;
zachowano je, zmieniając hierarchię wizualną i prezentację.

## Fundamenty

Źródło tokenów: `src/ui-2.css`, ładowane po theme-bordo.css.

| Obszar | Reguła |
| --- | --- |
| Kolory | Grafitowe tło #101216, powierzchnia #191c22, podniesiona #22262e |
| Tekst | #f5f6f8; pomocniczy #b0b7c4 |
| Marka | Różowo-bordowy akcent #ef819d; ciemne tło akcentu #39232e |
| Semantyka | Sukces #7de0b2, uwaga #ffd18a, błąd #ff969d; statusy zachowują podpisy |
| Typografia | Lokalny Outfit Variable, fallback Segoe UI; nagłówek 24–34 px, treść 14 px |
| Odstępy | Skala 4, 8, 12, 16, 24, 32 px |
| Promienie | 8 px kontrolki, 12 px elementy list, 20 px panele |
| Cienie | Subtelny cień panelu i mocniejszy przy interakcji |
| Ruch | 150 ms; przesunięcie karty 2 px, przycisku 1 px; reduced-motion wyłącza ruch |
| Dostępność | Widoczny focus, link do treści, nazwana nawigacja, aria-current |

`PageIntro` i `MetricCard` w `src/design-system.jsx` są komponentami prezentacyjnymi.
Przyjmują treść i callbacki; nie pobierają danych ani nie wykonują obliczeń.
Istniejące Icon i StatusBadge pozostają współdzielonymi prymitywami.

Desktop od 1100 px ma stale widoczne etykiety menu. Węższy desktop zachowuje
kompaktowy pasek z rozwijaniem również przy fokusie klawiatury. PWA zachowuje
dotychczasowy dolny pasek i safe-area. Karty KPI przechodzą do dwóch kolumn,
sekcje pulpitu do jednej; filtry mobilne mają minimum 44 px wysokości.

To stopniowa migracja: wyspecjalizowane ekrany nadal korzystają z dawnych arkuszy.
Przy kolejnych etapach należy przenosić ich reguły do tokenów, zamiast dokładać
globalne nadpisania. Test przeglądarkowy w Chromium nie zastępuje testu Safari
na fizycznym iPhonie ani instalacji PWA na Androidzie.

## Weryfikacja tego etapu

- `npm test`: 235 testów CJS + 184 testy MJS; audyt połączeń UI OK.
- `npm run test:ui`: pełny smoke Electron OK, `RENDERER_ERRORS []`, pulpit
  1500/1100 px bez poziomego przepełnienia; izolowana baza testowa.
- Build Vite i kontrola manifestu / Service Workera: OK.
- PWA: Chromium 430 × 932 z emulowanym UA iPhone, syntetyczna sesja i istniejąca
  atrapa chmury; dolna nawigacja i audyt 23 ekranów OK. Brak walidacji live.
- Pierwsze próby PWA wymagały konfiguracji fixture oraz ustawienia oczekiwanego
  nagłówka testu. Końcowe uruchomienie zakończyło się kodem 0.
- Zrzuty i logi: `artifacts/ui/`. Brak testów na fizycznych urządzeniach.

## Drugi etap — lista zleceń (2026-11-14)

- Wspólny `PageIntro`, grafitowe panele i filtry oparte na tokenach UI 2.0.
- Kontrolki filtrów mają minimum 44 px; na wąskim ekranie układają się pionowo.
- Przełącznik aktywne/archiwum udostępnia stan przez `aria-pressed`, a wiersze
  zleceń mają widoczny fokus klawiatury. Filtrowanie, zapis i akcje pozostają bez zmian.
- `npm test`: 244 CJS + 193 MJS, audyt połączeń UI OK.
- Build i kontrola PWA OK. Pełny smoke Electron: kod procesu 0,
  `RENDERER_ERRORS []`; log `artifacts/ui/ui2-orders-smoke.log`.
- Smoke listy sprawdza rzeczywiste szerokości treści Electron 1500 i 1100 px
  (`setContentSize` oraz asercja `innerWidth`), zapisuje `orders-ui2-*.png`.
  Minimalna szerokość okna desktopowego wynosi 1100 px, dlatego jego zmniejszanie
  do 430 px nie stanowi testu mobilnego. Walidacja tego etapu na PWA i urządzeniach
  Android/iOS pozostaje do wykonania.
