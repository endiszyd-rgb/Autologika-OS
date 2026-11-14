# AutoLogika UI 2.0 — design system

Warstwa wyglądu ładowana jako ostatnia w `src/main.jsx` (po `theme-bordo.css`). Wszystkie reguły działają tylko pod `html.ui2`, więc stare ekrany dziedziczą nową paletę, a całość można wyłączyć bez zmian w kodzie.

| Plik | Zawartość |
| --- | --- |
| `tokens.css` | Tokeny: kolory (paleta bordo/grafit + semantyczne), typografia, odstępy (siatka 4 px), zaokrąglenia, cienie, ruch, warstwy z-index, wymiary powłoki, bezpieczne obszary iOS/Android. Mapuje stare zmienne (`--b-*`, `--bg`, `--panel`…) na tokeny. |
| `components.css` | Prymitywy `ui-*` oraz ujednolicenie istniejących elementów (`.primary`, pola formularzy, panele, tabele, okna dialogowe, `StatusBadge`, toasty, paleta Ctrl K). |
| `shell.css` | Menu boczne, górny pasek, nagłówek strony, dolny dock PWA i pulpit. |
| `components.jsx` | Komponenty React: `Button`, `IconButton`, `Card`, `CardHeader`, `Badge`, `Kbd`, `Eyebrow`, `StatTile`, `EmptyState`, `Skeleton`, `Segmented`, `Avatar`, `BrandMark`. |
| `ui-classes.mjs` | Czyste funkcje klas i pomocnicze (testowane w Node). |
| `ui-preferences.mjs` | Klasa `html.ui2`, zapamiętany stan menu, awaryjny powrót do starego wyglądu. |

## Zasady

- **Kolory tylko z tokenów.** Nowy kod używa `var(--ui-…)`; test `tests/design-system.test.mjs` pilnuje, żeby każdy użyty token był zdefiniowany.
- **Jeden przycisk główny.** `.primary` / `Button variant="primary"` — gradient marki. Tryb warsztatowy wzmacnia kontrast i cele dotyku (`--ui-touch-min: 52px`).
- **Ruch:** 90–520 ms, `--ui-ease-standard` dla stanów, `--ui-ease-out` dla wejść. Animujemy `transform`, `opacity` i kolory; bez `backdrop-filter` (koszt w Electronie) i bez pętli dekoracyjnych. `prefers-reduced-motion` zeruje czasy trwania.
- **Mikrointerakcje:** hover zmienia tło/krawędź, wciśnięcie skaluje do 0.97, strzałki w kartach przesuwają się o 3 px, fokus z klawiatury zawsze widoczny (`:focus-visible`).

## Układ responsywny

| Szerokość | Zachowanie |
| --- | --- |
| ≥1280 px (Windows, desktop) | Menu przypięte 256 px albo pasek ikon 76 px — przełącznik w nagłówku menu, stan w `localStorage["autologika.sidebarCollapsed"]`. |
| 601–1279 px (tablet PWA, małe okno) | Pasek ikon; rozwija się nad treścią po najechaniu lub przy nawigacji klawiaturą. |
| ≤600 px (iOS/Android PWA) | Dolny dock z aktywną „pigułką”, kompaktowy górny pasek z celami dotyku 44 px, `env(safe-area-inset-*)`. |

## Wyłączenie UI 2.0

W konsoli aplikacji: `localStorage.setItem('autologika.ui','legacy'); location.reload()`. Powrót: `localStorage.removeItem('autologika.ui')`.

## Przykład

```jsx
import {Button,Card,CardHeader,Badge} from './design-system/components.jsx'
import {Icon} from './ui.jsx'

<Card>
  <CardHeader eyebrow="Operacje" title="Zlecenia w warsztacie" actions={<Badge tone="warning" dot>2 blokady</Badge>}/>
  <Button variant="primary" icon={<Icon name="intake" size={16}/>} onClick={openIntake}>Przyjmij auto</Button>
</Card>
```
