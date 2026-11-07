# Dokumenty na iOS — naprawa 7 listopada 2026

Przycisk skanowania dokumentu otwierał desktopowy importer OCR, którego metody w PWA były celowo niedostępne. Dokumenty wyświetlały też tekst Windows i przyciski otwierania folderu. Dodawanie plików do zlecenia nie pokazywało błędów zapisu.

## Zmiana

- Osobny ekran iOS: bezpośrednie natywne pola wyboru aparatu, galerii i PDF, podgląd, nazwa i zapis w chmurze.
- Zapis samodzielnego skanu w historii dokumentów; zdjęcia ze zlecenia zachowują powiązanie i kategorię.
- Po błędzie zdjęcie pozostaje wybrane, ponowienie wykorzystuje ten sam identyfikator i ścieżkę.
- Lista Dokumenty pokazuje obrazy i PDF-y, bez desktopowych akcji folderów.
- Skaner AZTEC ma osobne natywne wejścia aparatu i galerii; zwalnia aktywny strumień przed otwarciem aparatu systemowego.
- Odrzucane są puste, zbyt duże i nieobsługiwane pliki. Zmiana sesji podczas uploadu nie publikuje metadanych w nowym warsztacie.

## Zakres

Na iOS zapisujemy zdjęcia i PDF-y. OCR pozycji dostaw i zmiana stanu magazynowego pozostają funkcjami Windows. Interfejs opisuje tę różnicę przed zapisem. Nie zmieniano schematu ani uprawnień chmury.

## Weryfikacja

Testy logiki plików: poprawne typy, limity, kolejność uploadu i metadanych, powiązania zlecenia, idempotencja, awarie i zmiana konta. Test przeglądarkowy wybiera syntetyczne zdjęcie przez pole galerii, zapisuje je i sprawdza obecność w Dokumentach. Systemowy aparat i biblioteka zdjęć wymagają fizycznego iPhone’a; mock chmury nie potwierdza uprawnień rzeczywistego konta Supabase.
