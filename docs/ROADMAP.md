# Roadmap

> A [`PRD.md`](PRD.md) lebontása végrehajtható szeletekre. **Egy szelet = egy önállóan
> ellenőrizhető, commitolható egység.** A sorrend egyben a prioritás. A kész szelet
> `[x]` jelet kap, mellé a commit hash-e kerül.
>
> **Jelölések:** 🔶 **DÖNTÉSI PONT**: a tulajdonosnak kell döntenie (ADR), mielőtt a
> rá épülő szeletek indulnak. · 💸 **ÉLŐ HÍVÁS**: API-kvótát fogyaszt, csak a
> tulajdonos jóváhagyásával. · Minden szeletnél ott az **Ellenőrzés**, vagyis az,
> amivel a kész állapot bizonyítható.
>
> Háttér: [`architecture.md`](architecture.md) · [`api/api-football.md`](api/api-football.md) ·
> [`analysis/strategy.md`](analysis/strategy.md)

---

## 0. Alapozás: az agentic fejlesztés feltételei

- [x] **0.0 💸🔶 Free-csomag szezon-hozzáférés mérése + adatforrás-döntés (ADR-0002).**
  A közösségi források szerint a Free csomag 2026-ban csak a 2022–2024-es szezonokat
  engedi ([`api-football.md` §1, §7](api/api-football.md#7-free-csomag-kockázatok-és-alternatív-adatforrások)).
  A teszt: `/status` (ingyenes) → `fixtures?league=39&season=2026&next=1` → szükség
  esetén `season=2025` → `/status`. Ez **legfeljebb 2 hívás**.
  *Ellenőrzés:* az eredmény (az `errors` tartalma) bekerül az ADR-be. A döntés: Free marad /
  Pro / több forrás. **Ettől függ a 3–8. fázis.**
  — `b3a65c8`. **Eredmény:** csak 2022–2024 érhető el. **Döntés (ADR-0002):** Free marad,
  `CURRENT_SEASON = 2024`, élő hívás a napi 100-on belül szabad.
- [x] **0.1 Higiénia:** gyökér `.gitignore`; a félkész változások (szezon 2025, hibatűrés)
  commitolása. — `14fc4e0`, `b083413`, `2199705` (az `ApiKeys.ts` a 0.2-ben megy)
- [x] **0.2 API-kulcs ki a forráskódból:** a kulcsok kikerülnek a `FetchService*.ts` és az
  `ApiKeys.ts` fájlokból, és `.env`-be kerülnek (átmenetileg; az 1. fázisban a backend
  env-jébe költözik); a régi kulcsok érvénytelenítése (a tulajdonos dashboardján).
  *Ellenőrzés:* `git grep` nem talál kulcsmintát; az app a `.env`-ből indul.
  — `5295497`: `frontend/.env` (`REACT_APP_RAPIDAPI_KEY`, `REACT_APP_APISPORTS_KEY`) +
  `.env.example`, az `ApiKeys.ts` törölve; mindkét kulcs bekerül a dev bundle-be.
  **Nyitott (tulajdonos):** a git historyban maradt kulcsok rotálása a RapidAPI és az
  API-Sports dashboardon.
- [x] **0.3 Ellenőrző scriptek:** `npm run typecheck` (`tsc --noEmit`) és
  `npm run format:check` a frontendben.
  *Ellenőrzés:* mindkettő zölden fut le a CI-ban vagy lokálisan.
  — `0705f32`, `872b873`: TS 4.3 → 4.9, Prettier 2.8, egy gyökér `.prettierrc`,
  `verify` = typecheck + format:check + test:ci; `.npmrc`: `legacy-peer-deps`.
- [x] **0.4 Arbitrázsmag kiemelése + tesztek:** az `analyzeBookmaker` logikája tiszta
  függvénybe kerül (`src/core/arbitrage/`), Jest-tesztekkel ismert oddsokra (2-, 3-esélyes
  és gólvonalas eset). Ezt a munkát az 1.1 szelet `packages/core`-ba viszi tovább.
  *Ellenőrzés:* `npm test` zöld; az arbitrázsoldal a cache-ből változatlanul renderel.
  — `d566310`: 8 teszt; javítva: a vártnál több kimenetel nem dob hibát.
- [x] **0.5 Mock- és fixture mód:** a meglévő valós API-válaszokból
  (`frontend/src/data/*.json`, `backend/stores/*.json`) fixture-ök készülnek; kapcsoló
  (`USE_FIXTURES=true`), hogy fejlesztés közben **0 élő hívás** menjen.
  *Ellenőrzés:* mock módban a `MainStore.fetchNumber` értéke 0 marad egy teljes oldalbejárás után.
  — kész: kapcsoló `VITE_DATA_MODE=fixture|live` (alap fixture), `frontend/src/services/fixtures/fixtureResolver.ts`, 9 teszt.
- [x] **0.6 Dokumentáció rendbetétele:** az ADR-ek egy helyre kerülnek (`docs/fe/adr/` →
  `docs/adr/`), és a hivatkozásuk is javul; ADR-sablon; a `CLAUDE.md` naprakészen tartása.
  *Ellenőrzés:* nincs törött relatív link a `docs/` alatt.
- [x] **0.7 CRA → Vite + Vitest** *(a 9.1-ből előrehozva; ADR-0007)*: a CRA nem fordít
  `src/`-n kívüli TS-t, így a közös `packages/core` (amit a backend/API is használ) csak
  Vite mellett működik; ráadásul a CRA megszűnt. A MobX v5 és a viselkedés változatlan;
  `REACT_APP_*` → `VITE_*`; a `/api` proxy a Vite dev szerverben.
  *Ellenőrzés:* `npm run verify` zöld; dev szerver + build megy; a három útvonal renderel.
  — kész: Vite 5.4, Vitest 2.1, TS 5.6; mindhárom útvonal headless Edge-ben renderelve (dev + build).
- [x] **0.8 npm workspaces + `packages/core`** *(az 1.1-ből előrehozva)*: gyökér
  `package.json` (workspaces: `frontend`, `backend`, `packages/*`), egy `npm install`,
  gyökér `verify`; az arbitrázsmag `packages/core`-ba költözik.
  *Ellenőrzés:* gyökérből `npm run verify` zöld; a frontend a `@football/core`-ból importál.
  — kész (ADR-0008): egy lockfile, gyökér `dev`/`verify`/`test`/`format`; a core strict TS.

## 1. Backend-alap: API-proxy, DB, hosting

- [ ] **1.0 🔶 Döntések:** hosting (ADR-0003, **Vercel Hobby** — elfogadva 2026-11-12), DB + ORM
  (ADR-0004, **Supabase** — a tulajdonos választása; ORM: Drizzle javaslat), hozzáférés-védelem (ADR-0005), repó-szerkezet
  (ADR-0008, javaslat: npm workspaces + `packages/*`).
  *Ellenőrzés:* az ADR-ek „Elfogadva” státuszban vannak.
- [ ] **1.1 ~~Workspaces + `packages/core`~~ → előrehozva: 0.8.** gyökér `package.json` (workspaces); az
  arbitrázsmag (0.4) átköltözik, a frontend innen importál.
  *Ellenőrzés:* a frontend build és a tesztek zöldek, a viselkedés változatlan.
- [ ] **1.2 `packages/api-client`:** egyetlen API-Football kliens: host és kulcs env-ből,
  budget-őr (atomikus napi foglalás), szerializálás (≥ 7 s), `errors`-kezelés (a HTTP 200 +
  `errors` is hiba), lapozás, naplózás, mock mód.
  *Ellenőrzés:* unit-tesztek a mock fixture-ökkel (a budget-túllépés, az `errors.plan` és a
  lapozás esetére).
- [x] **1.3 DB-séma v1 + migrációk:** törzsadat, `fixture`, `odds_snapshot` + `odds_quote`,
  `api_budget_day`, `api_call_log`, `ingest_task`, `setting`
  ([`architecture.md` §10](architecture.md#10-adatmodell-postgres-javaslat)); lokális dev DB
  (Docker-es Postgres vagy Supabase CLI lokális stack).
  *Ellenőrzés:* a migráció üres DB-n fut, és ismételt futtatásra idempotens. — **Kész (S06):** `packages/db/migrations`, PGlite-teszt; a lokális/Supabase DB → BLOCKERS.
- [x] **1.4 Import a régi JSON-okból (0 hívás):** a `backend/stores/*-odds.json` (2021,
  Unibet) → `odds_snapshot(source = 'legacy-json')`; a `frontend/src/data/allMatch*_2020/2021.json`
  → `fixture`, `team`, `league`.
  *Ellenőrzés:* a sorok száma egyezik a fájlok elemszámával; a második futás 0 új sort ír.
- [ ] **1.5 Olvasó API-végpontok:** `/api/fixtures`, `/api/odds/:fixtureId`, `/api/budget`
  (a DB-ből, 0 külső hívás), lokálisan futtatva.
  *Ellenőrzés:* integrációs teszt a dev DB-n.
- [ ] **1.6 Hosting és védelem:** deploy, env-ek, DB-integráció; platformvédelem és
  egyfelhasználós app-login (session cookie); a `/api/*` csak bejelentkezve érhető el.
  *Ellenőrzés:* bejelentkezés nélkül 401 vagy a platform belépési oldala jön; bejelentkezve
  a `/api/budget` válaszol.
- [ ] **1.7 Ütemező váz:** `/api/cron/tick` (`CRON_SECRET`, advisory lock, no-op worker),
  15 perces ütemezés (Schedules, vagy tartalékként külső pinger).
  *Ellenőrzés:* 24 óra alatt kb. 96 tick látszik a naplóban, átfedő futás nincs.
- [ ] **1.8 A frontend átállítása:** az `/odds` oldal az új végpontokból olvas; a
  `FetchService*` és az `ApiURLs.FOOTBALL` megszűnik a frontendben (az arbitrázsoldal a
  8. fázisig a régi úton marad).
  *Ellenőrzés:* a böngésző hálózati naplójában nincs külső API-hívás.

## 2. Beállítások (ligák, csapatok)

- [ ] **2.1 Beállítás-modell + API:** `followed_league`, `team_filter`, `setting`
  (EV-küszöb, odds-sáv, tét-mód, backfill-plafon), valamint a **tárolási szabályok**
  ([`architecture.md` §4.1](architecture.md)): `market.stored` + ligánkénti felülírás,
  `bookmaker.stored`, `odds_retention`.
  *Ellenőrzés:* CRUD integrációs teszt; unit-teszt a „melyik piac/iroda tárolandó ebben a
  ligában” feloldó függvényre.
- [ ] **2.2 Liga-katalógus:** a `reference` job (`/leagues`, hetente) és a `coverage`
  flagek tárolása.
  *Ellenőrzés:* mock módban a katalógus feltöltődik; élesben heti 1 hívás.
- [ ] **2.3 Beállítások UI:** ligák és csapatok kiválasztása; a **becsült napi
  hívásköltség** ligánként és összesen (a [`api-football.md` §6](api/api-football.md#6-hívás-budget)
  képlete szerint); a `coverage` jelzések; figyelmeztetés, ha a becslés túllépi a keretet.
  Tárolt piacok és irodák kapcsolói (globálisan és ligánként), snapshot-megőrzés, és a
  **becsült tárhely szezononként** az 500 MB-hoz mérve.
  *Ellenőrzés:* screenshot; unit-teszt a hívásköltség- és a tárhelybecslő függvényre.
- [ ] **2.4 Budget-panel:** a mai felhasznált és maradék hívások, jobonkénti bontás, a
  `/status`-szal egyeztetett érték.
  *Ellenőrzés:* screenshot mock adattal.

## 3. Ingestion (a budgeten belül)

> Előfeltétel: a 0.0 döntése (milyen forrásból, melyik szezon).

- [ ] **3.1 Feladatsor-motor:** planner (idempotens `dedupe_key`), prioritásos worker,
  deadline → `skipped`, újrapróbálás visszalépéssel, a plan- és kvótahiba nem ismétlődik.
  *Ellenőrzés:* unit- és integrációs tesztek mock klienssel (két egymás utáni tick nem
  duplikál, a budget-plafont betartja).
- [ ] **3.2 `reference` jobok:** `teams` (liga × szezon), `odds/bookmakers`, `odds/bets` →
  `market.analyzed`.
  *Ellenőrzés:* mock módban kitöltött törzsadat.
- [ ] **3.3 `fixtures_window` + `results`:** a következő 7 nap meccsei ligánként; meccs után
  `fixtures?ids` (max. 20) az eredménnyel, statisztikával és eseményekkel; második kör +26 órával.
  *Ellenőrzés:* mock: státuszváltás `NS` → `FT`, az eredmény betöltődik, a hívásszám ≤ ⌈n/20⌉.
- [ ] **3.4 `standings` snapshot** a forduló előtti napon.
  *Ellenőrzés:* mock: a snapshot a megfelelő időpontban keletkezik.
- [ ] **3.5 `odds_early` + `odds_late` snapshot:** **lapozással** (10/oldal), csak az elemzett
  piacokkal, a `provider_updated_at` mentésével; a `late` a nap első kezdése előtt ≤ 3 órával.
  *Ellenőrzés:* mock: többoldalas válasz esetén is minden meccs bekerül; snapshotonként
  csak beszúrás történik.
- [ ] **3.5b Tárolási szűrés + megőrzés:** a snapshot mentésekor előbb az `odds_best`
  (legjobb/átlag) számolódik a teljes válaszból, utána csak a `stored` piacok × irodák
  kerülnek az `odds_quote`-ba; napi karbantartó job: lejátszott meccsnél csak a nyitó +
  záró snapshot marad (`odds_retention`).
  *Ellenőrzés:* unit-teszt: a szűrés nem változtatja a `max_odd`-ot; mock: a karbantartás
  után meccsenként ≤ 2 snapshot.
- [ ] **3.6 `injuries`** `ids`-szel (max. 20 meccs / hívás), T−24 órával.
  *Ellenőrzés:* mock: a sérültlista a meccshez kötve tárolódik.
- [ ] **3.7 💸 Élesítés + 1 hét mérés:** a tényleges hívás/nap vs. a becslés; a kihagyott
  késői snapshotok aránya; a tapasztalatok visszavezetése az [`api-football.md` §6](api/api-football.md#6-hívás-budget)
  fejezetbe.
  *Ellenőrzés:* rövid mérési riport a `docs/plans/ingestion-measurement.md`-ben; a napi max. ≤ 100.

## 4. Történeti backfill

- [ ] **4.1 💸 Backfill-jobok (2022–2024):** `fixtures?league&season` (liga × szezon) +
  `fixtures?ids` a statisztikához, **csak a tartalékkeretből** (prioritás 5), több napra
  elosztva.
  *Ellenőrzés:* a backfill-állapot a dashboardon; a napi működés közben nem marad ki egy
  snapshot sem.
- [ ] **4.2 football-data.co.uk import:** CSV → `odds_snapshot(source = 'football-data-csv',
  kind = opening/closing)` + a meccsek párosítása; `team_alias` mapping.
  *Ellenőrzés:* a párosítási arány ≥ 99% a lefedett ligákra; a párosítatlanokról lista készül.
- [ ] **4.3 `standing_derived`:** pont-idejű tabella a meccsekből (`as_of`).
  *Ellenőrzés:* unit-teszt: a szezon végi derived tabella egyezik az API szezonvégi
  `standings`-ével (ahol van snapshot) vagy egy ismert tabellával.

## 5. Predikció-napló és kiértékelés (v0: piaci baseline)

- [x] **5.1 Piaci baseline (B0)** (S03) tiszta függvényként (`packages/core/model/market`):
  margin-mentesítés, konszenzus, legjobb odds.
  *Ellenőrzés:* unit-tesztek ismert oddsokra (a Σp = 1, a margin helyes).
- [ ] **5.2 Predikció-pipeline:** a `derive` lépés az odds-snapshot után; `model_version`,
  `prediction_run`, `prediction` (append-only, `features`, `explanation`, `warnings`).
  *Ellenőrzés:* integrációs teszt: ugyanarra a snapshotra két futás két külön run-t ad, és a
  régi sor nem változik.
- [ ] **5.3 Kiértékelő job:** a `results` után `evaluation` (win/loss/void, profit, Brier,
  log-loss, CLV a záró-közeli snapshottal).
  *Ellenőrzés:* unit-tesztek a képletekre; mock: a PST státuszú meccs void.
- [ ] **5.4 Ajánlások oldal (kezdőoldal):** a mai és holnapi tételek a PRD 6. fejezetében
  felsorolt mezőkkel; az adatok kora; a minimális vállalható odds.
  *Ellenőrzés:* screenshot mock adattal; az oldal betöltése 0 külső hívás.
- [ ] **5.5 Kiértékelő dashboard:** találati arány vs. várt, ROI (flat), Brier, log-loss,
  kalibrációs görbe, CLV; modellverzió-, liga- és piacszűrő; idősor.
  *Ellenőrzés:* screenshot; a mutatók egyeznek egy kézzel ellenőrzött mini-adatkészleten.
- [ ] **5.6 Fogadás rögzítése:** `placed_bet` (Tippmix-odds, tét); „saját” ROI a modell
  ROI-ja mellett.
  *Ellenőrzés:* integrációs teszt; screenshot.
- [ ] **5.7 Odds-history nézet:** egy meccs snapshotjai, az odds mozgása, a legjobb iroda,
  a kimenetel.
  *Ellenőrzés:* screenshot a legacy-json és az élő snapshotokkal.

## 6. Ajánlómotor v1 (Elo + Poisson / Dixon–Coles)

- [ ] **6.0 Terv:** `docs/plans/model-v1.md` (a paraméterek, az illesztés, a backtest-protokoll,
  a holdout), a tulajdonos jóváhagyásával.
- [ ] **6.1 Elo (M1)** + ordinális logit, tesztekkel.
  *Ellenőrzés:* unit-tesztek; az illesztés reprodukálható seed-del.
- [ ] **6.2 Poisson / Dixon–Coles (M2)** + eredménymátrix → 1X2, O/U 2.5 (BTTS előkészítve).
  *Ellenőrzés:* unit-tesztek (a mátrix összege 1; a piacok konzisztensek).
- [ ] **6.3 Backtest CLI** (walk-forward, 2022–2023 tanítás, 2024 holdout), riport:
  Brier, log-loss, kalibráció, ROI és CLV a CSV-oddsokkal.
  *Ellenőrzés:* a riport a `docs/analysis/backtests/<dátum>-<modell>.md`-be kerül; a futás
  determinisztikus.
- [ ] **6.4 💸 API-predikció benchmark** (`api-predictions@1`), csak a jelöltekre / egy ligára.
  *Ellenőrzés:* a benchmark sorai megjelennek a dashboardon.
- [ ] **6.5 🔶 Shadow → live:** M1/M2 shadow módban (≥ 4 hét vagy 150 predikció), utána
  döntés a [`strategy.md` §7.5](analysis/strategy.md#75-modell-életciklus) feltételei szerint.
  *Ellenőrzés:* döntési jegyzet + ADR, ha élesbe kerül.

## 7. Stratégia-iteráció (v2+)

- [ ] **7.1 Kontextus-feature-ök:** motiváció/tét, szezonszakasz × tabella-tier, sérültek
  darabszáma, lövésforma (tiszta függvények + tesztek).
  *Ellenőrzés:* unit-tesztek ismert tabella-állapotokra (eldőlt / élő / kritikus).
- [ ] **7.2 Korrekciós réteg (GLM, offsettel)** + ablációs indoklás (`explanation`).
  *Ellenőrzés:* backtest-riport: a log-loss változása a holdouton.
- [ ] **7.3 Piaci kombinálás (`w`)** + az EV-küszöb hangolása a CLV alapján.
  *Ellenőrzés:* backtest-riport.
- [ ] **7.4 Indoklás-UI:** a tényezők hozzájárulása az ajánlásnál és a meccs-részletben.
  *Ellenőrzés:* screenshot.
- [ ] **7.5 További piacok:** BTTS, Double Chance, gólvonalak.
- [ ] **7.6 Tört-Kelly opció** (a beállításokban; csak ha a [`strategy.md` §6](analysis/strategy.md#6-tétkezelés)
  feltételei teljesülnek).

## 8. Arbitrázsmodul az új backenden

- [ ] **8.1 Arbitrázsszámítás az odds-snapshotokból** (`packages/core/arbitrage`), a
  beállított ligákra, 0 extra hívással.
  *Ellenőrzés:* unit-tesztek; a régi és az új eredmény egyezik ugyanazon az adaton.
- [ ] **8.2 Opcionális teljes piaci pásztázás** (`/odds/mapping` + lapozott `/odds`) kézi
  indítással, **előzetes hívásbecsléssel és megerősítéssel**, napi max. 1×.
  *Ellenőrzés:* mock: a becslés egyezik a ténylegesen indított hívások számával.
- [ ] **8.3 Az arbitrázsoldal átállítása** az új API-ra; a régi `localStorage`-út
  (`ls_Arbitrages`, `ls_AllLeagueIds`) és a közvetlen API-hívások megszűnnek.
  *Ellenőrzés:* a hálózati naplóban nincs külső hívás; screenshot.
- [ ] **8.4 A régi Express és a JSON-tár kivezetése** (archiválás vagy törlés, a tulajdonos
  döntése szerint).

## 9. Frontend-modernizáció (az 1. fázis után bármikor)

- [x] **9.0 🔶 Döntés (ADR-0007):** Vite + Vitest, a MobX v5 marad — elfogadva 2026-11-12.
- [ ] **9.1 ~~CRA → Vite~~ → előrehozva: 0.7.**, a MobX v5 marad, a viselkedés változatlan.
  *Ellenőrzés:* a build, a tesztek és a három régi útvonal screenshotja egyezik.
- [ ] **9.2 MobX 5 → 6, React 17 → 18**, a `--legacy-peer-deps` megszűnik.
  *Ellenőrzés:* tiszta `npm ci`; a screenshotok egyeznek.

## 10. Aktuális szezon: football-data.org (2. kör, a UI és az üzleti logika után)

> Ötlet (tulajdonos, 2026-11-12): az API-Football Free csak 2022–2024-et adja, a
> football-data.org Free viszont **az aktuális szezont is** — a kettő kombinálható.
> Forrás-összevetés: [`api-football.md` §7](api/api-football.md#7-free-csomag-kockázatok-és-alternatív-adatforrások), ADR-0002 „B” opció.

- [ ] **10.0 🔶 Döntés (ADR):** adatforrás-felosztás. Javaslat: football-data.org →
  aktuális meccsek, eredmények, tabella; API-Football Free → 2022–2024 history (meccs,
  statisztika); odds-forrás az aktuális szezonhoz külön kérdés (The Odds API free, vagy
  API-Football Pro) — football-data.org Free-ben **nincs odds, sérült, felállás**.
  Ellenőrizni élesben: lefedett versenysorozatok (Free: 12), 10 hívás/perc, az eredmények
  késleltetése.
- [ ] **10.1 Csapat- és meccs-összepárosítás:** `team_alias(source='football-data-org')`,
  meccs-egyezés (`kickoff_at` ± tűrés + hazai/vendég csapat); a `fixture` kap egy
  `external_ids jsonb` mezőt.
  *Ellenőrzés:* unit-teszt a párosítóra; az 5 top liga egy fordulóján 100% egyezés.
- [ ] **10.2 `packages/api-client` második forrás:** football-data.org kliens (külön
  rate-limit: 10/perc, külön kulcs env-ben), ugyanazzal a budget-/naplózó réteggel.
  *Ellenőrzés:* unit-tesztek fixture-ökkel.
- [ ] **10.3 Ingestion-jobok átkötése:** `fixtures_window`, `results`, `standings` forrása
  ligánként konfigurálható (`followed_league.source`).
  *Ellenőrzés:* mock: ugyanaz a meccs két forrásból nem duplikálódik.

## Parkoló (nem-célok, újranyitható)

Automatikus fogadásleadás · élő (in-play) odds · push / e-mail értesítés · más
sportágak (kosárlabda, baseball) · több felhasználó · Tippmix-odds automatikus
gyűjtése (scraping) · fizetős adatforrás (**kivétel: a 0.0 döntése nyithatja újra**).
