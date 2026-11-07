# Przyjęcie dostawy ze zdjęcia na iPhonie

## Działanie

1. Pulpit: skan dokumentu, albo Dokumenty → Skanuj dostawę do magazynu.
2. Wykonaj zdjęcie / wybierz je z galerii. OCR uruchamia się automatycznie na telefonie.
3. Sprawdź numery części, nazwy, ilości i ceny netto. Popraw błędne lub dopisz pominięte wiersze.
4. Przyjmij części do magazynu. Funkcja serwerowa zapisze całą dostawę w jednej transakcji.

Zdjęcie i potwierdzona dostawa trafiają do historii w chmurze. Dopasowanie do istniejącej karty bazuje na znormalizowanym numerze części, a koszt zakupu jest średnią ważoną. Jeśli karta nie istnieje, powstaje nowa z domyślnym narzutem odpowiadającym Windows.

OCR korzysta ze wspólnego parsera Windows/iOS oraz lokalnie hostowanych plików Tesseract i języka polskiego. Do odczytu potrzebne jest zdjęcie. Archiwizowanie PDF i zdjęć bez importu nadal jest osobną funkcją.

## Jednorazowe uruchomienie bazy

W projekcie Supabase otwórz SQL Editor, wklej całą zawartość `cloud_mobile_delivery.sql` i wybierz Run. Funkcja wymaga tabeli `sync_records` i jej dotychczasowych reguł RLS. Nie udostępnia klucza administracyjnego aplikacji. Bez tej aktualizacji działa OCR i korekta tabeli, a import pokazuje czytelny komunikat o brakującej funkcji.

Dostęp z tej sesji obejmuje repozytorium, nie panel administracyjny Supabase. Migracja nie została automatycznie uruchomiona w rzeczywistej bazie.

## Weryfikacja

Test transakcyjny działa na silniku PostgreSQL (PGlite): rollback błędnej pozycji, izolacja warsztatów pod rolą authenticated i RLS, duplikat zdjęcia i numeru dokumentu, średnia ważona kosztu. Test przeglądarkowy uruchamia prawdziwy OCR na syntetycznej fakturze i wysyła rozpoznane pozycje do atrapionej funkcji importu. Fizyczny iPhone i rzeczywiste uprawnienia Storage wymagają próby po aktualizacji bazy.
