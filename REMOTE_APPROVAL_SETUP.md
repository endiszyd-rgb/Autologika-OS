# Zdalna akceptacja kosztorysów — konfiguracja jednorazowa

1. W Supabase SQL Editor uruchom ponownie `cloud_schema_supabase.sql` z wersji 0.31.0. Skrypt jest idempotentny i doda tabelę `customer_approval_links`.
2. Zainstaluj/zaloguj Supabase CLI i w katalogu projektu połącz projekt (`supabase link --project-ref <REF>`).
3. Wdróż funkcję klienta: `supabase functions deploy approval --no-verify-jwt`.
4. W Autologika OS musisz być zalogowany do tego samego Autologika Cloud.
5. Kosztorys → Wyślij do akceptacji → `Generuj link zdalny`. Link jest kopiowany do schowka.
6. Klient otwiera link na dowolnym telefonie. Po decyzji w Autologika kliknij `Sprawdź decyzję` (automatyczny polling będzie kolejnym etapem).

Bezpieczeństwo: link ma losowy token 192-bit, wygasa po 7 dniach, funkcja pokazuje tylko zamrożony snapshot kosztorysu i nie daje dostępu do bazy warsztatu. Service Role pozostaje wyłącznie po stronie Supabase Edge Function.
