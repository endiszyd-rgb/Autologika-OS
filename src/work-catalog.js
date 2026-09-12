import {WORK_CATALOG_EXPANSION} from './work-catalog-expansion.js'
import {expandCatalogDiagnostics} from './work-catalog-diagnostics.js'

const BASE_WORK_CATALOG = [
  {
    "group": "Serwis okresowy i eksploatacja",
    "jobs": [
      {
        "name": "Przegląd okresowy pojazdu",
        "variants": [
          "mały przegląd",
          "pełny przegląd"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola podstawowych układów pojazdu zgodnie z zakresem zlecenia: poziomy i stan płynów, szczelność, oświetlenie, ogumienie, hamulce, zawieszenie, układ kierowniczy, elementy podwozia oraz odczyt przypomnień serwisowych. Stwierdzone nieprawidłowości i zalecenia zapisano w zleceniu."
      },
      {
        "name": "Wymiana oleju silnikowego i filtra",
        "variants": [
          "standard",
          "z demontażem osłon",
          "olej + płukanie uzgodnione"
        ],
        "hours": 0.6,

        "price": 140,
        "scope": "Spuszczenie oleju silnikowego, wymiana filtra oleju i elementów uszczelniających, kontrola korka spustowego, napełnienie olejem o właściwej specyfikacji. Uruchomienie silnika, kontrola szczelności i poziomu po stabilizacji. Reset inspekcji serwisowej, jeśli uzgodniono."
      },
      {
        "name": "Wymiana filtra powietrza",
        "variants": [
          "silnika",
          "wkład nietypowy / utrudniony dostęp"
        ],
        "hours": 0.3,

        "price": 70,
        "scope": "Demontaż obudowy filtra, usunięcie starego wkładu, oczyszczenie obudowy i kontrola kanałów dolotowych. Montaż nowego wkładu oraz sprawdzenie prawidłowego uszczelnienia i zamknięcia obudowy."
      },
      {
        "name": "Wymiana filtra kabinowego",
        "variants": [
          "standard",
          "węglowy / antysmogowy",
          "z czyszczeniem obudowy"
        ],
        "hours": 0.4,

        "price": 90,
        "scope": "Demontaż elementów dostępowych, wymiana filtra kabinowego, oczyszczenie komory filtra i kontrola kierunku przepływu. Montaż elementów wykończeniowych i kontrola przepływu powietrza."
      },
      {
        "name": "Wymiana filtra paliwa",
        "variants": [
          "benzyna",
          "diesel",
          "z odpowietrzeniem / procedurą serwisową"
        ],
        "hours": 0.7,

        "price": 160,
        "scope": "Demontaż zużytego filtra paliwa, kontrola przewodów i połączeń, montaż nowego filtra z zachowaniem kierunku przepływu. Odpowietrzenie lub uruchomienie pompy zgodnie z wymaganiami układu. Kontrola szczelności po uruchomieniu."
      },
      {
        "name": "Wymiana świec zapłonowych",
        "variants": [
          "4-cylindry",
          "5/6-cylindrów",
          "utrudniony dostęp"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż elementów wymaganych do dostępu, kontrola cewek i studzienek świec. Demontaż świec, ocena ich stanu, montaż nowych świec o właściwych parametrach i dokręcenie zgodnie z wymaganiami producenta. Kontrola pracy silnika."
      },
      {
        "name": "Wymiana świec żarowych",
        "variants": [
          "4-cylindry",
          "5/6-cylindrów",
          "z diagnostyką sterownika świec"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Kontrola obwodu świec żarowych, demontaż elementów dostępowych i wymiana świec z zachowaniem ostrożności wymaganej przy zapieczonych elementach. Kontrola działania układu po montażu oraz zapis ewentualnych usterek sterowania."
      },
      {
        "name": "Reset / ustawienie inspekcji serwisowej",
        "variants": [
          "olejowa",
          "przeglądowa",
          "elastyczny interwał"
        ],
        "hours": 0.2,

        "price": 50,
        "scope": "Weryfikacja wykonania uzgodnionych czynności serwisowych i ustawienie właściwego interwału serwisowego w pojeździe. Kontrola komunikatu po wykonaniu procedury."
      }
    ]
  },
  {
    "group": "Układ hamulcowy",
    "jobs": [
      {
        "name": "Wymiana klocków hamulcowych",
        "variants": [
          "oś przednia",
          "oś tylna",
          "oś tylna z EPB"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż kół i elementów niezbędnych do dostępu. Kontrola stanu tarcz, prowadnic, osłon i przewodów elastycznych. Oczyszczenie powierzchni współpracujących, kontrola swobodnego ruchu zacisku, montaż nowych klocków, cofnięcie tłoczków zgodnie z procedurą, montaż kół i dokręcenie wymaganym momentem. Kontrola poziomu płynu hamulcowego, obsługa trybu serwisowego EPB jeśli wymagana oraz próba działania układu."
      },
      {
        "name": "Wymiana tarcz i klocków hamulcowych",
        "variants": [
          "oś przednia",
          "oś tylna",
          "oś tylna z EPB"
        ],
        "hours": 1.6,

        "price": 360,
        "scope": "Demontaż kół, zacisków i jarzm. Demontaż tarcz, oczyszczenie piast i kontrola powierzchni osadzenia. Kontrola prowadnic, osłon i przewodów. Montaż nowych tarcz i klocków, zabezpieczenie oraz dokręcenie połączeń zgodnie z procedurą. Kontrola płynu hamulcowego i próba działania."
      },
      {
        "name": "Regeneracja / serwis prowadnic zacisku",
        "variants": [
          "jeden zacisk",
          "oś przednia",
          "oś tylna"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Demontaż elementów zacisku, oczyszczenie i kontrola prowadnic oraz osłon, wymiana uszkodzonych elementów przewidzianych zakresem. Zastosowanie właściwego środka montażowego, złożenie i kontrola swobodnego przesuwu zacisku."
      },
      {
        "name": "Wymiana zacisku hamulcowego",
        "variants": [
          "przód lewy",
          "przód prawy",
          "tył lewy",
          "tył prawy",
          "tył z EPB"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż zacisku, zabezpieczenie układu hydraulicznego, montaż nowego lub regenerowanego elementu, odpowietrzenie obwodu i kontrola szczelności. W wersjach z EPB wykonanie wymaganej procedury serwisowej/adaptacyjnej."
      },
      {
        "name": "Wymiana przewodu hamulcowego elastycznego",
        "variants": [
          "przód lewy",
          "przód prawy",
          "tył lewy",
          "tył prawy"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Demontaż przewodu elastycznego, kontrola połączeń i stanu przewodów sąsiednich. Montaż nowego przewodu bez skręcenia, odpowietrzenie obwodu, kontrola szczelności i działania hamulca."
      },
      {
        "name": "Wymiana przewodu hamulcowego sztywnego",
        "variants": [
          "odcinek lokalny",
          "przewód długi / podwozie"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż uszkodzonego odcinka przewodu, przygotowanie i poprowadzenie nowego przewodu z właściwymi zakończeniami i mocowaniami. Odpowietrzenie układu oraz kontrola szczelności pod ciśnieniem."
      },
      {
        "name": "Wymiana płynu hamulcowego",
        "variants": [
          "układ standardowy",
          "z procedurą ABS/ESP"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola szczelności układu. Wymiana płynu hamulcowego i odpowietrzenie obwodów w prawidłowej kolejności. W razie potrzeby uruchomienie procedury serwisowej ABS/ESP. Kontrola twardości pedału i końcowego poziomu płynu."
      },
      {
        "name": "Diagnostyka bicia / drgań przy hamowaniu",
        "variants": [
          "oś przednia",
          "oś tylna",
          "pełny układ"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola luzów piast i zawieszenia, stanu tarcz i klocków oraz powierzchni osadzenia. W razie potrzeby pomiar bicia piasty i tarczy oraz ocena różnicy grubości tarczy. Wyniki zapisano w zleceniu."
      },
      {
        "name": "Wymiana szczęk hamulcowych",
        "variants": [
          "hamulec bębnowy",
          "hamulec postojowy wewnątrz tarczy"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Demontaż bębnów lub tarcz, kontrola elementów mechanizmu, cylinderków i powierzchni ciernych. Wymiana szczęk i niezbędnych elementów montażowych, regulacja mechanizmu oraz kontrola działania hamulca roboczego i postojowego."
      },
      {
        "name": "Naprawa hamulca postojowego",
        "variants": [
          "mechaniczny",
          "elektryczny EPB"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Diagnostyka mechanizmu hamulca postojowego, kontrola linek, zacisków, silników/sterowania lub mechanizmu regulacyjnego. Naprawa lub wymiana uzgodnionych elementów oraz regulacja/adaptacja i kontrola działania."
      }
    ]
  },
  {
    "group": "Zawieszenie i układ kierowniczy",
    "jobs": [
      {
        "name": "Wymiana amortyzatorów",
        "variants": [
          "oś przednia",
          "oś tylna"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Demontaż elementów zawieszenia wymaganych do wymiany amortyzatorów. Kontrola sprężyn, odbojów, osłon i mocowań. Montaż nowych elementów, dokręcenie połączeń zgodnie z wymaganiami producenta. Kontrola geometrii lub zalecenie jej wykonania, jeśli wymiana wpływa na ustawienie kół."
      },
      {
        "name": "Wymiana sprężyny zawieszenia",
        "variants": [
          "przód lewy",
          "przód prawy",
          "oś przednia",
          "tył lewy",
          "tył prawy",
          "oś tylna"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Demontaż elementów wymaganych do wymiany sprężyny, kontrola gniazd, podkładek, amortyzatora i odboju. Montaż nowej sprężyny we właściwym położeniu i kontrola ułożenia po opuszczeniu pojazdu."
      },
      {
        "name": "Wymiana górnego mocowania amortyzatora",
        "variants": [
          "przód lewy",
          "przód prawy",
          "oś przednia"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Demontaż kolumny zawieszenia, rozprężenie sprężyny przy użyciu właściwego przyrządu, kontrola łożyska i elementów współpracujących. Montaż nowego mocowania/łożyska i złożenie kolumny. Zalecana kontrola geometrii."
      },
      {
        "name": "Wymiana wahacza",
        "variants": [
          "przód lewy",
          "przód prawy",
          "tył lewy",
          "tył prawy"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż koła i połączeń wahacza, kontrola sworzni/tulei oraz elementów sąsiednich. Montaż nowego wahacza. Połączenia tulei gumowo-metalowych dokręcane w pozycji roboczej, jeśli wymaga tego konstrukcja. Zalecana kontrola geometrii."
      },
      {
        "name": "Wymiana tulei wahacza",
        "variants": [
          "przód",
          "tył",
          "pojedyncza tuleja",
          "komplet osi"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Demontaż elementu zawieszenia w zakresie wymaganym do wymiany tulei, wyprasowanie starego i montaż nowego elementu we właściwej pozycji. Dokręcenie połączeń w pozycji roboczej, jeśli wymagane. Kontrola geometrii zalecana po naprawie."
      },
      {
        "name": "Wymiana sworznia wahacza",
        "variants": [
          "lewy",
          "prawy"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż połączenia zwrotnicy i wahacza, wymiana sworznia oraz kontrola gniazda i osłony. Montaż z właściwym momentem dokręcenia i kontrola luzów zawieszenia."
      },
      {
        "name": "Wymiana łącznika stabilizatora",
        "variants": [
          "przód lewy",
          "przód prawy",
          "oś przednia",
          "tył lewy",
          "tył prawy",
          "oś tylna"
        ],
        "hours": 0.6,

        "price": 140,
        "scope": "Demontaż zużytego łącznika stabilizatora, kontrola mocowań i gum stabilizatora, montaż nowego elementu oraz kontrola luzów i prawidłowego ułożenia."
      },
      {
        "name": "Wymiana gum stabilizatora",
        "variants": [
          "oś przednia",
          "oś tylna"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż mocowań stabilizatora w wymaganym zakresie, kontrola drążka i obejm, wymiana tulei gumowych oraz montaż elementów bez naprężeń i przesunięć."
      },
      {
        "name": "Wymiana końcówki drążka kierowniczego",
        "variants": [
          "lewa",
          "prawa"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Demontaż końcówki drążka, kontrola osłony i luzów pozostałych elementów układu kierowniczego. Montaż nowej końcówki z zachowaniem ustawienia wstępnego. Po naprawie wymagana kontrola i regulacja geometrii kół."
      },
      {
        "name": "Wymiana drążka kierowniczego",
        "variants": [
          "lewy",
          "prawy"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Demontaż końcówki i osłony przekładni, wymiana drążka osiowego, kontrola przegubu oraz szczelności przekładni. Montaż osłony i końcówki. Po naprawie wymagana geometria kół."
      },
      {
        "name": "Wymiana przekładni kierowniczej",
        "variants": [
          "mechaniczna/hydrauliczna",
          "elektryczna EPS"
        ],
        "hours": 4.0,

        "price": 880,
        "scope": "Demontaż elementów wymaganych do wyjęcia przekładni, kontrola drążków, osłon i połączeń. Montaż nowej lub regenerowanej przekładni, uzupełnienie/odpowietrzenie układu hydraulicznego lub wykonanie wymaganych adaptacji EPS. Po naprawie geometria kół."
      },
      {
        "name": "Diagnostyka luzów zawieszenia i kierowniczego",
        "variants": [
          "oś przednia",
          "oś tylna",
          "pełny pojazd"
        ],
        "hours": 0.7,

        "price": 160,
        "scope": "Kontrola elementów zawieszenia i układu kierowniczego pod obciążeniem oraz bez obciążenia. Ocena sworzni, tulei, łożysk, łączników, mocowań i przegubów. Stwierdzone luzy i zalecenia zapisano w zleceniu."
      }
    ]
  },
  {
    "group": "Piasty, łożyska i półosie",
    "jobs": [
      {
        "name": "Wymiana łożyska koła",
        "variants": [
          "przód lewy",
          "przód prawy",
          "tył lewy",
          "tył prawy",
          "piasta kompletna"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Demontaż elementów niezbędnych do uzyskania dostępu, wymiana łożyska lub zespołu piasty przy użyciu właściwych narzędzi. Kontrola czujnika ABS/pierścienia magnetycznego, dokręcenie połączeń i kontrola luzu oraz hałasu po naprawie."
      },
      {
        "name": "Wymiana przegubu zewnętrznego",
        "variants": [
          "lewy",
          "prawy"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż półosi w wymaganym zakresie, wymiana przegubu z osłoną i smarem, kontrola wieloklinów i połączeń. Montaż, dokręcenie nakrętki/piasty zgodnie z procedurą i próba drogowa."
      },
      {
        "name": "Wymiana osłony przegubu",
        "variants": [
          "zewnętrzna lewa",
          "zewnętrzna prawa",
          "wewnętrzna lewa",
          "wewnętrzna prawa"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż półosi lub przegubu w wymaganym zakresie, usunięcie starego smaru i kontrola zużycia przegubu. Montaż nowej osłony z właściwym smarem i opaskami, kontrola szczelności."
      },
      {
        "name": "Wymiana półosi napędowej",
        "variants": [
          "lewa",
          "prawa",
          "przednia",
          "tylna"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż półosi z przekładni i piasty, kontrola uszczelniaczy oraz połączeń wielowypustowych. Montaż nowej lub regenerowanej półosi, uzupełnienie ewentualnego ubytku oleju przekładniowego i kontrola szczelności."
      },
      {
        "name": "Wymiana podpory / łożyska półosi",
        "variants": [
          "prawa długa półoś",
          "wał pośredni"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Demontaż zespołu napędowego w wymaganym zakresie, wymiana łożyska lub podpory, kontrola powierzchni wału i mocowań. Montaż i kontrola pracy układu napędowego."
      }
    ]
  },
  {
    "group": "Rozrząd i osprzęt silnika",
    "jobs": [
      {
        "name": "Wymiana zestawu rozrządu",
        "variants": [
          "pasek",
          "łańcuch",
          "łańcuch wielorzędowy / rozbudowany"
        ],
        "hours": 4.0,

        "price": 880,
        "scope": "Demontaż elementów wymaganych do uzyskania dostępu, ustawienie silnika zgodnie z procedurą i zastosowanie właściwych blokad. Wymiana elementów zestawu rozrządu oraz elementów jednorazowych przewidzianych procedurą. Kontrola znaków/faz po ręcznym obrocie silnika, montaż osłon i kontrola pracy po uruchomieniu."
      },
      {
        "name": "Wymiana rozrządu z pompą cieczy",
        "variants": [
          "pasek + pompa",
          "łańcuch + pompa jeśli napędzana / dostępna"
        ],
        "hours": 4.5,

        "price": 990,
        "scope": "Wymiana kompletnego napędu rozrządu oraz pompy cieczy chłodzącej w zakresie uzgodnionym. Zastosowanie blokad i procedury ustawienia faz, wymiana wymaganych uszczelnień/śrub jednorazowych, napełnienie i odpowietrzenie układu chłodzenia oraz kontrola pracy silnika."
      },
      {
        "name": "Kontrola / ustawienie faz rozrządu",
        "variants": [
          "pasek",
          "łańcuch",
          "z pomiarem korelacji wał/wałek"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Ustawienie silnika w położeniu kontrolnym, zastosowanie właściwych blokad lub danych diagnostycznych, weryfikacja położenia wału i wałków. W razie zakresu regulacyjnego wykonanie korekty i ponowna kontrola po obrocie silnika."
      },
      {
        "name": "Wymiana paska osprzętu",
        "variants": [
          "pasek",
          "pasek + napinacz/rolki"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Kontrola przebiegu paska, rolek, napinacza i kół pasowych. Demontaż zużytych elementów, montaż nowych zgodnie z kierunkiem/prowadzeniem. Kontrola prawidłowego ułożenia i pracy po uruchomieniu."
      },
      {
        "name": "Wymiana napinacza / rolki paska osprzętu",
        "variants": [
          "napinacz",
          "rolka prowadząca",
          "komplet"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż paska osprzętu, kontrola kół pasowych i pozostałych rolek, wymiana napinacza lub rolki. Montaż paska i kontrola toru oraz stabilności pracy po uruchomieniu."
      },
      {
        "name": "Wymiana koła pasowego wału korbowego",
        "variants": [
          "tłumik drgań",
          "koło sztywne"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Demontaż paska osprzętu i koła pasowego, kontrola mocowania i powierzchni współpracujących. Montaż nowego elementu z zachowaniem wymaganej procedury dokręcania oraz kontrola bicia i pracy paska."
      },
      {
        "name": "Wymiana sprzęgiełka alternatora",
        "variants": [
          "wolne koło",
          "koło pasowe alternatora"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż paska osprzętu, blokowanie wirnika właściwym narzędziem, wymiana sprzęgiełka/koła alternatora. Kontrola napinacza i prowadzenia paska po montażu."
      }
    ]
  },
  {
    "group": "Silnik – uszczelnienia i osprzęt",
    "jobs": [
      {
        "name": "Wymiana uszczelki pokrywy zaworów",
        "variants": [
          "standard",
          "pokrywa zintegrowana / separator"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż elementów dostępowych i pokrywy, oczyszczenie powierzchni uszczelniających bez uszkodzeń, kontrola odmy i pokrywy. Montaż nowej uszczelki lub kompletnej pokrywy zgodnie z procedurą i kontrola szczelności."
      },
      {
        "name": "Wymiana uszczelniacza wału korbowego",
        "variants": [
          "przód",
          "tył od strony skrzyni"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Demontaż elementów wymaganych do uzyskania dostępu, usunięcie starego uszczelniacza bez uszkodzenia powierzchni wału, montaż nowego elementu właściwą metodą. Kontrola szczelności po naprawie."
      },
      {
        "name": "Wymiana uszczelniacza wałka rozrządu",
        "variants": [
          "ssący",
          "wydechowy",
          "komplet"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Demontaż wymaganych elementów rozrządu/osprzętu, wymiana uszczelniacza i kontrola powierzchni wałka. Ponowne ustawienie elementów zgodnie z procedurą i kontrola szczelności."
      },
      {
        "name": "Wymiana miski olejowej / uszczelnienie",
        "variants": [
          "miska stalowa",
          "miska aluminiowa",
          "uszczelnienie masą"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Spuszczenie oleju, demontaż miski i elementów kolidujących, oczyszczenie powierzchni uszczelniających. Montaż z nową uszczelką lub właściwą masą, zachowanie czasu wiązania, napełnienie olejem i kontrola szczelności."
      },
      {
        "name": "Wymiana pompy oleju",
        "variants": [
          "mechaniczna",
          "moduł pompy / wałki wyrównoważające"
        ],
        "hours": 4.0,

        "price": 880,
        "scope": "Demontaż miski i elementów dostępowych, kontrola smoka, napędu i stanu oleju. Montaż nowej pompy/modułu, zalanie/priming zgodnie z wymaganiami, napełnienie olejem i kontrola ciśnienia smarowania po uruchomieniu."
      },
      {
        "name": "Pomiar ciśnienia oleju",
        "variants": [
          "na zimno i ciepło",
          "pod obciążeniem"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Podłączenie manometru w odpowiednim punkcie układu, pomiar ciśnienia przy wymaganych temperaturach i prędkościach obrotowych. Porównanie z danymi producenta i zapis wyniku diagnostycznego."
      },
      {
        "name": "Wymiana poduszki silnika / skrzyni",
        "variants": [
          "silnik lewa",
          "silnik prawa",
          "dolna / reakcyjna",
          "skrzynia"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Podparcie zespołu napędowego, demontaż zużytego mocowania i kontrola sąsiednich poduszek. Montaż nowego elementu bez naprężeń oraz kontrola drgań i przemieszczeń zespołu napędowego."
      }
    ]
  },
  {
    "group": "Silnik – głowica i remont",
    "jobs": [
      {
        "name": "Pomiar kompresji",
        "variants": [
          "benzyna",
          "diesel"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Przygotowanie silnika do pomiaru, odłączenie układów wymaganych dla bezpiecznego testu i pomiar ciśnienia sprężania na wszystkich cylindrach. Wyniki porównano między cylindrami oraz z danymi referencyjnymi, jeśli dostępne."
      },
      {
        "name": "Próba szczelności cylindrów leak-down",
        "variants": [
          "benzyna",
          "diesel"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Ustawienie badanego cylindra w wymaganym położeniu i wykonanie próby szczelności sprężonym powietrzem. Ocena wielkości przecieku oraz kierunku ucieczki przez dolot, wydech, skrzynię korbową lub układ chłodzenia."
      },
      {
        "name": "Demontaż i montaż głowicy",
        "variants": [
          "silnik rzędowy",
          "V / jedna głowica"
        ],
        "hours": 8.0,

        "price": 1760,
        "scope": "Demontaż osprzętu, rozrządu i głowicy zgodnie z procedurą. Kontrola powierzchni bloku i elementów współpracujących. Montaż przygotowanej głowicy z nowymi uszczelnieniami i elementami jednorazowymi, ustawienie rozrządu, napełnienie płynów i kontrola pracy silnika."
      },
      {
        "name": "Wymiana uszczelki pod głowicą",
        "variants": [
          "silnik benzynowy",
          "silnik diesel"
        ],
        "hours": 10.0,

        "price": 2200,
        "scope": "Demontaż głowicy, weryfikacja powierzchni i przyczyny uszkodzenia, montaż odpowiedniej uszczelki oraz nowych elementów jednorazowych. Ustawienie rozrządu, wymiana/uzupełnienie płynów i kontrola szczelności oraz parametrów pracy po naprawie."
      },
      {
        "name": "Remont głowicy – obsługa warsztatowa",
        "variants": [
          "demontaż/montaż + zewnętrzna obróbka",
          "pełna obsługa z kontrolą zaworów"
        ],
        "hours": 12.0,

        "price": 2640,
        "scope": "Demontaż głowicy i przekazanie do uzgodnionej obróbki/naprawy. Po odbiorze kontrola kompletności, montaż z nowymi uszczelnieniami i elementami wymaganymi procedurą, ustawienie rozrządu oraz kontrola pracy silnika po naprawie."
      },
      {
        "name": "Wymiana pierścieni tłokowych / remont dołu",
        "variants": [
          "4-cylindry",
          "6-cylindrów"
        ],
        "hours": 20.0,

        "price": 4400,
        "scope": "Demontaż silnika lub zakresu umożliwiającego dostęp do zespołu tłokowo-korbowego, pomiary i ocena stanu cylindrów, tłoków oraz panewek. Wymiana uzgodnionych elementów, montaż zgodnie z wymaganymi luzami i momentami, zalanie płynami oraz kontrola parametrów po uruchomieniu."
      },
      {
        "name": "Wymiana panewek korbowodowych",
        "variants": [
          "komplet 4-cylindry",
          "komplet 6-cylindrów"
        ],
        "hours": 6.0,

        "price": 1320,
        "scope": "Demontaż miski i dostęp do stóp korbowodów, kontrola czopów wału oraz pomiar/ocena luzu olejowego w zakresie uzgodnionym. Montaż nowych panewek i śrub jeśli wymagane, złożenie układu i kontrola ciśnienia oleju."
      },
      {
        "name": "Demontaż / montaż silnika",
        "variants": [
          "FWD",
          "RWD",
          "AWD / utrudniony dostęp"
        ],
        "hours": 12.0,

        "price": 2640,
        "scope": "Odłączenie instalacji, układów płynowych i elementów przeniesienia napędu, bezpieczny demontaż zespołu napędowego. Po wykonaniu uzgodnionych prac montaż, napełnienie płynów, odpowietrzenie wymaganych układów i kontrola działania."
      }
    ]
  },
  {
    "group": "Układ chłodzenia",
    "jobs": [
      {
        "name": "Diagnostyka układu chłodzenia",
        "variants": [
          "próba ciśnieniowa",
          "diagnostyka przegrzewania",
          "test obecności gazów spalinowych"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola poziomu i jakości płynu, szczelności, pracy wentylatorów, termostatu i obiegu. W zależności od zakresu wykonanie próby ciśnieniowej lub testu obecności gazów spalinowych. Wyniki i stwierdzone nieprawidłowości zapisano w zleceniu."
      },
      {
        "name": "Wymiana termostatu",
        "variants": [
          "standard",
          "z obudową / modułem",
          "elektronicznie sterowany"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Spuszczenie wymaganej ilości płynu chłodzącego, demontaż elementów dostępowych i termostatu, oczyszczenie powierzchni uszczelniających, montaż nowego elementu. Napełnienie i odpowietrzenie układu zgodnie z procedurą. Kontrola temperatury pracy i szczelności."
      },
      {
        "name": "Wymiana pompy cieczy chłodzącej",
        "variants": [
          "mechaniczna",
          "elektryczna",
          "moduł pompa + termostat"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Opróżnienie układu w wymaganym zakresie, demontaż elementów dostępowych i pompy, kontrola powierzchni uszczelniających. Montaż nowej pompy, napełnienie/odpowietrzenie układu, kontrola szczelności i temperatury pracy."
      },
      {
        "name": "Wymiana chłodnicy silnika",
        "variants": [
          "standard",
          "z demontażem pasa przedniego"
        ],
        "hours": 3.0,

        "price": 660,
        "scope": "Spuszczenie płynu, demontaż elementów wymaganych do wyjęcia chłodnicy, kontrola przewodów i mocowań. Montaż nowej chłodnicy, napełnienie i odpowietrzenie układu oraz kontrola szczelności i pracy wentylatorów."
      },
      {
        "name": "Wymiana nagrzewnicy",
        "variants": [
          "deska częściowo demontowana",
          "deska pełny demontaż"
        ],
        "hours": 6.0,

        "price": 1320,
        "scope": "Opróżnienie układu chłodzenia w wymaganym zakresie, demontaż elementów wnętrza i obudowy HVAC niezbędnych do wymiany nagrzewnicy. Montaż nowego elementu, złożenie wnętrza, napełnienie/odpowietrzenie układu i kontrola szczelności oraz ogrzewania."
      },
      {
        "name": "Wymiana zbiorniczka wyrównawczego",
        "variants": [
          "standard",
          "z czujnikiem poziomu"
        ],
        "hours": 0.6,

        "price": 140,
        "scope": "Opróżnienie układu w niezbędnym zakresie, wymiana zbiorniczka i kontrola przewodów oraz korka. Uzupełnienie płynu, odpowietrzenie i kontrola szczelności."
      },
      {
        "name": "Wymiana przewodu układu chłodzenia",
        "variants": [
          "górny/dolny chłodnicy",
          "króciec / przewód silnika",
          "przewód nagrzewnicy"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Demontaż uszkodzonego przewodu/króćca, kontrola powierzchni połączeń i opasek. Montaż nowego elementu, napełnienie oraz odpowietrzenie układu i kontrola szczelności."
      }
    ]
  },
  {
    "group": "Dolot, turbo i doładowanie",
    "jobs": [
      {
        "name": "Diagnostyka braku mocy / doładowania",
        "variants": [
          "benzyna turbo",
          "diesel turbo"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odczyt usterek i parametrów bieżących, porównanie wartości zadanych i rzeczywistych doładowania, kontrola szczelności dolotu oraz sterowania turbosprężarką. W razie potrzeby wykonanie dodatkowych pomiarów podciśnienia, ciśnienia lub sygnałów sterujących."
      },
      {
        "name": "Próba szczelności układu dolotowego",
        "variants": [
          "dym / smoke test",
          "ciśnieniowa"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Zaślepienie układu w wymaganym zakresie i wykonanie kontrolowanej próby szczelności. Lokalizacja nieszczelności przewodów, intercoolera, połączeń, uszczelnień lub elementów dolotu. Wynik zapisano w zleceniu."
      },
      {
        "name": "Wymiana turbosprężarki",
        "variants": [
          "benzyna",
          "diesel",
          "turbo + przygotowanie układu olejowego"
        ],
        "hours": 4.5,

        "price": 990,
        "scope": "Demontaż osprzętu i turbosprężarki, kontrola przewodów olejowych, dolotu, intercoolera i przyczyny uszkodzenia. Montaż nowej/regenerowanej turbosprężarki z nowymi uszczelnieniami, przygotowanie układu smarowania, kontrola szczelności i parametrów doładowania."
      },
      {
        "name": "Wymiana intercoolera",
        "variants": [
          "przód",
          "boczny",
          "wodny chargecooler"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Demontaż elementów dostępowych, przewodów i intercoolera. Kontrola obecności oleju/zanieczyszczeń i przewodów ciśnieniowych. Montaż nowego elementu i kontrola szczelności układu doładowania."
      },
      {
        "name": "Wymiana przewodu doładowania",
        "variants": [
          "gorąca strona",
          "zimna strona",
          "przewód turbo-intercooler"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Demontaż uszkodzonego przewodu, kontrola szybkozłączy, uszczelek i sąsiednich przewodów. Montaż nowego elementu i kontrola szczelności pod obciążeniem lub w próbie stacjonarnej."
      },
      {
        "name": "Czyszczenie przepustnicy",
        "variants": [
          "benzyna",
          "diesel / klapa gasząca"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Demontaż przepustnicy lub dostęp do elementu, oczyszczenie kanału i przepustnicy odpowiednią metodą bez uszkodzenia elektroniki. Montaż z nową uszczelką jeśli wymagana oraz wykonanie adaptacji, jeśli przewiduje ją sterownik."
      },
      {
        "name": "Czyszczenie kolektora dolotowego",
        "variants": [
          "benzyna",
          "diesel z nagarem",
          "z demontażem klap wirowych"
        ],
        "hours": 4.0,

        "price": 880,
        "scope": "Demontaż kolektora dolotowego, mechaniczne/chemiczne usunięcie nagaru w uzgodnionym zakresie, kontrola klap, osi i uszczelnień. Montaż z nowymi uszczelnieniami oraz kontrola szczelności dolotu."
      },
      {
        "name": "Czyszczenie zaworów dolotowych",
        "variants": [
          "walnut blasting / bezpośredni wtrysk",
          "manualne po demontażu kolektora"
        ],
        "hours": 5.0,

        "price": 1100,
        "scope": "Demontaż kolektora, ustawianie zaworów w pozycji zamkniętej i usunięcie osadów z kanałów/zaworów bez wprowadzania zanieczyszczeń do cylindrów. Oczyszczenie, montaż kolektora z uszczelnieniami i kontrola pracy silnika."
      }
    ]
  },
  {
    "group": "Paliwo – benzyna",
    "jobs": [
      {
        "name": "Diagnostyka układu paliwowego benzyna",
        "variants": [
          "MPI",
          "GDI/FSI/TSI"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Odczyt parametrów mieszanki i ciśnienia paliwa, kontrola korekt, zasilania pompy oraz pracy wtryskiwaczy w zakresie potrzebnym do diagnozy. W układach bezpośredniego wtrysku uwzględniono stronę niskiego i wysokiego ciśnienia."
      },
      {
        "name": "Wymiana pompy paliwa w zbiorniku",
        "variants": [
          "moduł kompletny",
          "wkład pompy"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Uzyskanie dostępu do zbiornika/modułu, zabezpieczenie układu, wymiana pompy lub kompletnego modułu. Kontrola uszczelnienia, wskazania poziomu paliwa oraz ciśnienia po uruchomieniu."
      },
      {
        "name": "Wymiana pompy wysokiego ciśnienia benzyna",
        "variants": [
          "GDI/FSI/TSI",
          "z kontrolą popychacza / krzywki"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Rozładowanie ciśnienia paliwa, demontaż pompy wysokiego ciśnienia i kontrola elementu napędowego w zakresie konstrukcji. Montaż nowej pompy z wymaganymi uszczelnieniami, odpowietrzenie i kontrola ciśnienia rzeczywistego."
      },
      {
        "name": "Wymiana wtryskiwacza benzynowego",
        "variants": [
          "MPI",
          "GDI bez kodowania",
          "GDI z kalibracją/kodowaniem"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Demontaż listwy lub elementów wymaganych do dostępu, wymiana wtryskiwacza i uszczelnień. W układach bezpośrednich zastosowanie właściwej procedury montażu uszczelnień oraz kodowanie/kalibracja, jeśli wymagane. Kontrola szczelności."
      },
      {
        "name": "Test / czyszczenie wtryskiwaczy benzynowych",
        "variants": [
          "na pojeździe",
          "demontaż do testu zewnętrznego"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Ocena pracy wtryskiwaczy na podstawie parametrów i testów dostępnych w pojeździe. W przypadku demontażu przygotowanie elementów do testu/czyszczenia zewnętrznego oraz montaż z nowymi uszczelnieniami po wykonanej usłudze."
      }
    ]
  },
  {
    "group": "Paliwo – Diesel / Common Rail",
    "jobs": [
      {
        "name": "Diagnostyka układu Common Rail",
        "variants": [
          "rozruch / brak ciśnienia",
          "nierówna praca",
          "brak mocy"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odczyt ciśnienia rail zadanego i rzeczywistego, korekt wtrysku i parametrów rozruchowych, kontrola zasilania niskiego ciśnienia oraz regulatorów. Dalsze pomiary wykonano zgodnie z objawem i wynikami wstępnymi."
      },
      {
        "name": "Próba przelewowa wtryskiwaczy",
        "variants": [
          "4 cylindry",
          "5/6 cylindrów"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Podłączenie zestawu pomiarowego do przelewów wtryskiwaczy i wykonanie testu w ustalonych warunkach. Porównanie ilości paliwa między wtryskiwaczami i zapis wyniku diagnostycznego."
      },
      {
        "name": "Wymiana wtryskiwacza Common Rail",
        "variants": [
          "1 sztuka",
          "komplet",
          "z kodowaniem IMA/ISA/C2I"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Oczyszczenie obszaru, demontaż wtryskiwacza i uszczelnienia, kontrola gniazda. Montaż wtryskiwacza z nowymi elementami uszczelniającymi i mocującymi. Wprowadzenie kodu korekcyjnego/adaptacji, jeśli wymagane, oraz kontrola szczelności i pracy."
      },
      {
        "name": "Uszczelnienie wtryskiwacza diesel",
        "variants": [
          "1 sztuka",
          "kilka sztuk"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Demontaż wtryskiwacza, oczyszczenie i przygotowanie gniazda w zakresie wymaganym do prawidłowego uszczelnienia. Montaż nowej podkładki/uszczelnienia i elementów mocujących, kontrola przedmuchów po uruchomieniu."
      },
      {
        "name": "Wymiana pompy wysokiego ciśnienia diesel",
        "variants": [
          "Common Rail",
          "z płukaniem układu po opiłkach"
        ],
        "hours": 4.0,

        "price": 880,
        "scope": "Demontaż pompy wysokiego ciśnienia, kontrola układu paliwowego i filtracji. Montaż nowej/regenerowanej pompy. Jeśli stwierdzono zanieczyszczenia metaliczne, zakres płukania/wymiany elementów wykonywany zgodnie z osobnym uzgodnieniem. Odpowietrzenie i kontrola ciśnienia."
      },
      {
        "name": "Wymiana regulatora ciśnienia / zaworu dawkującego",
        "variants": [
          "na pompie",
          "na listwie"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Diagnostyczne potwierdzenie nieprawidłowej regulacji w wymaganym zakresie, demontaż regulatora, kontrola zanieczyszczeń i montaż nowego elementu. Odpowietrzenie układu i kontrola ciśnienia rzeczywistego."
      }
    ]
  },
  {
    "group": "EGR, DPF/GPF i emisje spalin",
    "jobs": [
      {
        "name": "Diagnostyka układu EGR",
        "variants": [
          "benzyna",
          "diesel"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Odczyt usterek i parametrów sterowania EGR, kontrola wartości zadanych/rzeczywistych, zasilania i mechaniki zaworu w wymaganym zakresie. Wnioski dotyczą przywrócenia prawidłowego działania układu emisji."
      },
      {
        "name": "Wymiana zaworu EGR",
        "variants": [
          "standard",
          "EGR z chłodnicą"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Demontaż elementów dostępowych i zaworu EGR, kontrola kanałów i uszczelnień. Montaż nowego elementu, uzupełnienie/odpowietrzenie płynu jeśli dotyczy chłodnicy EGR, wykonanie adaptacji i kontrola działania."
      },
      {
        "name": "Czyszczenie zaworu / kanałów EGR",
        "variants": [
          "zawór",
          "zawór + kanały/kolektor"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Demontaż elementów EGR, usunięcie osadów w zakresie możliwym bez uszkodzenia mechanizmu i elektroniki, kontrola ruchu zaworu i kanałów. Montaż z nowymi uszczelnieniami oraz kontrola wartości sterowania."
      },
      {
        "name": "Diagnostyka DPF",
        "variants": [
          "stopień zapełnienia",
          "częste regeneracje",
          "brak możliwości regeneracji"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Odczyt masy sadzy/popielnika, różnicy ciśnień, temperatur i historii regeneracji, kontrola czujników i warunków umożliwiających regenerację. Ocena przyczyny problemu przed podjęciem dalszej naprawy."
      },
      {
        "name": "Regeneracja serwisowa DPF",
        "variants": [
          "statyczna sterowana testerem",
          "jazda serwisowa / dynamiczna"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Weryfikacja warunków bezpieczeństwa i przyczyny zapełnienia filtra. Uruchomienie procedury regeneracji zgodnie z możliwościami sterownika lub wykonanie kontrolowanej jazdy serwisowej. Kontrola temperatur, różnicy ciśnień i stopnia zapełnienia po procedurze."
      },
      {
        "name": "Demontaż / montaż DPF do czyszczenia",
        "variants": [
          "DPF",
          "DPF + katalizator moduł"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Demontaż zespołu filtra cząstek stałych i przygotowanie do czyszczenia zewnętrznego. Po wykonaniu usługi montaż z nowymi uszczelnieniami/elementami mocującymi, kontrola szczelności i parametrów różnicy ciśnień."
      },
      {
        "name": "Wymiana czujnika różnicy ciśnień DPF",
        "variants": [
          "czujnik",
          "czujnik + przewody"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Kontrola przewodów ciśnieniowych, demontaż czujnika i montaż nowego elementu. W razie potrzeby wykonanie adaptacji/zerowania oraz kontrola wskazań przy wyłączonym i pracującym silniku."
      },
      {
        "name": "Wymiana sondy lambda / NOx / temperatury spalin",
        "variants": [
          "lambda",
          "NOx",
          "EGT przed turbo",
          "EGT przed/za DPF"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Diagnostyczne potwierdzenie nieprawidłowego sygnału w wymaganym zakresie, demontaż czujnika z zachowaniem ochrony gwintu i instalacji, montaż nowego elementu oraz kontrola sygnału/adaptacji po naprawie."
      },
      {
        "name": "Diagnostyka SCR / AdBlue",
        "variants": [
          "usterka dozowania",
          "NOx / wydajność SCR",
          "brak rozruchu za X km"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odczyt usterek i parametrów układu SCR, kontrola poziomu/jakości czynnika, pracy pompy, ciśnienia, dozownika i czujników NOx w zakresie wymaganym do ustalenia przyczyny. Naprawa ma na celu przywrócenie prawidłowego działania systemu emisji."
      }
    ]
  },
  {
    "group": "Wydech",
    "jobs": [
      {
        "name": "Wymiana tłumika",
        "variants": [
          "końcowy",
          "środkowy",
          "komplet sekcji"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Demontaż uszkodzonego odcinka układu wydechowego, kontrola wieszaków, obejm i połączeń. Montaż nowego elementu bez naprężeń, ustawienie prześwitów i kontrola szczelności po uruchomieniu."
      },
      {
        "name": "Wymiana elastycznego łącznika wydechu",
        "variants": [
          "spawany",
          "skręcany"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż lub wycięcie uszkodzonego łącznika, przygotowanie powierzchni i montaż nowego elementu właściwą metodą. Kontrola położenia układu i szczelności połączenia."
      },
      {
        "name": "Uszczelnienie połączenia wydechu",
        "variants": [
          "kołnierz",
          "obejma",
          "uszczelka kolektora / turbiny"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Lokalizacja miejsca nieszczelności, demontaż połączenia w wymaganym zakresie, oczyszczenie powierzchni i wymiana uszczelnienia/elementów mocujących. Kontrola szczelności po naprawie."
      },
      {
        "name": "Wymiana kolektora wydechowego",
        "variants": [
          "benzyna",
          "diesel"
        ],
        "hours": 3.0,

        "price": 660,
        "scope": "Demontaż osłon i osprzętu niezbędnego do dostępu, wymiana kolektora i uszczelnień, kontrola szpilek/mocowań. Montaż z właściwą kolejnością i momentem dokręcania oraz kontrola szczelności."
      }
    ]
  },
  {
    "group": "Sprzęgło i skrzynia manualna",
    "jobs": [
      {
        "name": "Wymiana sprzęgła",
        "variants": [
          "sprzęgło",
          "sprzęgło + koło dwumasowe",
          "sprzęgło + wysprzęglik CSC"
        ],
        "hours": 6.0,

        "price": 1320,
        "scope": "Demontaż skrzyni biegów i elementów wymaganych do dostępu. Kontrola wycieków, łożyskowania i elementów sterowania. Wymiana zestawu sprzęgła oraz koła dwumasowego/wysprzęglika, jeśli przewidziano. Montaż skrzyni, uzupełnienie płynów, odpowietrzenie i próba drogowa."
      },
      {
        "name": "Wymiana koła dwumasowego",
        "variants": [
          "z istniejącym sprzęgłem",
          "z kompletem sprzęgła"
        ],
        "hours": 6.0,

        "price": 1320,
        "scope": "Demontaż skrzyni i sprzęgła, kontrola uszczelniacza wału i elementów sterowania. Wymiana koła dwumasowego i wymaganych śrub, montaż sprzęgła zgodnie z zakresem i kontrola pracy po naprawie."
      },
      {
        "name": "Wymiana wysprzęglika",
        "variants": [
          "zewnętrzny",
          "centralny CSC – demontaż skrzyni"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Demontaż elementów wymaganych do wymiany wysprzęglika, montaż nowego elementu i odpowietrzenie układu hydraulicznego. W wersji centralnej zakres obejmuje demontaż/montaż skrzyni biegów."
      },
      {
        "name": "Wymiana linki / mechanizmu zmiany biegów",
        "variants": [
          "linki",
          "wybierak",
          "regulacja linek"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Diagnostyka mechanizmu wyboru biegów, demontaż zużytych linek/wybieraka lub wykonanie regulacji. Kontrola pełnego zakresu ruchu i poprawności wyboru wszystkich przełożeń."
      },
      {
        "name": "Wymiana oleju w skrzyni manualnej",
        "variants": [
          "standard",
          "z korkiem/przelewem kontrolnym"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Spuszczenie oleju przekładniowego, kontrola korków i obecności zanieczyszczeń, napełnienie olejem o właściwej specyfikacji i do właściwego poziomu. Kontrola szczelności."
      },
      {
        "name": "Demontaż / montaż skrzyni manualnej",
        "variants": [
          "FWD",
          "RWD",
          "AWD"
        ],
        "hours": 6.0,

        "price": 1320,
        "scope": "Odłączenie elementów sterowania, półosi/wału, mocowań i instalacji w wymaganym zakresie. Demontaż skrzyni, a po wykonaniu uzgodnionych prac ponowny montaż, uzupełnienie płynu i kontrola działania."
      }
    ]
  },
  {
    "group": "Skrzynie automatyczne / DSG",
    "jobs": [
      {
        "name": "Wymiana oleju w skrzyni automatycznej",
        "variants": [
          "statyczna",
          "z filtrem/miską",
          "dynamiczna jeśli przewidziana"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Identyfikacja typu przekładni i wymaganej specyfikacji oleju. Spuszczenie oleju w zakresie metody, wymiana filtra/uszczelek jeśli przewidziano, napełnienie i ustawienie poziomu przy wymaganej temperaturze. Kontrola wycieków i pracy przekładni."
      },
      {
        "name": "Serwis DSG",
        "variants": [
          "DQ200",
          "DQ250",
          "DQ381/DQ500",
          "inna DSG/S tronic"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Wykonanie serwisu olejowego zgodnie z konstrukcją skrzyni: wymiana oleju i filtra, jeśli występuje, ustawienie poziomu w wymaganej temperaturze oraz kontrola błędów i podstawowych parametrów pracy."
      },
      {
        "name": "Adaptacja skrzyni DSG / automatycznej",
        "variants": [
          "sprzęgła",
          "mechatronika",
          "wartości podstawowe po serwisie"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola warunków wstępnych i pamięci usterek, wykonanie przewidzianych przez sterownik wartości podstawowych/adaptacji. Kontrola zakończenia procedury i, jeśli wymagane, jazda adaptacyjna."
      },
      {
        "name": "Diagnostyka skrzyni automatycznej",
        "variants": [
          "szarpanie",
          "brak biegu",
          "błędy ciśnienia / poślizgu"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odczyt usterek i parametrów skrzyni, analiza prędkości wejściowych/wyjściowych, ciśnień, temperatur, wartości adaptacyjnych i poślizgów w zakresie dostępnych danych. W razie potrzeby próba drogowa z logowaniem."
      },
      {
        "name": "Wymiana mechatroniki DSG",
        "variants": [
          "DQ200",
          "DQ250",
          "DQ381/DQ500"
        ],
        "hours": 5.0,

        "price": 1100,
        "scope": "Demontaż mechatroniki zgodnie z procedurą, kontrola stanu oleju i złączy. Montaż nowej/regenerowanej jednostki, napełnienie oleju jeśli wymagane, kodowanie/parametryzacja/adaptacja zgodnie z zakresem oraz kontrola pracy przekładni."
      },
      {
        "name": "Wymiana sprzęgieł DSG",
        "variants": [
          "DQ200 suche",
          "DQ250 mokre",
          "DQ381/DQ500"
        ],
        "hours": 7.0,

        "price": 1540,
        "scope": "Demontaż elementów wymaganych do dostępu i zespołu sprzęgieł, kontrola elementów współpracujących. Montaż nowego zestawu z wymaganymi nastawami mechanicznymi, wykonanie adaptacji i jazdy kontrolnej."
      }
    ]
  },
  {
    "group": "Napęd 4x4 / wały / mosty",
    "jobs": [
      {
        "name": "Wymiana oleju Haldex",
        "variants": [
          "Gen 4",
          "Gen 5",
          "inna generacja"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Spuszczenie oleju sprzęgła wielopłytkowego, wymiana/oczyszczenie filtra lub sitka pompy w zakresie konstrukcji, napełnienie właściwym olejem. Kontrola błędów i działania pompy."
      },
      {
        "name": "Wymiana pompy Haldex",
        "variants": [
          "pompa",
          "pompa + czyszczenie sitka"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Demontaż pompy sprzęgła Haldex, kontrola zanieczyszczeń i złącza. Montaż nowego elementu, napełnienie/uzupełnienie oleju, uruchomienie/test pompy testerem i kontrola błędów."
      },
      {
        "name": "Wymiana oleju w dyferencjale",
        "variants": [
          "przód",
          "tył",
          "centralny"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Spuszczenie oleju przekładniowego, kontrola korków i obecności opiłków, napełnienie właściwą ilością/specyfikacją oleju oraz kontrola szczelności."
      },
      {
        "name": "Wymiana podpory wału napędowego",
        "variants": [
          "jedna podpora",
          "komplet"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Oznaczenie wzajemnego położenia elementów, demontaż wału w wymaganym zakresie, wymiana podpory/łożyska i kontrola przegubów. Montaż z zachowaniem ustawienia i kontrola drgań podczas próby."
      },
      {
        "name": "Wymiana przegubu wału",
        "variants": [
          "elastyczny",
          "CV"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Demontaż wału lub jego odcinka, wymiana przegubu/elastycznego łącznika, kontrola mocowań i podpór. Montaż zgodnie z oznaczeniami i kontrola drgań/hałasu."
      }
    ]
  },
  {
    "group": "Rozrusznik, alternator i ładowanie",
    "jobs": [
      {
        "name": "Diagnostyka układu ładowania",
        "variants": [
          "12 V",
          "smart charging / LIN"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Pomiar napięcia i spadków napięcia, kontrola prądu ładowania i sygnałów sterujących alternatora w zależności od konstrukcji. Ocena stanu akumulatora, połączeń masowych i komunikacji sterownika ładowania."
      },
      {
        "name": "Wymiana alternatora",
        "variants": [
          "standard",
          "utrudniony dostęp"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Odłączenie akumulatora zgodnie z wymaganiami, demontaż paska i alternatora, kontrola przewodów oraz napędu. Montaż nowego/regenerowanego alternatora i kontrola napięcia/prądu ładowania."
      },
      {
        "name": "Wymiana rozrusznika",
        "variants": [
          "standard",
          "utrudniony dostęp"
        ],
        "hours": 1.8,

        "price": 400,
        "scope": "Odłączenie zasilania, demontaż rozrusznika i kontrola przewodów zasilających/masowych. Montaż nowego/regenerowanego elementu oraz kontrola spadków napięcia i prędkości rozruchowej."
      },
      {
        "name": "Test akumulatora",
        "variants": [
          "12 V",
          "AGM/EFB",
          "z raportem"
        ],
        "hours": 0.4,

        "price": 90,
        "scope": "Kontrola napięcia spoczynkowego, test przewodności/zdolności rozruchowej odpowiednim testerem oraz ocena wyniku w odniesieniu do typu i parametrów akumulatora. W razie potrzeby kontrola ładowania."
      },
      {
        "name": "Wymiana i rejestracja akumulatora",
        "variants": [
          "standard",
          "AGM/EFB z rejestracją BMS"
        ],
        "hours": 0.6,

        "price": 140,
        "scope": "Podtrzymanie lub bezpieczne odłączenie instalacji, wymiana akumulatora z kontrolą mocowania i zacisków. W pojazdach z BMS wykonanie rejestracji/kodowania typu i pojemności, jeśli wymagane."
      },
      {
        "name": "Naprawa przewodu masowego / zasilającego",
        "variants": [
          "masa silnika",
          "masa nadwozia",
          "przewód B+"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Pomiar spadku napięcia pod obciążeniem, lokalizacja połączenia o zwiększonej rezystancji, naprawa lub wymiana przewodu/złącza. Zabezpieczenie połączeń i ponowny pomiar po naprawie."
      }
    ]
  },
  {
    "group": "Diagnostyka komputerowa i pomiarowa",
    "jobs": [
      {
        "name": "Diagnostyka komputerowa",
        "variants": [
          "podstawowa",
          "rozszerzona",
          "pełny autoscan + analiza"
        ],
        "hours": 0.5,

        "price": 110,
        "scope": "Identyfikacja sterowników, odczyt pamięci usterek i podstawowych danych bieżących. Ocena błędów w kontekście zgłoszonego objawu. Sam odczyt kodów usterek nie stanowi potwierdzenia uszkodzenia konkretnej części."
      },
      {
        "name": "Diagnostyka oscyloskopowa",
        "variants": [
          "1–2 sygnały",
          "wielokanałowa",
          "korelacja wał/wałek"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Dobór punktów pomiarowych, rejestracja przebiegów i ocena sygnałów w warunkach występowania usterki. Porównanie synchronizacji, kształtu i amplitudy z oczekiwanym działaniem. Zapis wniosków diagnostycznych w zleceniu."
      },
      {
        "name": "Diagnostyka instalacji elektrycznej",
        "variants": [
          "obwód zasilania/masy",
          "CAN/LIN",
          "usterka okresowa"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Weryfikacja zasilania, mas, spadków napięcia, ciągłości i obciążenia obwodu w zakresie wymaganym do znalezienia przyczyny. W przypadku magistrali komunikacyjnej kontrola parametrów elektrycznych i komunikacji sterowników."
      },
      {
        "name": "Diagnostyka CAN",
        "variants": [
          "brak komunikacji",
          "błędy sporadyczne",
          "analiza oscyloskopowa magistrali"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Wykonanie autoskanu i identyfikacja sterowników niedostępnych, pomiar rezystancji i napięć magistrali oraz, jeśli wymagane, obserwacja przebiegów CAN oscyloskopem. Lokalizacja zwarcia, przerwy lub sterownika zakłócającego w zakresie uzgodnionej diagnostyki."
      },
      {
        "name": "Diagnostyka poboru prądu na postoju",
        "variants": [
          "pomiar podstawowy",
          "z rejestracją długookresową"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Pomiar poboru prądu po przejściu pojazdu w stan uśpienia, obserwacja zmian w czasie i lokalizacja obwodu metodą bezpieczników lub pomiarów spadku napięcia. W razie potrzeby rejestracja zdarzeń budzących magistrale."
      },
      {
        "name": "Diagnostyka czujnika wału / wałka",
        "variants": [
          "oscyloskop",
          "korelacja mechaniczna"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Kontrola zasilania i sygnału czujników położenia wału/wałka oraz ocena korelacji czasowej. Wynik porównano z warunkami pracy i, jeśli dostępne, wzorcem dla danego silnika."
      },
      {
        "name": "Pomiar podciśnienia / ciśnienia",
        "variants": [
          "podciśnienie sterowania",
          "ciśnienie doładowania",
          "ciśnienie paliwa niskie"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Podłączenie odpowiedniego przyrządu i pomiar wartości w warunkach występowania objawu. Kontrola stabilności, reakcji na zmianę obciążenia i zgodności z wartością oczekiwaną."
      },
      {
        "name": "Diagnostyka usterki okresowej",
        "variants": [
          "rejestracja danych",
          "jazda próbna z logowaniem"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Przygotowanie zestawu parametrów lub pomiarów do rejestracji, odtworzenie warunków występowania usterki i analiza zapisu. Czas diagnostyki może obejmować wielokrotne próby i obserwację pojazdu."
      }
    ]
  },
  {
    "group": "Kodowanie, adaptacje i programowanie",
    "jobs": [
      {
        "name": "Kodowanie wyposażenia / funkcji",
        "variants": [
          "pojedynczy sterownik",
          "wiele sterowników"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Wykonanie kopii/odczytu aktualnych ustawień w zakresie możliwym, wprowadzenie uzgodnionych zmian kodowania oraz kontrola pamięci usterek i działania funkcji po zakończeniu."
      },
      {
        "name": "Adaptacja elementu wykonawczego",
        "variants": [
          "przepustnica",
          "EGR",
          "czujnik kąta skrętu",
          "inne wartości podstawowe"
        ],
        "hours": 0.7,

        "price": 160,
        "scope": "Kontrola warunków wstępnych i wykonanie procedury adaptacji/wartości podstawowych przewidzianej przez sterownik. Weryfikacja poprawnego zakończenia oraz kontrola błędów."
      },
      {
        "name": "Programowanie / aktualizacja sterownika",
        "variants": [
          "ECU/TCU",
          "moduł komfortu/nadwozia",
          "inny sterownik"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Identyfikacja sterownika, zabezpieczenie stabilnego zasilania pojazdu, wykonanie programowania/aktualizacji zgodnie z uzgodnionym zakresem i dostępnym oprogramowaniem. Po operacji kontrola komunikacji, kodowania i pamięci usterek."
      },
      {
        "name": "Wymiana sterownika z przeniesieniem konfiguracji",
        "variants": [
          "moduł nadwozia",
          "licznik",
          "ECU/TCU – zakres technicznie dostępny"
        ],
        "hours": 3.0,

        "price": 660,
        "scope": "Odczyt danych konfiguracyjnych ze starego modułu w dostępnym zakresie, montaż jednostki zastępczej, przywrócenie kodowania/adaptacji zgodnie z możliwościami technicznymi i prawnymi. Kontrola komunikacji i działania systemu."
      },
      {
        "name": "Kodowanie / adaptacja po wymianie akumulatora",
        "variants": [
          "BMS",
          "zarządzanie energią"
        ],
        "hours": 0.4,

        "price": 90,
        "scope": "Wprowadzenie informacji o nowym akumulatorze, jego pojemności/technologii lub numerze seryjnym zgodnie z wymaganiami pojazdu. Kontrola parametrów zarządzania energią po procedurze."
      },
      {
        "name": "Kalibracja czujnika kąta skrętu / ESP",
        "variants": [
          "po geometrii",
          "po naprawie układu kierowniczego"
        ],
        "hours": 0.6,

        "price": 140,
        "scope": "Kontrola warunków wstępnych, ustawienie kół w pozycji wymaganej i wykonanie procedury kalibracji czujnika kąta skrętu/ESP. Kontrola wartości rzeczywistej i pamięci usterek po wykonaniu."
      }
    ]
  },
  {
    "group": "ECU / TCU i performance",
    "jobs": [
      {
        "name": "Odczyt i kopia danych ECU",
        "variants": [
          "OBD",
          "bench/boot"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Identyfikacja sterownika i wersji oprogramowania, stabilizacja zasilania oraz wykonanie odczytu/kopii danych w dostępnym trybie. Plik archiwalny przypisano do zlecenia zgodnie z procedurą warsztatu."
      },
      {
        "name": "Odczyt i kopia danych TCU",
        "variants": [
          "OBD",
          "bench"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Identyfikacja sterownika skrzyni, stabilizacja zasilania oraz wykonanie odczytu danych w obsługiwanym trybie. Kopię zapisano jako punkt przywracania przed uzgodnionymi zmianami."
      },
      {
        "name": "Indywidualna kalibracja Stage 1",
        "variants": [
          "benzyna turbo",
          "diesel turbo"
        ],
        "hours": 3.0,

        "price": 660,
        "scope": "Weryfikacja stanu technicznego i błędów przed modyfikacją, wykonanie kopii oprogramowania, przygotowanie uzgodnionej kalibracji w bezpiecznych granicach seryjnych podzespołów oraz kontrola parametrów po zapisie. Zakres nie obejmuje modyfikacji systemów emisji wymaganych do ruchu drogowego."
      },
      {
        "name": "Kalibracja TCU",
        "variants": [
          "DSG/S tronic",
          "ZF / automatyczna"
        ],
        "hours": 3.0,

        "price": 660,
        "scope": "Wykonanie kopii danych TCU, przygotowanie i zapis uzgodnionej kalibracji parametrów przekładni, następnie adaptacja/jazda kontrolna w zakresie wymaganym dla danego sterownika. Zmiany dopasowane do stanu technicznego pojazdu i zakresu ECU."
      },
      {
        "name": "Logi drogowe przed/po modyfikacji",
        "variants": [
          "benzyna",
          "diesel"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Przygotowanie zestawu parametrów istotnych dla oceny pracy silnika, wykonanie kontrolowanych logów w bezpiecznych warunkach i analiza m.in. doładowania, zapłonu/korekt, dawki paliwa, temperatur oraz ograniczeń momentu w zależności od typu silnika."
      },
      {
        "name": "Przywrócenie oprogramowania seryjnego",
        "variants": [
          "ECU",
          "TCU"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Weryfikacja identyfikacji sterownika i dostępnej kopii/wersji seryjnej, zapis oprogramowania zgodnie z procedurą oraz kontrola komunikacji, błędów i podstawowych parametrów pracy po operacji."
      },
      {
        "name": "Diagnostyka po modyfikacji ECU/TCU",
        "variants": [
          "kontrola logów",
          "porównanie seria/modyfikacja"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Analiza logów i parametrów eksploatacyjnych po modyfikacji, weryfikacja ograniczeń, temperatur, doładowania, korekt i pracy przekładni w zakresie właściwym dla pojazdu. W razie nieprawidłowości przygotowanie zaleceń lub korekty kalibracji."
      }
    ]
  },
  {
    "group": "Układ zapłonowy i sterowanie silnikiem",
    "jobs": [
      {
        "name": "Diagnostyka wypadania zapłonów",
        "variants": [
          "benzyna MPI",
          "benzyna bezpośredni wtrysk"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Odczyt liczników wypadania zapłonów i parametrów mieszanki, kontrola świec, cewek oraz sygnałów sterujących w zakresie wymaganym do ustalenia przyczyny. W razie potrzeby test zamiany elementów lub pomiary oscyloskopowe."
      },
      {
        "name": "Wymiana cewki zapłonowej",
        "variants": [
          "1 sztuka",
          "komplet"
        ],
        "hours": 0.5,

        "price": 110,
        "scope": "Demontaż cewki/cewek, kontrola złączy i studzienek świec. Montaż nowych elementów oraz kontrola pracy silnika i liczników wypadania zapłonów."
      },
      {
        "name": "Wymiana czujnika położenia wału",
        "variants": [
          "CKP"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola zasilania/sygnału w wymaganym zakresie, demontaż czujnika i montaż nowego elementu. Kontrola rozruchu, błędów oraz parametrów prędkości obrotowej po naprawie."
      },
      {
        "name": "Wymiana czujnika położenia wałka",
        "variants": [
          "CMP"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola zasilania/sygnału w wymaganym zakresie, wymiana czujnika i kontrola synchronizacji oraz pamięci usterek po naprawie."
      },
      {
        "name": "Wymiana czujnika MAP/MAF",
        "variants": [
          "MAP",
          "MAF"
        ],
        "hours": 0.6,

        "price": 140,
        "scope": "Kontrola wartości rzeczywistych i instalacji elektrycznej w wymaganym zakresie, wymiana czujnika i kontrola odczytów oraz pracy silnika po montażu."
      }
    ]
  },
  {
    "group": "Podciśnienie i sterowanie pneumatyczne",
    "jobs": [
      {
        "name": "Diagnostyka układu podciśnienia",
        "variants": [
          "turbo/EGR",
          "serwo hamulcowe",
          "poduszki / inne odbiorniki"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Pomiar podciśnienia źródłowego i za elementami sterującymi, kontrola przewodów, zaworów zwrotnych i elektrozaworów. Lokalizacja nieszczelności lub elementu o nieprawidłowej wydajności."
      },
      {
        "name": "Wymiana pompy podciśnienia",
        "variants": [
          "mechaniczna",
          "elektryczna"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż pompy, kontrola uszczelnienia i przewodów, montaż nowego elementu. Kontrola wartości podciśnienia oraz szczelności po uruchomieniu."
      },
      {
        "name": "Wymiana elektrozaworu sterowania",
        "variants": [
          "N75 / turbo",
          "EGR",
          "inne podciśnienie"
        ],
        "hours": 0.7,

        "price": 160,
        "scope": "Kontrola sterowania i przewodów podciśnienia, wymiana elektrozaworu i weryfikacja reakcji układu w teście elementów wykonawczych lub podczas pracy silnika."
      }
    ]
  },
  {
    "group": "Elektryka nadwozia i komfort",
    "jobs": [
      {
        "name": "Diagnostyka centralnego zamka",
        "variants": [
          "drzwi",
          "klapa",
          "system całego pojazdu"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Odczyt błędów modułów komfortu, kontrola sygnałów zamków/mikrostyków i instalacji w wymaganym zakresie. Lokalizacja usterki mechanizmu, przewodów lub sterowania."
      },
      {
        "name": "Naprawa wiązki drzwi / klapy",
        "variants": [
          "drzwi przednie",
          "drzwi tylne",
          "klapa bagażnika"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Lokalizacja przerw lub zwarć w przegubie/wiązce, wykonanie napraw przewodów z zachowaniem właściwego przekroju i izolacji, zabezpieczenie wiązki oraz kontrola wszystkich funkcji po naprawie."
      },
      {
        "name": "Diagnostyka szyb elektrycznych",
        "variants": [
          "jedne drzwi",
          "system wielu drzwi"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola zasilania, przełączników, silnika/podnośnika i komunikacji modułu drzwi. W zależności od wyniku wykonanie pomiarów obciążeniowych i testu elementów wykonawczych."
      },
      {
        "name": "Wymiana mechanizmu podnoszenia szyby",
        "variants": [
          "przód lewy",
          "przód prawy",
          "tył lewy",
          "tył prawy"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż tapicerki drzwi i zabezpieczenie szyby, wymiana mechanizmu/podnośnika, kontrola prowadnic i uszczelnień. Montaż i adaptacja krańcowych położeń, jeśli wymagana."
      },
      {
        "name": "Diagnostyka oświetlenia",
        "variants": [
          "halogen/LED",
          "ksenon",
          "adaptacyjne"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola bezpieczników, zasilania, mas i sterowania odpowiedniego modułu. W systemach LED/ksenon kontrola przetwornic/modułów oraz błędów komunikacji i poziomowania w wymaganym zakresie."
      },
      {
        "name": "Montaż / kodowanie haka – elektryka",
        "variants": [
          "moduł dedykowany",
          "wiązka uniwersalna + kontrola"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Montaż instalacji elektrycznej haka zgodnie z uzgodnionym zakresem, zabezpieczenie przewodów i połączeń. W systemach dedykowanych kodowanie modułów pojazdu i kontrola świateł przyczepy oraz funkcji bezpieczeństwa."
      }
    ]
  },
  {
    "group": "SRS / systemy bezpieczeństwa",
    "jobs": [
      {
        "name": "Diagnostyka SRS / airbag",
        "variants": [
          "odczyt i analiza",
          "usterka stała / instalacja"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Odczyt błędów sterownika SRS, kontrola parametrów i obwodów w zakresie zgodnym z zasadami bezpieczeństwa. Lokalizacja przerwy, zwiększonej rezystancji, uszkodzenia elementu lub problemu komunikacyjnego. Nie stosuje się obejść elementów bezpieczeństwa."
      },
      {
        "name": "Wymiana elementu SRS",
        "variants": [
          "poduszka",
          "napinacz",
          "czujnik zderzenia"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odłączenie zasilania i odczekanie czasu wymaganego przez producenta, demontaż uszkodzonego elementu i montaż właściwej części. Kontrola połączeń, pamięci usterek oraz statusu systemu po naprawie."
      },
      {
        "name": "Wymiana / konfiguracja sterownika SRS",
        "variants": [
          "moduł nowy/używany zgodny",
          "po prawidłowej naprawie powypadkowej"
        ],
        "hours": 2.5,

        "price": 550,
        "scope": "Montaż zgodnego sterownika SRS i wykonanie dostępnego kodowania/konfiguracji po przywróceniu wszystkich elementów bezpieczeństwa do sprawności. Kontrola błędów i statusu systemu. Zakres nie obejmuje obchodzenia aktywnych zabezpieczeń."
      }
    ]
  },
  {
    "group": "ADAS i czujniki wspomagania",
    "jobs": [
      {
        "name": "Diagnostyka radaru ACC",
        "variants": [
          "brak komunikacji",
          "błąd ustawienia / kalibracji",
          "wymiana modułu"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odczyt usterek systemu ACC, kontrola zasilania, komunikacji, mocowania radaru i parametrów ustawienia. Ocena, czy wymagana jest naprawa instalacji, kodowanie, parametryzacja lub kalibracja zgodnie z wyposażeniem."
      },
      {
        "name": "Kodowanie / parametryzacja radaru",
        "variants": [
          "po wymianie",
          "po naprawie instalacji"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Identyfikacja właściwego modułu i jego konfiguracji, wykonanie kodowania/parametryzacji dostępnymi narzędziami oraz przygotowanie do wymaganej kalibracji. Kontrola pamięci usterek po operacji."
      },
      {
        "name": "Kalibracja czujników parkowania / kamera",
        "variants": [
          "kamera cofania",
          "kamera wielofunkcyjna",
          "PDC"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Kontrola montażu i parametrów systemu, wykonanie dostępnej procedury kalibracji lub ustawień podstawowych zgodnie z wymaganiami producenta. W razie braku wymaganej ramy/stanowiska kalibracyjnego wystawiane jest zalecenie wykonania kalibracji zewnętrznej."
      }
    ]
  },
  {
    "group": "Klimatyzacja – diagnostyka pomocnicza",
    "jobs": [
      {
        "name": "Diagnostyka sterowania klimatyzacją",
        "variants": [
          "brak chłodzenia",
          "brak nawiewu",
          "błędy klap / czujników"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Odczyt błędów modułu HVAC, kontrola parametrów czujników, sterowania sprężarką, wentylatorami i klapami w zakresie elektryczno-diagnostycznym. Zakres nie obejmuje obsługi czynnika chłodniczego, jeśli nie została osobno uzgodniona."
      },
      {
        "name": "Wymiana rezystora / regulatora dmuchawy",
        "variants": [
          "rezystor",
          "moduł PWM"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola zasilania i sterowania dmuchawy, demontaż uszkodzonego regulatora/rezystora i montaż nowego elementu. Kontrola wszystkich stopni/prędkości pracy nawiewu."
      },
      {
        "name": "Wymiana silnika dmuchawy",
        "variants": [
          "standard",
          "utrudniony dostęp"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż elementów wnętrza wymaganych do dostępu, wymiana silnika dmuchawy i kontrola złącza/regulatora. Montaż elementów i sprawdzenie pracy w pełnym zakresie prędkości."
      }
    ]
  },
  {
    "group": "Układ wycieraczek i spryskiwaczy",
    "jobs": [
      {
        "name": "Wymiana mechanizmu wycieraczek",
        "variants": [
          "przód",
          "tył"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Demontaż ramion i osłon, wymiana mechanizmu lub silnika wycieraczek, kontrola osi i odpływów w podszybiu. Ustawienie położenia spoczynkowego i kontrola pełnego zakresu pracy."
      },
      {
        "name": "Naprawa spryskiwaczy",
        "variants": [
          "przód",
          "tył",
          "reflektory"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Kontrola poziomu płynu, pompy, bezpieczników, przewodów i dysz. Usunięcie nieszczelności/zatoru lub wymiana uszkodzonego elementu zgodnie z zakresem."
      }
    ]
  },
  {
    "group": "Układ paliwowy / zbiornik – ogólne",
    "jobs": [
      {
        "name": "Wymiana zbiornika paliwa",
        "variants": [
          "benzyna",
          "diesel"
        ],
        "hours": 4.0,

        "price": 880,
        "scope": "Odprowadzenie paliwa w bezpieczny sposób, demontaż osłon, przewodów, modułów i mocowań zbiornika. Montaż nowego zbiornika z kontrolą uszczelnień i przewodów, napełnienie oraz kontrola szczelności."
      },
      {
        "name": "Naprawa przewodu paliwowego",
        "variants": [
          "niskie ciśnienie",
          "przewód powrotny"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Lokalizacja nieszczelności/uszkodzenia przewodu, wymiana odcinka lub kompletnego przewodu z zastosowaniem materiałów przeznaczonych do danego paliwa i ciśnienia. Kontrola szczelności po uruchomieniu."
      }
    ]
  },
  {
    "group": "Pomiary i przygotowanie do geometrii",
    "jobs": [
      {
        "name": "Kontrola geometrii wstępna",
        "variants": [
          "po naprawie zawieszenia",
          "ściąganie / nierówne zużycie opon"
        ],
        "hours": 0.8,

        "price": 180,
        "scope": "Kontrola ciśnienia i stanu ogumienia, luzów zawieszenia i układu kierowniczego oraz podstawowych przyczyn uniemożliwiających prawidłową regulację geometrii. Wykryte luzy/usterki zapisano przed skierowaniem do regulacji."
      },
      {
        "name": "Regulacja zbieżności",
        "variants": [
          "oś przednia",
          "przód + tył – jeśli wyposażenie pozwala"
        ],
        "hours": 1.2,

        "price": 270,
        "scope": "Wykonanie pomiaru i regulacji dostępnych parametrów geometrii w zakresie obsługiwanym przez stanowisko. Po regulacji kontrola położenia kierownicy i wartości końcowych. Elementy zapieczone lub uszkodzone wymagają osobnego zakresu naprawy."
      }
    ]
  },
  {
    "group": "Kontrola przed zakupem / inspekcje",
    "jobs": [
      {
        "name": "Kontrola samochodu przed zakupem",
        "variants": [
          "podstawowa",
          "rozszerzona z diagnostyką",
          "rozszerzona + jazda próbna"
        ],
        "hours": 2.0,

        "price": 440,
        "scope": "Kontrola stanu pojazdu w zakresie możliwym bez demontażu: nadwozie i ślady napraw, komora silnika, wycieki, zawieszenie, hamulce, ogumienie, wyposażenie, diagnostyka komputerowa oraz jazda próbna, jeśli przewidziano. Raport opisuje stan w chwili oględzin i nie stanowi gwarancji braku ukrytych wad."
      },
      {
        "name": "Kontrola auta przed dłuższą trasą",
        "variants": [
          "podstawowa",
          "pełna"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Kontrola poziomów płynów, szczelności, hamulców, zawieszenia, oświetlenia, ogumienia, akumulatora i podstawowych parametrów diagnostycznych w zakresie uzgodnionym. Stwierdzone zalecenia zapisano przed wyjazdem."
      },
      {
        "name": "Kontrola po naprawie innego warsztatu",
        "variants": [
          "weryfikacja objawu",
          "diagnostyka techniczna"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Niezależna weryfikacja zgłaszanego objawu i elementów objętych wcześniejszą naprawą w zakresie możliwym bez nieuzgodnionego demontażu. Wyniki pomiarów i stwierdzone nieprawidłowości zapisano w zleceniu."
      }
    ]
  },
  {
    "group": "Hybrydy i pojazdy elektryczne – diagnostyka",
    "jobs": [
      {
        "name": "Diagnostyka systemu hybrydowego / EV",
        "variants": [
          "odczyt usterek HV",
          "parametry baterii trakcyjnej",
          "układ ładowania"
        ],
        "hours": 1.5,

        "price": 330,
        "scope": "Odczyt usterek i parametrów systemu wysokonapięciowego bez ingerencji w obwody HV poza zakresem uprawnień i wyposażenia warsztatu. Ocena danych baterii, izolacji, temperatur i układu ładowania w zakresie dostępnej diagnostyki."
      },
      {
        "name": "Kontrola akumulatora 12 V w HEV/EV",
        "variants": [
          "akumulator pomocniczy"
        ],
        "hours": 0.5,

        "price": 110,
        "scope": "Test akumulatora 12 V i kontrola napięcia ładowania z przetwornicy DC/DC. Ocena wpływu zasilania pomocniczego na błędy systemów pojazdu."
      },
      {
        "name": "Wymiana podzespołu niskonapięciowego w HEV/EV",
        "variants": [
          "12 V / nadwozie",
          "czujnik / element pomocniczy"
        ],
        "hours": 1.0,

        "price": 220,
        "scope": "Wykonanie naprawy po stronie niskonapięciowej zgodnie z zasadami bezpieczeństwa pojazdu zelektryfikowanego. Jeśli procedura wymaga odłączenia układu HV, praca wykonywana wyłącznie przez osobę z odpowiednimi uprawnieniami i wyposażeniem."
      }
    ]
  },
  {
    "group": "Czynności końcowe i kontrola jakości",
    "jobs": [
      {
        "name": "Jazda próbna po naprawie",
        "variants": [
          "krótka kontrolna",
          "rozszerzona z logowaniem"
        ],
        "hours": 0.5,

        "price": 110,
        "scope": "Wykonanie jazdy próbnej w zakresie niezbędnym do oceny skuteczności naprawy i bezpieczeństwa działania pojazdu. Kontrola zgłaszanego wcześniej objawu oraz nowych nieprawidłowości możliwych do wychwycenia podczas jazdy."
      },
      {
        "name": "Kontrola jakości po naprawie",
        "variants": [
          "mechanika",
          "diagnostyka/elektryka",
          "naprawa rozbudowana"
        ],
        "hours": 0.5,

        "price": 110,
        "scope": "Kontrola kompletności montażu, wycieków, pozostawionych błędów, mocowań i elementów objętych naprawą. Weryfikacja podstawowych funkcji pojazdu oraz zgodności wykonania z zakresem zlecenia."
      },
      {
        "name": "Kontrola momentów dokręcenia",
        "variants": [
          "koła",
          "zawieszenie / elementy krytyczne"
        ],
        "hours": 0.3,

        "price": 70,
        "scope": "Weryfikacja dokręcenia wskazanych połączeń odpowiednim kluczem dynamometrycznym zgodnie z danymi technicznymi zastosowanymi do naprawy. Wynik kontroli odnotowano w zleceniu."
      },
      {
        "name": "Kasowanie błędów po wykonanej naprawie",
        "variants": [
          "sterownik pojedynczy",
          "pełny autoscan"
        ],
        "hours": 0.3,

        "price": 70,
        "scope": "Po usunięciu przyczyny usterek wykonano kasowanie zapisów diagnostycznych w odpowiednich sterownikach oraz ponowny odczyt w celu kontroli, czy błędy nie powracają w warunkach testowych."
      }
    ]
  },
{
  "group": "Mocowania silnika i skrzyni",
  "jobs": [
    {
      "name": "Wymiana poduszki silnika",
      "variants": [
        "górna/prawa",
        "lewa",
        "dolna/reakcyjna",
        "z podparciem zespołu napędowego"
      ],
      "hours": 1.3,

      "price": 290,
      "scope": "Podparcie zespołu napędowego, demontaż wskazanego mocowania, kontrola wsporników i gwintów, montaż nowego elementu z zastosowaniem danych technicznych właściwych dla pojazdu. Kontrola ułożenia zespołu napędowego i drgań po uruchomieniu."
    },
    {
      "name": "Wymiana poduszki skrzyni biegów",
      "variants": [
        "manualna",
        "DSG/automat",
        "z demontażem elementów dostępowych"
      ],
      "hours": 1.5,

      "price": 330,
      "scope": "Podparcie skrzyni, demontaż mocowania, kontrola wsporników i połączeń, montaż nowej poduszki oraz dokręcenie połączeń zgodnie z danymi technicznymi. Kontrola położenia zespołu napędowego."
    },
    {
      "name": "Wymiana wspornika zespołu napędowego",
      "variants": [
        "silnik",
        "skrzynia",
        "wspornik pośredni"
      ],
      "hours": 2.0,

      "price": 440,
      "scope": "Bezpieczne podparcie zespołu napędowego, demontaż wspornika, kontrola powierzchni przylegania i gwintów, montaż z użyciem wymaganych nowych elementów złącznych. Weryfikacja momentów i kątów dokręcenia."
    }
  ]
},
{
  "group": "Napęd paskiem osprzętu",
  "jobs": [
    {
      "name": "Wymiana paska osprzętu",
      "variants": [
        "bez napinacza",
        "z napinaczem",
        "układ wielopaskowy"
      ],
      "hours": 0.7,

      "price": 160,
      "scope": "Kontrola przebiegu paska, zwolnienie napinacza, demontaż paska, ocena rolek i kół pasowych, montaż nowego paska zgodnie z przebiegiem oraz kontrola pracy po uruchomieniu."
    },
    {
      "name": "Wymiana napinacza paska osprzętu",
      "variants": [
        "mechaniczny",
        "automatyczny",
        "z demontażem osprzętu"
      ],
      "hours": 1.0,

      "price": 220,
      "scope": "Demontaż paska i napinacza, kontrola punktów mocowania, montaż nowego zespołu i dokręcenie zgodnie z danymi technicznymi. Kontrola toru paska i pracy napinacza."
    },
    {
      "name": "Wymiana rolki prowadzącej paska osprzętu",
      "variants": [
        "pojedyncza",
        "zestaw rolek"
      ],
      "hours": 0.6,

      "price": 140,
      "scope": "Demontaż paska w wymaganym zakresie, wymiana rolki prowadzącej, kontrola łożysk pozostałych elementów i osiowości. Montaż i kontrola pracy napędu."
    },
    {
      "name": "Wymiana koła pasowego wału korbowego",
      "variants": [
        "tłumik drgań",
        "koło sztywne",
        "z blokowaniem wału"
      ],
      "hours": 1.5,

      "price": 330,
      "scope": "Demontaż elementów dostępowych i paska, zabezpieczenie wału zgodnie z procedurą, wymiana koła pasowego/tłumika drgań. Zastosowanie właściwych śrub i danych moment-kąt, następnie kontrola bicia i pracy napędu."
    }
  ]
},
{
  "group": "Układ olejowy silnika",
  "jobs": [
    {
      "name": "Wymiana miski olejowej",
      "variants": [
        "stalowa",
        "aluminiowa",
        "z demontażem elementów pomocniczych"
      ],
      "hours": 2.2,

      "price": 490,
      "scope": "Spuszczenie oleju, demontaż miski, oczyszczenie powierzchni uszczelniających, kontrola smoka olejowego i wnętrza w dostępnym zakresie. Montaż z właściwym uszczelnieniem i kolejnością dokręcania, napełnienie i kontrola szczelności."
    },
    {
      "name": "Wymiana/uszczelnienie podstawy filtra oleju",
      "variants": [
        "uszczelka",
        "kompletna podstawa",
        "z chłodniczką oleju"
      ],
      "hours": 2.0,

      "price": 440,
      "scope": "Demontaż elementów dostępowych, spuszczenie wymaganych płynów, demontaż podstawy filtra/chłodniczki, wymiana uszczelnień lub zespołu. Montaż według danych technicznych, uzupełnienie płynów i kontrola szczelności."
    },
    {
      "name": "Pomiar ciśnienia oleju",
      "variants": [
        "na zimno i ciepło",
        "pod obciążeniem",
        "diagnostyka kontrolki ciśnienia"
      ],
      "hours": 1.0,

      "price": 220,
      "scope": "Podłączenie manometru w odpowiednim punkcie pomiarowym, pomiar ciśnienia w wymaganych temperaturach i prędkościach obrotowych, porównanie z danymi technicznymi oraz zapis wyników w zleceniu."
    },
    {
      "name": "Wymiana czujnika ciśnienia/poziomu oleju",
      "variants": [
        "ciśnienia",
        "poziomu/temperatury",
        "z diagnostyką obwodu"
      ],
      "hours": 0.7,

      "price": 160,
      "scope": "Weryfikacja obwodu i wskazań, demontaż czujnika, kontrola złącza i uszczelnienia, montaż nowego elementu oraz kontrola szczelności i parametrów po uruchomieniu."
    }
  ]
},
{
  "group": "Układ dolotowy i podciśnienie",
  "jobs": [
    {
      "name": "Test szczelności układu dolotowego dymem",
      "variants": [
        "dolot atmosferyczny",
        "układ doładowania",
        "odma/EVAP"
      ],
      "hours": 1.0,

      "price": 220,
      "scope": "Odizolowanie badanego obwodu, podanie dymu przy bezpiecznym ciśnieniu, lokalizacja nieszczelności przewodów, połączeń i elementów. Wyniki i miejsca nieszczelności zapisano w zleceniu."
    },
    {
      "name": "Pomiar podciśnienia układu sterowania",
      "variants": [
        "turbo",
        "EGR",
        "serwo hamulcowe",
        "pompa vacuum"
      ],
      "hours": 0.8,

      "price": 180,
      "scope": "Pomiar podciśnienia w wybranych punktach układu, kontrola przewodów, zaworów sterujących i elementów wykonawczych. Porównanie wartości z danymi technicznymi, jeśli są dostępne."
    },
    {
      "name": "Wymiana przewodów podciśnienia",
      "variants": [
        "pojedynczy obwód",
        "komplet silnika",
        "z odtworzeniem trasowania"
      ],
      "hours": 1.0,

      "price": 220,
      "scope": "Identyfikacja przebiegu przewodów, wymiana uszkodzonych odcinków z zachowaniem średnic i połączeń, kontrola szczelności i działania odbiorników podciśnienia."
    },
    {
      "name": "Czyszczenie kolektora dolotowego",
      "variants": [
        "bez demontażu klap",
        "z demontażem klap",
        "diesel z nagarem EGR"
      ],
      "hours": 4.0,

      "price": 880,
      "scope": "Demontaż kolektora w wymaganym zakresie, mechaniczne/chemiczne usunięcie osadów, kontrola kanałów i mechanizmu klap, wymiana uszczelnień oraz montaż według danych technicznych. Kontrola szczelności dolotu."
    }
  ]
},
{
  "group": "Pomiary mechaniczne silnika",
  "jobs": [
    {
      "name": "Pomiar kompresji",
      "variants": [
        "benzyna",
        "diesel",
        "z próbą olejową"
      ],
      "hours": 1.5,

      "price": 330,
      "scope": "Przygotowanie silnika do pomiaru, odłączenie układów wymaganych dla bezpiecznego testu, pomiar wszystkich cylindrów w porównywalnych warunkach i zapis wyników. Ocena różnic między cylindrami."
    },
    {
      "name": "Próba szczelności cylindrów leak-down",
      "variants": [
        "4 cylindry",
        "5/6 cylindrów",
        "diagnostyka jednego cylindra"
      ],
      "hours": 2.0,

      "price": 440,
      "scope": "Ustawienie badanego cylindra w odpowiednim położeniu, podanie kontrolowanego ciśnienia, pomiar procentowej nieszczelności i lokalizacja kierunku ucieczki przez dolot, wydech, skrzynię korbową lub układ chłodzenia."
    },
    {
      "name": "Pomiar ciśnienia w skrzyni korbowej",
      "variants": [
        "manometr",
        "diagnostyka odmy",
        "porównanie przed/po naprawie"
      ],
      "hours": 1.0,

      "price": 220,
      "scope": "Pomiar ciśnienia/podciśnienia skrzyni korbowej w określonych warunkach pracy, kontrola układu odpowietrzania i zapis wyników. Interpretacja w powiązaniu z objawami i konstrukcją silnika."
    },
    {
      "name": "Kontrola synchronizacji mechanicznej silnika",
      "variants": [
        "blokady mechaniczne",
        "oscyloskop CKP/CMP",
        "wartości diagnostyczne"
      ],
      "hours": 1.5,

      "price": 330,
      "scope": "Weryfikacja synchronizacji rozrządu metodą właściwą dla silnika: mechanicznie, poprzez parametry sterownika lub korelację sygnałów CKP/CMP. Wynik udokumentowano w zleceniu."
    }
  ]
}
,
{
  "group": "PPF, folie ochronne i stylizacja",
  "jobs": [
    {"name":"Aplikacja folii PPF na reflektory","variants":["komplet przód - bezbarwna","komplet przód - przyciemniająca","pojedynczy reflektor","lampy tylne"],"hours": 2.0,
"price": 440,"scope":"Ocena stanu klosza, mycie i dekontaminacja, przygotowanie powierzchni, wykonanie lub dopasowanie formatki, aplikacja folii, wyprowadzenie krawędzi i kontrola optyczna. Przy folii zmieniającej przepuszczalność światła przed przyjęciem zlecenia należy zweryfikować zgodność z wymaganiami drogowymi dla danego zastosowania."},
    {"name":"Aplikacja folii PPF na zderzak","variants":["zderzak przedni","zderzak tylny","z demontażem elementów osprzętu","bez demontażu osprzętu"],"hours": 5.0,
"price": 1100,"scope":"Mycie, dekontaminacja i inspekcja lakieru, przygotowanie powierzchni, demontaż uzgodnionych elementów przeszkadzających, dopasowanie folii, aplikacja na przetłoczeniach i narożach, wykończenie krawędzi, ponowny montaż oraz kontrola końcowa."},
    {"name":"Aplikacja folii PPF na maskę","variants":["pełna maska","częściowa / bikini","z zawinięciem krawędzi"],"hours": 3.0,
"price": 660,"scope":"Przygotowanie i inspekcja lakieru, dekontaminacja, dopasowanie formatki, aplikacja folii z kontrolą naprężeń i zanieczyszczeń, wykończenie krawędzi i kontrola końcowa."},
    {"name":"Aplikacja folii PPF na błotnik","variants":["przedni lewy","przedni prawy","komplet przedni","częściowy"],"hours": 2.0,
"price": 440,"scope":"Przygotowanie powierzchni, demontaż uzgodnionych elementów przeszkadzających, aplikacja PPF, obróbka krawędzi i kontrola końcowa."},
    {"name":"Aplikacja folii PPF na lusterko","variants":["lewe","prawe","komplet"],"hours": 1.2,
"price": 270,"scope":"Oczyszczenie i przygotowanie obudowy lusterka, ewentualny demontaż elementów ułatwiających dostęp, dopasowanie i aplikacja folii na powierzchni o dużej krzywiźnie oraz kontrola krawędzi."},
    {"name":"Aplikacja folii PPF na progi i strefy załadunkowe","variants":["progi zewnętrzne","progi wewnętrzne","próg bagażnika","ranty drzwi","wnęki klamek"],"hours": 1.5,
"price": 330,"scope":"Oczyszczenie i odtłuszczenie strefy, przygotowanie formatki, aplikacja folii w obszarze narażonym na zarysowania i kontrola przyczepności krawędzi."},
    {"name":"Pakiet PPF przód","variants":["zderzak + reflektory","semi front","full front","full front rozszerzony"],"hours": 12.0,
"price": 2640,"scope":"Kompleksowe przygotowanie i zabezpieczenie uzgodnionych elementów przedniej części pojazdu. Zakres elementów jest zapisany w kosztorysie; czas i cena zależą od wielkości pojazdu, geometrii elementów, stanu lakieru i zakresu demontażu."},
    {"name":"Aplikacja folii PPF na element wnętrza","variants":["ekran","piano black","konsola","dekor"],"hours": 1.0,
"price": 220,"scope":"Delikatne przygotowanie powierzchni, wykonanie/dopasowanie formatki, aplikacja folii bez uszkodzenia powłok dekoracyjnych i kontrola końcowa."},
    {"name":"Usunięcie folii PPF / folii stylizacyjnej","variants":["pojedynczy element","pakiet przód","cały pojazd"],"hours": 2.0,
"price": 440,"scope":"Kontrolowane podgrzanie i usunięcie folii, usunięcie pozostałości kleju odpowiednimi środkami oraz inspekcja powierzchni. Stan lakieru przed rozpoczęciem dokumentowany zdjęciami."},
    {"name":"Przygotowanie elementu pod folię","variants":["mycie + dekontaminacja","glinka/deironizacja","lekka korekta lakieru","demontaż emblematów/listw"],"hours": 1.5,
"price": 330,"scope":"Przygotowanie powierzchni do aplikacji folii w zakresie uzgodnionym w zleceniu; dokumentacja istniejących odprysków, rys, napraw lakierniczych i innych wad mogących wpływać na aplikację lub późniejsze usuwanie folii."}
  ]
},
{
  "group": "Nadwozie, blacharstwo i elementy zewnętrzne",
  "jobs": [
    {"name":"Demontaż / montaż zderzaka","variants":["przedni","tylny","z PDC","z kamerą/radarem","z instalacją spryskiwaczy"],"hours": 1.5,
"price": 330,"scope":"Demontaż osłon i mocowań, bezpieczne rozłączenie instalacji elektrycznej i przewodów wyposażenia, zdjęcie poszycia zderzaka bez uszkodzenia prowadnic. Montaż z kontrolą spasowania, mocowań i działania wyposażenia. Po ingerencji w elementy ADAS należy ocenić wymaganie kalibracji zgodnie z dokumentacją pojazdu."},
    {"name":"Demontaż / montaż reflektora","variants":["lewy","prawy","komplet","z wymaganym demontażem zderzaka"],"hours": 1.0,
"price": 220,"scope":"Uzyskanie dostępu, odłączenie instalacji, demontaż reflektora i kontrola mocowań. Montaż, kontrola działania i ustawienia światła; w systemach adaptacyjnych wykonanie wymaganej procedury podstawowej/kalibracji."},
    {"name":"Demontaż / montaż błotnika przedniego","variants":["lewy","prawy"],"hours": 2.5,
"price": 550,"scope":"Demontaż elementów sąsiednich wymaganych do dostępu, odkręcenie błotnika, oczyszczenie powierzchni styku i montaż z ustawieniem szczelin względem maski, drzwi, lampy i zderzaka."},
    {"name":"Demontaż / montaż maski","variants":["maska kompletna","z przełożeniem zamka/dysz/wygłuszenia","regulacja spasowania"],"hours": 1.5,
"price": 330,"scope":"Zabezpieczenie sąsiednich powierzchni, oznaczenie położenia zawiasów jeśli zasadne, demontaż i montaż maski, przełożenie uzgodnionego osprzętu oraz regulacja szczelin i zamka."},
    {"name":"Demontaż / montaż drzwi","variants":["przód lewe","przód prawe","tył lewe","tył prawe","drzwi kompletne"],"hours": 2.5,
"price": 550,"scope":"Odłączenie instalacji i ogranicznika, podparcie drzwi, demontaż z zawiasów lub mocowań, montaż i regulacja szczelin oraz działania zamka. Kontrola instalacji elektrycznej po złożeniu."},
    {"name":"Demontaż / montaż klapy bagażnika","variants":["hatchback/kombi","sedan","elektryczna","z kamerą"],"hours": 2.5,
"price": 550,"scope":"Zabezpieczenie i podparcie klapy, odłączenie instalacji i elementów napędowych, demontaż/montaż, regulacja zamka i szczelin oraz kontrola wyposażenia elektrycznego."},
    {"name":"Demontaż / montaż nadkola","variants":["przód lewe","przód prawe","tył lewe","tył prawe"],"hours": 0.6,
"price": 140,"scope":"Demontaż koła jeśli wymagany, spinek i śrub nadkola, kontrola mocowań i osłon, montaż z wymianą uszkodzonych elementów mocujących."},
    {"name":"Demontaż / montaż osłon podwozia","variants":["osłona silnika","osłona skrzyni","osłony aerodynamiczne","komplet"],"hours": 0.5,
"price": 110,"scope":"Demontaż elementów mocujących i osłony, kontrola uszkodzeń oraz montaż z prawidłowym ułożeniem i kompletem mocowań."},
    {"name":"Demontaż / montaż listwy / dokładki / spoilera","variants":["listwa zderzaka","dokładka zderzaka","spoiler","listwa progowa","element ozdobny"],"hours": 1.0,
"price": 220,"scope":"Identyfikacja rodzaju mocowania, demontaż bez uszkodzenia zaczepów i lakieru, przygotowanie powierzchni oraz montaż elementu z wymianą wymaganych spinek lub taśmy montażowej."},
    {"name":"Demontaż / montaż emblematu i oznaczeń","variants":["emblemat","napis modelu","oznaczenie silnika","dechroming - przygotowanie"],"hours": 0.5,
"price": 110,"scope":"Dokumentacja położenia, bezpieczne usunięcie elementu i kleju, przygotowanie powierzchni oraz ponowny montaż lub przygotowanie do oklejania."},
    {"name":"Naprawa mocowań zderzaka / elementów plastikowych","variants":["prowadnica","uchwyt","pęknięte mocowanie","spawanie tworzywa"],"hours": 1.5,
"price": 330,"scope":"Ocena uszkodzenia i rodzaju tworzywa, naprawa lub wymiana mocowania w uzgodnionym zakresie, odtworzenie geometrii i kontrola spasowania. Elementy mające znaczenie bezpieczeństwa kwalifikowane indywidualnie."},
    {"name":"Wymiana spinek i elementów mocujących nadwozia","variants":["zderzak","nadkole","osłona podwozia","tapicerka/listwa"],"hours": 0.3,
"price": 70,"scope":"Identyfikacja brakujących lub uszkodzonych mocowań, dobór właściwego typu i montaż bez prowizorycznych zamienników mogących powodować luzy lub uszkodzenia."},
    {"name":"Pomiar i dokumentacja szczelin nadwozia","variants":["przód pojazdu","bok pojazdu","po naprawie kolizyjnej","przed zakupem"],"hours": 0.8,
"price": 180,"scope":"Oględziny symetrii i szczelin elementów nadwozia, dokumentacja zdjęciowa i pomiarowa w uzgodnionych punktach. Wynik służy diagnostyce i kontroli montażu, nie zastępuje pomiaru geometrii nadwozia na ramie pomiarowej."}
  ]
},
{
  "group": "Przygotowanie i prace około-blacharskie",
  "jobs": [
    {"name":"Demontaż elementów do lakierowania / naprawy blacharskiej","variants":["pojedynczy element","przód pojazdu","bok pojazdu","tył pojazdu"],"hours": 2.0,
"price": 440,"scope":"Demontaż osprzętu, listew, lamp, nadkoli i innych elementów wymaganych do przekazania części do naprawy/lakierowania. Wszystkie złącza, mocowania i uszkodzenia są dokumentowane."},
    {"name":"Montaż po naprawie blacharsko-lakierniczej","variants":["pojedynczy element","przód pojazdu","bok pojazdu","tył pojazdu"],"hours": 2.5,
"price": 550,"scope":"Montaż zdemontowanego osprzętu, wymiana uszkodzonych spinek, ustawienie szczelin, kontrola instalacji i wyposażenia oraz dokumentacja końcowa."},
    {"name":"Oględziny uszkodzeń nadwozia","variants":["po kolizji","przed kosztorysem","po demontażu","kontrola wcześniejszej naprawy"],"hours": 0.8,
"price": 180,"scope":"Dokumentacja zdjęciowa, identyfikacja elementów uszkodzonych i wymagających demontażu, kontrola widocznych mocowań i elementów sąsiednich oraz przygotowanie listy dalszych czynności. Ukryte uszkodzenia są dopisywane po demontażu."},
    {"name":"PDR - przygotowanie dostępu","variants":["demontaż boczka","demontaż lampy","demontaż nadkola","demontaż podsufitki - zakres do wyceny"],"hours": 1.0,
"price": 220,"scope":"Demontaż elementów wymaganych do uzyskania dostępu od wewnętrznej strony poszycia dla naprawy PDR oraz ponowny montaż po zakończeniu prac."}
  ]
}

]

const RAW_WORK_CATALOG=expandCatalogDiagnostics([...BASE_WORK_CATALOG,...WORK_CATALOG_EXPANSION])

const slug=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'pozycja'
const stableHash=value=>{let hash=2166136261;for(const char of String(value)){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(36)}
const stableId=(prefix,...parts)=>`${prefix}_${slug(parts.at(-1))}_${stableHash(parts.join('|'))}`
const sentences=text=>(String(text||'').match(/[^.!?]+[.!?]+|[^.!?]+$/g)||[]).map(x=>x.trim()).filter(Boolean)
const sentence=text=>/[.!?]$/.test(text)?text:`${text}.`

function variantDetail(jobName,variantName){
  const value=`${jobName} ${variantName}`.toLowerCase()
  if(/diagnost|pomiar|test|log|oględzin|weryfik|lokalizacja/.test(value))return `Zakres diagnostyki: ${variantName}. Wykonane pomiary i obserwacje zostaną zapisane bez przesądzania wyniku przed zakończeniem sprawdzeń.`
  if(/ppf|foli|oklejan/.test(value))return `Zakres aplikacji: ${variantName}. Obejmuje przygotowanie powierzchni, aplikację materiału, obróbkę dostępnych krawędzi oraz kontrolę efektu.`
  if(/przyciemnian.*lamp|lamp.*przyciemnian/.test(value))return `Przyciemnianie obejmuje element: ${variantName}. Powierzchnia zostanie przygotowana, materiał dopasowany, a efekt końcowy skontrolowany.`
  if(/demontaż/.test(value))return `Demontaż w wariancie „${variantName}” obejmuje niezbędne osłony i mocowania oraz zabezpieczenie instalacji i czujników, jeśli występują w wyposażeniu pojazdu.`
  if(/montaż/.test(value))return `Montaż w wariancie „${variantName}” obejmuje ustawienie elementu, kontrolę mocowań i sprawdzenie wyposażenia powiązanego, jeśli występuje.`
  if(/regulac/.test(value))return `Regulacja dotyczy wariantu „${variantName}”. Po ustawieniu zostanie sprawdzone działanie oraz położenie współpracujących elementów.`
  if(/epb|elektryczn.*hamul/.test(value))return `Wariant „${variantName}” uwzględnia obsługę elektrycznego hamulca postojowego w trybie serwisowym oraz kontrolę jego działania po zakończeniu pracy.`
  if(/przód|przedni/.test(value))return `Zakres dotyczy przedniej części pojazdu w wariancie „${variantName}”; po pracy zostaną skontrolowane elementy współpracujące dostępne w tym obszarze.`
  if(/tył|tyln/.test(value))return `Zakres dotyczy tylnej części pojazdu w wariancie „${variantName}”; po pracy zostaną skontrolowane elementy współpracujące dostępne w tym obszarze.`
  if(/lewy|prawy|stron/.test(value))return `Praca obejmuje wskazaną stronę: ${variantName}. Po montażu zostanie sprawdzone osadzenie i działanie elementów współpracujących.`
  if(/wymian/.test(value))return `Wymiana zostanie wykonana w wariancie „${variantName}”, z kontrolą dostępnych mocowań, połączeń i elementów bezpośrednio współpracujących.`
  if(/napraw/.test(value))return `Naprawa obejmuje wariant „${variantName}”. Po zakończeniu zostanie skontrolowany rezultat w zakresie objętym zleceniem.`
  if(/serwis|przegląd/.test(value))return `Usługa jest realizowana w wariancie „${variantName}”, a wynik kontroli i zauważone nieprawidłowości zostaną zapisane w zleceniu.`
  return `Zakres wykonania: ${variantName}. Po zakończeniu zostanie sprawdzony rezultat pracy i stan bezpośrednio powiązanych elementów.`
}

function customerDescription(job,variantName){
  const scopeParts=sentences(job.scope).slice(0,2)
  const detail=variantDetail(job.name,variantName)
  return [...scopeParts,detail].map(sentence).join(' ')
}

export const WORK_CATALOG=RAW_WORK_CATALOG.map(group=>({
  ...group,
  jobs:group.jobs.map(job=>{
    const workId=stableId('work',group.group,job.name)
    return {...job,id:workId,variants:(job.variants?.length?job.variants:['standard']).map(raw=>{
      const name=typeof raw==='string'?raw:raw.name
      return {
        ...(typeof raw==='object'?raw:{}),
        id:typeof raw==='object'&&raw.id?raw.id:stableId('variant',group.group,job.name,name),
        work_id:workId,
        work_name:job.name,
        name,
        hours:Number(typeof raw==='object'&&raw.hours!=null?raw.hours:job.hours),
        price:Number(typeof raw==='object'&&raw.price!=null?raw.price:job.price),
        customer_description:typeof raw==='object'&&raw.customer_description?raw.customer_description:customerDescription(job,name),
        technical_description:typeof raw==='object'&&raw.technical_description?raw.technical_description:'',
        procedureKey:typeof raw==='object'&&raw.procedureKey?raw.procedureKey:stableId('procedure',group.group,job.name,name),
        technicalDataKey:typeof raw==='object'&&raw.technicalDataKey?raw.technicalDataKey:null
      }
    })}
  })
}))

export const variantName=variant=>typeof variant==='string'?variant:variant?.name||''
export const variantFor=(workId,variantId)=>WORK_CATALOG.flatMap(group=>group.jobs).find(job=>job.id===workId)?.variants.find(variant=>variant.id===variantId)||null
export const catalogRows=()=>WORK_CATALOG.flatMap(group=>group.jobs.flatMap(job=>job.variants.map(variant=>({group:group.group,job,variant}))))
export const workGroups=()=>WORK_CATALOG.map(x=>x.group)
export const jobsForGroup=group=>WORK_CATALOG.find(x=>x.group===group)?.jobs||[]
