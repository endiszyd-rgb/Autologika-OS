# Changelog

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

