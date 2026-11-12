# ADR 0002 — Adatforrás: a Free API-Football csomag szezon-korlátja

- **Státusz:** Elfogadva (2026-11-12) — PRD D1
- **Dátum:** 2026-11-12
- **Kapcsolódó:** `docs/api/api-football.md` §1, §7 · ROADMAP 0.0

## Mérés (2026-11-12, direkt API-Sports host, `v3.football.api-sports.io`)

| Hívás | Eredmény |
|---|---|
| `GET /status` | `plan: "Free"`, `active: true`, előfizetés vége `2027-06-12`, `requests.current: 0`, `limit_day: 100` |
| `GET /fixtures?league=39&season=2026&next=1` | HTTP 200, `results: 0`, `errors.plan: "Free plans do not have access to this season, try from 2022 to 2024."` |
| `GET /standings?league=39&season=2025` | HTTP 200, ugyanez az `errors.plan` hiba |
| `GET /status` (utána) | `requests.current: 0` — **a plan-hibás hívás nem fogyasztott kvótát** |

## Következmény

- A Free csomag **csak a 2022–2024-es szezonokat** adja. Sem a futó (2026), sem az előző
  (2025) szezon nem érhető el: **közelgő meccs, aktuális tabella, sérültlista és pre-match
  odds nincs** — a PRD fő funkciójának (ajánlás közelgő meccsekre) nincs adatforrása.
- A 2022–2024 szezonok **historikus** adatai (meccsek, eredmények, statisztikák, tabellák)
  elérhetők → backtesthez, modellépítéshez használhatók. Múltbeli odds az API-ból ettől
  függetlenül sem kérhető le (7 napos megőrzés).
- A `CURRENT_SEASON = 2025` konstans a Free kulccsal így nem működik.
- A hiba HTTP 200-zal jön → a kliensnek az `errors` mezőt kell hibának tekintenie.

## Opciók

| | Opció | Költség | Mit ad | Hátrány |
|---|---|---|---|---|
| A | **API-Football Pro** | 19 USD/hó (2026-03-as árlista) | Minden szezon, 7 500 hívás/nap, egy forrás, a meglévő kód és doksi marad | Havidíj |
| B | **Vegyes ingyenes források**: API-Football Free (2022–2024 history) + football-data.org (aktuális meccsek, tabella) + The Odds API (pre-match odds) | 0 | Működő ajánló közelgő meccsekre | 3 API, 3 séma, csapat-/meccs-azonosítók összepárosítása; sérültlista nincs; szűkebb keretek |
| C | Free marad, csak history | 0 | Backtest és modellkutatás | **Nincs ajánlás közelgő meccsekre** — a fő cél nem teljesül |

## Döntés

**C-vel indulunk (Free API-Football, 2022–2024 szezonok), amíg a felület és az üzleti
logika (elemzés, ajánlás, kiértékelés) el nem készül.** A historikus adat erre teljesen
megfelel. Az aktuális szezonhoz később választunk **A** (Pro) és **B** (vegyes ingyenes
források) között — ez külön ADR lesz, amikor az élesítés napirendre kerül.

- **`CURRENT_SEASON = 2024`** (a Free csomagban elérhető legfrissebb szezon).
- **Élő hívások engedélyezettek a napi 100-as kereten belül** — a lekérés, a mentés és az
  ingestion valós API-n tesztelhető. A plan-hibás hívás nem fogyaszt kvótát.
- A UI- és logikafejlesztés alapértelmezésben **mentett adatból** (fixture / DB) dolgozik,
  hogy a keret a valódi lekérés-tesztekre maradjon, és a fejlesztés determinisztikus legyen.
- Pre-match odds a 2022–2024 szezonokra az API-ból nem kérhető le (7 napos megőrzés) →
  az odds-alapú logikát (EV, arbitrázs) a meglévő mentett odds-JSON-okon és/vagy a
  football-data.co.uk historikus odds-CSV-in fejlesztjük.
