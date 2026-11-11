# Zdjęcia modeli pojazdów — etap 1

Centralny komponent `src/vehicle-photo.jsx` udostępnia identyczne zdjęcie dla tych samych danych marki, modelu, generacji i roku w różnych ekranach. Jest podłączony do przyjęcia, terminarza, wyboru zlecenia w terminarzu, nagłówka zlecenia, pulpitu, hali na żywo i Kanbanu.

**Źródło:** wyszukiwanie plików Wikimedia Commons z ograniczeniem do obsługiwanych otwartych licencji. Zdjęcia nie są sztucznie generowane. Wyniki są buforowane na czas działania aplikacji. Jeśli nazwa modelu/generacji nie odpowiada tytułowi dostępnego zdjęcia, komponent wyświetla neutralny symbol zamiast podstawiać inny model.

**Ograniczenia:** to nie jest jeszcze kompletna ręcznie zweryfikowana biblioteka fotografii wszystkich marek/modeli/generacji w katalogu. Nie ma gwarancji dopasowania zdjęcia zewnętrznego po samym tytule pliku. Brak również trwałego cache/offline, profesjonalnego źródła zdjęć z licencją komercyjną, potwierdzenia nadwozia/wersji, tabeli pokrycia wszystkich pozycji katalogu ani testów w przeglądarkach. Wikimedia może blokować zapytania lub zwracać brak wyniku. Ten etap nie zmienia schematu Supabase.

**Etap 2 (przed produkcyjnym użyciem):** przygotować audyt wszystkich pozycji `vehicleCatalog`, mapowanie generacji i przedziałów lat, zatwierdzony manifest fotografii z pełnymi metadanymi autora/licencji/źródła, lokalne miniatury WebP obsługiwane offline i w PWA oraz możliwość zdjęcia własnego pojazdu po VIN/ID. Dodać testy Playwright i pokrycie pozostałych miejsc wyświetlania auta (kartoteka, listy i archiwum). Zweryfikować prawnie dopuszczalność komercyjnej redystrybucji każdej fotografii i wymagane atrybucje.
