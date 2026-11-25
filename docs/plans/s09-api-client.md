# S09 – packages/api-client + budget-őr (ROADMAP 1.2)

**Cél:** egyetlen API-Football kliens, amin minden élő hívás átmegy; a 100/nap plafont soha nem lépi túl.

## Döntések

- `@football/api-client` I/O-csomag, **nem függ** a `@football/db`-től: a budget és a napló interfész (`BudgetStore`,
  `CallLogger`). Két megvalósítás: memória (teszt/mock) és SQL (bármely `{ query }` executor fölött – a `@football/db`
  `SqlExecutor`-a strukturálisan illik rá), az `api_budget_reserve()` és az `api_call_log` tábla fölött.
- Env (csak szerver): `API_FOOTBALL_KEY`, `API_FOOTBALL_HOST` (alap `v3.football.api-sports.io`), `API_FOOTBALL_MODE=mock|live`
  (alap **mock**). Élő mód kulcs nélkül hibát dob. Header: `x-apisports-key`.
- Budget-őr a hívás ELŐTT (atomikus foglalás, UTC-nap); `null` → `ApiFootballError('budget')`, nincs fetch.
- Szerializálás: egy sor (promise-lánc), két hívás között ≥ 7 s (`minIntervalMs`, injektálható óra/sleep a tesztekhez).
- Hiba: HTTP ≠ 2xx, vagy az `errors` nem üres (tömb vagy objektum). Fajták: `plan`, `quota` (`requests`), `token`, `http`,
  `api`, `budget`. `retryable` csak `http` 5xx/429 esetén.
- Lapozás: `getAllPages` a `paging.total` alapján, `maxPages` plafonnal; minden oldal külön foglalás.
- `/status`: nem foglal budgetet, a `requests.limit_day − current` → `BudgetStore.sync(remaining)`.
- Mock mód: a válasz egy fixture-térképből (`endpoint` + rendezett paraméterek), nincs fetch, nincs foglalás, nincs várakozás;
  a napló `mock = true`.

## Tesztek

budget-túllépés (nincs fetch), `errors.plan` (nem retryable), lapozás (3 oldal, 3 foglalás), szerializálás (≥ 7 s), mock-mód,
`/status` sync, SQL-store PGlite-on (`api_budget_reserve`, `api_call_log`).
