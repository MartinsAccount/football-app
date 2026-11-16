# STATE – autonóm fejlesztés állapota

> Minden session ezt olvassa el ELSŐKÉNT, és minden szelet végén frissíti. Ha minden szelet kész, írd az „Aktuális fázis” alá
> külön sorba, üres sorok közé: `ALL_DONE`

## Aktuális fázis

**Ingestion-alap (lokális, mock)** – ROADMAP 1.7 (váz), 2.1, 3.1; deploy (1.6) és 💸 szeletek nélkül. Előtte: Supabase-bekötés és
Mobil M1–M11b kész. Ha a szeletlista kiürült, vagy csak blokkolt elem maradt, ide (e fejezet alá) külön sorba, üres sorok közé:
`ALL_DONE`

M1 (docs/GOAL-M1.md): S01–S24 kész, az M1 végállapota teljesült (lezárva).

Floodlight v0.2 redesign: lezárva.

**Kész: „Floodlight v0.2” redesign** (S25–S30). Terv: `docs/plans/redesign-floodlight-v0.2.md` (a tulajdonos jóváhagyta,
2026-11-13); csomag: `docs/design/floodlight-v0.2/` (DESIGN.md, CHANGES.md „Kész, ha” pontok, screens/, reference/).

## Következő szeletek (sorrendben, az első a soron következő)

**Ingestion-alap (ROADMAP 1.7, 2.1, 3.1 – lokálisan, PGlite/mock, 0 élő hívás; adatvesztő migráció nincs):**

1. ~~I1 – 1.7 Ütemező váz lokálisan~~ kész (Vercel-schedule: BLOCKERS).
2. ~~I2 – 2.1a Beállítás-repository + tárolási feloldó~~ kész.
3. ~~I3 – 2.1b Beállítás-API~~ kész (web/mobil átkötése: külön szelet, később).
4. ~~I4 – 3.1a Feladatsor-mag (core, tiszta)~~ kész.
5. ~~I5 – 3.1b Worker a tickben~~ kész.
6. ~~I6 – 3.2 `reference` jobok (mock)~~ kész.
7. ~~I7 – 3.3a `fixtures_window` (mock)~~ kész.
8. ~~I8 – 3.3b `results` (mock)~~ kész.
9. ~~I9 – 3.4 `standings` snapshot (mock)~~ kész.
10. ~~I10 – 3.5 `odds_early` + `odds_late` snapshot (mock)~~ kész.
11. ~~I11 – 3.5b `odds_best`~~ kész (a megőrzési job törlés → BLOCKERS).
12. ~~I12 – 3.6 `injuries` (mock)~~ kész.
13. ~~I13 – 4.3 `standing_derived`~~ kész.
14. ~~I14 – 5.2 Predikció-pipeline~~ kész.
15. ~~I15 – 5.3 Kiértékelő job~~ kész.
16. ~~I16 – 2.2 Liga-katalógus~~ kész.
17. ~~I17 – 5.5 Kiértékelő olvasó-API DB-ből~~ kész (`GET /api/evaluation?model=`).
18. ~~I17b – 5.5 Kiértékelés-oldal bekötése (web)~~ kész (`LiveEvaluation` „Élő (DB)” blokk).
19. ~~I17c – 5.5 mobil „Élő (DB)” blokk~~ kész (formázók: core `evaluation/liveView.ts`).
20. ~~I18a – 2.3 Beállítások ↔ `/api/settings` (web)~~ kész.
21. ~~I18b – 2.3 Liga-katalógus a Beállításokban~~ kész (`GET /api/leagues`, core `leagueCatalog`).
22. ~~I18c – 2.3 Csapatszűrő UI (web)~~ kész (`GET /api/leagues/:id/teams`, core `teamFilters`).
23. ~~I18d – mobil Beállítások ↔ `/api/settings`~~ kész (szinkron + liga-katalógus + csapatszűrő a `PreferencesProvider`-ben).
24. ~~I18e – csapatszűrő alkalmazása~~ kész (core `teamFilter`, planner + `loadPlannerInput`, predikció: csak az ajánlás).
25. ~~I18f – 2.3 ligánkénti piac-felülírás UI (web)~~ kész (core `ISettings.leagueMarkets`, `LeagueMarkets.tsx`).
26. ~~I19 – 2.4 Budget-panel~~ kész (`GET /api/budget` jobs/status/cron, core `budgetView`, web `BudgetChip` a fejlécben).
27. ~~I20 – 5.7 Odds-history nézet (web)~~ kész (`/match/:id`, core `odds/matchView`).
28. ~~I20b – pillanatkép DB fixture-id-val~~ kész (`src/import/csvFixtureIds.ts`, S11b-párosítás).
29. ~~I21 – Budget-panel mobilon~~ kész (`/budget` képernyő, link a Beállításokból).
30. I22 – 8.1 Arbitrázsszámítás az odds-snapshotokból (core `arbitrage` + `odds_best`/snapshot, a beállított ligákra, 0 hívás).
31. I23 – 5.6 Fogadás rögzítése (`placed_bet` migráció + repository + „saját” ROI; UI külön szelet).

**Supabase (ROADMAP 1.4–1.8):** élő API-Football-hívás nem kell; Vercel-deploy továbbra is BLOCKERS. A `DATABASE_URL` a gyökér
`.env`-ben (ne módosítsd, ne írd ki). Csak upsert/insert, adatvesztő művelet nincs. Valódi DB-hez: `NODE_OPTIONS=--use-system-ca`.

Az SB1–SB6 kész, a Supabase-fázisban nincs több nyitott szelet (deploy: BLOCKERS).

<!-- Javasolt nagy sorrend, ha a ROADMAP.md mást mond, az az irányadó:
A. Design (frontend/src/design/DESIGN.md): A1 tokenek bekötése + format.ts (core) → A2 komponensek → A3 oldalak
B. App shell, navigáció, új route-ok üres oldalakkal (/, /evaluation, /settings)
C. DB-séma + ingestion váz mock API-val, hívás-budget számláló
D. /settings oldal (ligák, piacok, budget-kijelzés)
E. Modell-mag (tiszta függvények + unit tesztek) mentett 2022–2024 adaton
F. Ajánlások oldal (/) DB-ből
G. Kiértékelő mag + /evaluation dashboard
H. Odds-history (meccs nézet), /odds és /fixtures beolvasztása
I. Arbitrázs átköltöztetése az új backendre
-->

Minden szeletnél: a terv „Szeletek” pontja + CHANGES.md megfelelő fejezete. Screenshot: sötét + világos × 1440 + 390
(`?theme=light|dark`) → `docs/plans/screens/<szelet>-<oldal>-<téma>-<szélesség>.png`, összevetés a csomag screens/-ével. Adatot
nem találunk ki: a terv „Hiányzó adat” blokkjai rejtve. Üzleti logika / modell / ingestion / DB-séma nem változik.

**Mobil (ROADMAP 11):**

M1–M11 kész. A Mobil szeletlista kiürült; a ROADMAP 11.7-ből csak az APK-build (EAS) maradt – EAS-fiók/build-szolgáltatás kell,
ezért BLOCKERS-jelölt (fiók-beállítás). Polish-jelölt: tab-navigáció (6 képernyő).

Nincs nyitott szelet a redesign-fázisban. Következő: a ROADMAP következő nyitott szelete (vagy a lenti „Nyitott hiányzó adat”
tételek).

### Nyitott hiányzó-adat tételek (Floodlight v0.2 után)

1. „Miért?” csipek pp-értékkel: a pillanatkép nem menti a `FactorContribution`-t → csip-sor rejtve.
2. Tabella-zónák (BL/EK/kiesés): `standings.description` nincs a forrásban → sáv zóna-színezés nélkül.
3. Sérültlista-lefedettség: nincs strukturált jelző → a chip csak `warnings`/`source` alapján.
4. Szegmentált kalibráció: a backtest csak piaconként ad kalibrációt → „összesített adat” pill.
5. API `/predictions` baseline (PRD 9): nincs adat → nem szerepel a sikermutatók közt.
6. Liga-coverage a Beállításokban: a DB `season.coverage`-éből (I18b); a helyi PGlite-ban nincs tárolt coverage (a mock
   `reference:leagues` fixture-ből származtat) → nincs jelzés, amíg egy `leagues.json` mock vagy élő hívás nem tölti.

## Kész

| Szelet                                 | Commit                                                                               | Megjegyzés                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S01 – 0.5 Fixture-mód                  | (lásd git log: feat(data): fixture mode)                                             | `VITE_DATA_MODE=fixture                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | live`, alap fixture; resolver: `frontend/src/services/fixtures/`                                                                                |
| S02 – A1 Tokenek bekötése              | (lásd git log: feat(design): wire Floodlight tokens)                                 | `npm run tokens` (predev/prebuild), tokens+components.css az `index.tsx`-ben, Tailwind theme `var(--…)`                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| S03 – Core format + odds-matek         | (lásd git log: feat(core): add Hungarian format)                                     | `format/format.ts`, `model/market.ts` (B0: fair p, konszenzus, legjobb odds), `odds/value.ts` (EV, edge, min. odds)                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| S04 – Core szelvény-matek              | 2e38979                                                                              | `slip/slip.ts`: `summarizeSlip`, `riskLevel`, `slipTypeName`, `addLeg`/`hasFixture` (egy meccs = egy tipp), `legOdds`                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| S05 – B App shell                      | (lásd git log: feat(ui): add app shell)                                              | AppShell/AppHeader/PageIntro/EmptyState; `/`, `/evaluation`, `/settings`; `/odds`,`/fixtures` → `/`, régi nézetek `/legacy/*`; ui-audit #4, #12                                                                                                                                                                                                                                                                                                                                                                                                            |
| S06 – 1.3 DB-séma                      | (lásd git log: feat(db): add Postgres schema)                                        | `packages/db`: `migrations/0001–0005_*.sql` (§10 teljes), `migrate()` + `schema_migration` checksum; PGlite-teszt; `api_budget_reserve` ≤ 100                                                                                                                                                                                                                                                                                                                                                                                                              |
| S07 – DB repository                    | (lásd git log: feat(db): add repository)                                             | `Repository` + `SqlRepository` (`SqlExecutor` fölött), `openMemoryRepository()` = PGlite+migrate; upsert → `{inserted,updated,unchanged}`                                                                                                                                                                                                                                                                                                                                                                                                                  |
| S08 – 1.4 Legacy import                | (lásd git log: feat(db): import legacy JSON)                                         | `npm run import:legacy -w @football/db [-- dataDir]` → `.data/pglite`; 3656 fixture, 510 snapshot, 150 899 quote; a 2. futás 0 írás                                                                                                                                                                                                                                                                                                                                                                                                                        |
| S09 – 1.2 api-client + budget          | (lásd git log: feat(api-client))                                                     | `@football/api-client`: `ApiFootballClient` (mock/live), `SqlBudgetStore` (`api_budget_reserve`), `SqlCallLogger`, `getAllPages`, `status()`                                                                                                                                                                                                                                                                                                                                                                                                               |
| S10 – 1.5 Olvasó API                   | (lásd git log: feat(server))                                                         | `@football/server`: `createApiHandler({repo,budget})` Web Request→Response; `/api/fixtures` (szűrés+lapozás), `/api/odds/:id`, `/api/budget`; `npm run dev -w @football/server` :5100                                                                                                                                                                                                                                                                                                                                                                      |
| S11a – Történeti meccsek               | (lásd git log: feat(data): fetch 2022–2024 history)                                  | 15 élő hívás (`fetch:history`, napló: `api_call_log`); `data/history/api-football` 5341 meccs + `football-data` 15 CSV; `import:history` idempotens                                                                                                                                                                                                                                                                                                                                                                                                        |
| S11b – CSV-odds import                 | (lásd git log: feat(data): import football-data CSV odds)                            | `import:odds-csv`: 5330/5330 párosítva, 11 170 snapshot (opening/closing), ~213k quote, 119 `team_alias`; 2. futás 0 írás                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| S12 – Core feature-ök                  | (lásd git log: feat(core): add match features)                                       | `features/`: `teamForm`, `homeAwaySplit`, `leagueHomeAdvantage`, `headToHead`, `deriveStandings` (4.3 mag), `tablePosition`, `seasonPhase`/`tableTier`, `teamMotivation` (§3.1), `buildMatchFeatures`                                                                                                                                                                                                                                                                                                                                                      |
| S13 – Modell v0                        | (lásd git log: feat(core): add elo-poisson model)                                    | `model/elo.ts` (inkrementális Elo), `poisson.ts` (Dixon–Coles mátrix → 1X2/O-U 2.5/BTTS), `eloPoisson.ts` (`eloPoissonPrediction`, ablációs indoklás); terv: `docs/plans/model-v0.md`                                                                                                                                                                                                                                                                                                                                                                      |
| S14 – Kiértékelés + budget             | (lásd git log: feat(core): add evaluation and budget estimates)                      | `evaluation/` (`settleBet`, `flatProfit`, `brierScore`, `logLoss`, `closingLineValue`, `calibrationBuckets`, `summarizeBets`, `summarizeProbabilities`); `budget/` (`estimateLeagueCallsPerRound`, `estimateDailyCalls`, `estimateOddsStorage`)                                                                                                                                                                                                                                                                                                            |
| S15 – Backtest-futtató                 | (lásd git log: feat(core): add walk-forward backtest)                                | `backtest/` (`runBacktest`, `summarizeSegment`, `buildBacktestReport`); `npm run backtest -w @football/db` (CSV, 0 hívás) → `data/backtest/backtest-v0.json` + `docs/analysis/backtest-v0.md`; v0 LL 1X2 0,997 vs. záró 0,957                                                                                                                                                                                                                                                                                                                              |
| S16 – A2a TipCard                      | (lásd git log: feat(ui): add TipCard)                                                | `components/TipCard/`: `TipCard`, `TeamForm`, `ProbabilityBars`, `TipActions`, `Disclosure`, `tipView.ts` (`ITip` = PRD 6 nézet-modell, magyar címkék); `components/EngineBanner/`; `/` minta-kártyákkal (`sampleTips`), screenshot 1440/390                                                                                                                                                                                                                                                                                                               |
| S17 – A2b MatchDetails                 | (lásd git log: feat(ui): add MatchDetails)                                           | `components/MatchDetails/`: `LeagueStrip`, `H2HList`, `RecentList`, `matchDetailsView.ts` (sáv-zónák, H2H/forma összegzés); core `formatDecimal`/`formatSignedInt`; `ITip.leagueSize`; minta-H2H; screenshot 1440/390                                                                                                                                                                                                                                                                                                                                      |
| S18 – 5.4 Ajánlások oldal              | (lásd git log: feat(ui): recommendations page)                                       | core `recommend/` (`blendProbabilities` w=0,25, `evaluateMarket`, `pickRecommendation`, `dataWarnings`, `confidenceLevel`, snapshot-típusok); `npm run recommendations -w @football/db` → `data/recommendations/recommendations-v0.json` (2025-04-12/13: 40 meccs, 2 tipp); `/` Ma/Holnap + indoklás; screenshot 1440/390                                                                                                                                                                                                                                  |
| S19 – SlipStore + SlipPanel            | (lásd git log: feat(ui): add SlipStore and SlipPanel)                                | core `parseOddsInput`/`transferStatus`; `stores/SlipStore.ts` (MainStore.SlipStore; tét 500–5000, beírt odds, `save()` → localStorage `oe_saved_slips`); `components/SlipPanel/` (SlipLegs, SlipTotals, RiskMeter, StakeSelector, TippmixTransfer, `slipView.ts`); `/` `.oe-split`; screenshot 1440/390 (CDP-kattintással kitöltve)                                                                                                                                                                                                                        |
| S20 – Mobil szelvény + presetek        | (lásd git log: feat(ui): add mobile slip and SlipPresets)                            | core `slip/presets.ts` (`presetCandidates`, `buildSlipPresets`: Szingli/Dupla/Hármas, „Ajánlott” = max EV nem magas kockázattal); `SlipStore.applyPreset`/`hasExactly`/`openSheet`; `SlipPresets`, `SlipBar`, `BottomSheet` (Esc, háttér, ✕, fókusz vissza); < 640 px: `.oe-slip--desktop` rejtve; screenshot 1440/390 (sáv + lap)                                                                                                                                                                                                                         |
| S21 – `/evaluation` dashboard          | (lásd git log: feat(ui): evaluation dashboard)                                       | `pages/EvaluationPage/`: `evaluationView.ts` (szegmens-opciók, `betTiles` ROI ±1,96 SE, `scoreRows` modell/nyitó/záró, `verdict`, `segmentRows`, `calibrationPoints`/`calibrationError`), `CalibrationChart` (SVG, tokenekkel); szűrő: piac (1X2/Gól 2,5) + szegmens (szezon/liga, a bontás-sorra kattintva is); forrás `data/backtest/backtest-v0.json`; screenshot 1440/390                                                                                                                                                                              |
| S22 – `/settings`                      | (lásd git log: feat(ui): settings page)                                              | `pages/SettingsPage/settingsView.ts` (katalógus: 9 liga, 3 piac, 8 iroda; `sanitizeSettings`, `estimateSettings` a core `budget/`-ből, `settingsWarnings`, `stakeOptions`); `stores/SettingsStore.ts` (localStorage `oe_settings`); a SlipStore tét-lépcsője az alapegységből; screenshot 1440/390                                                                                                                                                                                                                                                         |
| S23 – `/arbitrage`                     | (lásd git log: feat(ui): arbitrage page)                                             | core `arbitrage/scan.ts` (`scanMarket`, `arbitrageSum`, `arbitrageStakes`, `arbitrageBand`, `ArbitrageSnapshot`; egyezik a régi `analyzeBookmakers`-szel); `npm run arbitrage -w @football/db` → `data/arbitrage/arbitrage-v0.json` (88 meccs, 3 arb, 70 közeli); kártyák, sáv/piac/iroda szűrő, tét-elosztás 10 Ft-ra; régi oldal `/legacy/arbitrage`; screenshot 1440/390                                                                                                                                                                                |
| S24 – M1 zárás                         | (lásd git log: chore(m1): close M1)                                                  | ui-audit P0/P1: a régi `/legacy/*` nézetek kikerültek a routingból (→ `/`), így #1–8 sehol nem áll fenn; screenshot 1440/390 minden route-ról (`/`, `/evaluation`, `/settings`, `/arbitrage`, `/odds`→`/`): scrollWidth ≤ viewport, 0 konzolhiba; `npm run verify` zöld                                                                                                                                                                                                                                                                                    |
| S25 – Tokenek és téma                  | (lásd git log: feat(design): adopt Floodlight v0.2 tokens)                           | v0.2 tokens(+light)/components.css (vendor)/DESIGN.md/reference; inline téma-script; `stores/ThemeStore.ts` (system/dark/light, `oe-theme`) + `AppShell/ThemeToggle`; kieső oe-_ → v0.2 osztály vagy `components/ui/oeClasses.ts` (Tailwind, tokenből); ADR-0009; screenshot 16 db `docs/plans/screens/s25-_`                                                                                                                                                                                                                                              |
| S26 – Közös keret                      | (lásd git log: feat(ui): common header)                                              | `.oe-status-pill[data-state]` (saved/live), nav ≥ 44 px; `PageIntro/PageHead.tsx` (`.oe-page-head`, meta-chipek, `filters` slot) a Kiértékelés/Arbitrázs/Beállítások oldalon; `evaluationHeadChips`, `arbitrageHeadChips`; liga-checkbox semleges; screenshot 16 db `docs/plans/screens/s26-*`                                                                                                                                                                                                                                                             |
| S27b – Szelvény + presetek             | (lásd git log: feat(ui): slip panel with presets)                                    | core `slip/presets.ts` §8.2 (Szingli/Dupla/Hármas, „Ajánlott” csak low/medium szingli), `slip/oneIn.ts` (`hungarianOrdinal`, `oneInText`; „Kész, ha” tesztek); presetek az üres `.oe-slip`-ben (`SlipPresets` a `SlipPanel`-en belül, `presetTips` prop); „Szelvény ürítése” (`SlipStore.clear`); BottomSheet törölve, SlipBar → `#szelveny`; `shots.mjs --click`                                                                                                                                                                                          |
| S27a – Tippkártya + adat-állapot       | (lásd git log: feat(ui): redesign tip card)                                          | `.oe-hero` + `PageIntro/DataState.tsx` (`dataState(snapshot)`: „Mentett adat · 2025. ápr. 12–13.”, „Odds 17 órás”, „Mit jelent?”), EngineBanner törölve; TipCard a referencia sorrendjében (`.oe-decision`, `ProbabilityTile` `--p`/`--m`, `.oe-tip__details` hidden, `.oe-tip__source`); core `formatDateRange`; tabella-zónák nélkül; `frontend/scripts/shots.mjs`                                                                                                                                                                                       |
| S28 – Kiértékelés                      | (lásd git log: feat(ui): evaluation verdict)                                         | core `evaluation/goals.ts` (`evaluateGoals` 5 PRD-cél ok/fail/info, ROI < 300 tipp → info, `roiInterval`, `ciScale`, `calibrationDotSize`, `calibrationFlags`, `calibrationError`) + `verdict.ts` (`evaluationVerdict`: tónus §8.3, cím, 2 mondat számokkal; teszt: mostani számok → negative, 2/5); core `formatClv`/`formatSignedDecimal`; oldal `.oe-stack`: fej → `.oe-verdict` → sikermutatók → KPI-k → pontosság → kalibráció (`.oe-chart` + `.oe-calib-row`) → bontás; `EvaluationSections.tsx`; screenshot `docs/plans/screens/s28-*` (+ `-gol25`) |
| S29 – Arbitrázs                        | (lásd git log: fix(arbitrage): label by rounded payout)                              | core `arbitrageStakes` → `staked` + `band` (arb csak Σ<1 és kerekítve `worstPayout ≥ staked`), `roundedBand`; teszt: Monza–Napoli odds → „near”; view: címke/szűrő/számlálók a kerekített sávból (`arbitrageTiles(snap,total)`), `historicalNotice(source)`, `ARBITRAGE_SUBTITLE` chip; `PageHead` `notice` slot (`.oe-pill--warning`), szűrők a fej jobb oldalán; kártya `.oe-tip`; `cardSelected` törölve; screenshot `docs/plans/screens/s29-*`                                                                                                         |
| M1 – PWA (11.1)                        | (lásd git log: feat(pwa): add manifest, service worker)                              | `public/manifest.json` (Odds elemző, hu, standalone, canvas #0B1220), ikonok `public/icons/` (SVG forrás → headless Edge PNG 192/512/maskable 512); `public/sw.js` (shell precache + verziózott cache, `/api/*` és `*.json` network-first, navigáció → `index.html` fallback, egyéb azonos originű GET cache-first); `vite.config.ts` `pwaPrecache` plugin tölti a precache-listát/BUILD_ID-t; szabály: `src/pwa/cacheStrategy.ts` (teszt veti össze a sw.js-sel); `OfflineIndicator` az AppShellben; screenshot `docs/plans/screens/m1-*`                 |
| M2 – contract (11.2)                   | (lásd git log: feat(contract): add read-API contract package)                        | `packages/contract` (`@football/contract`): DTO-k (`FixturesResponse`, `OddsResponse`, `BudgetResponse`, `ApiErrorBody`), `createApiClient({ baseUrl, token?, fetch? })` (`listFixtures`/`getOdds`/`getBudget`), `ApiError` (status 0 = hálózat), `buildFixtureQuery`; nincs DOM-lib a tsconfigban; server `satisfies`-szal köti; szerződés-teszt `packages/server/src/contract.test.ts`                                                                                                                                                                   |
| M3 – Bearer auth (11.3)                | (lásd git log: feat(server): add bearer token auth)                                  | `packages/server/src/auth.ts`: `authorize(req, config)` (Bearer, sha256-hex Web Crypto, időzítés-biztos összevetés; hash nélkül dev nyitott, production 401; `authorizers` bővítési pont a web-sessionnek), `authConfigFromEnv`, `hashToken`; `createApiHandler({ auth })` → 401 `unauthorized` + `WWW-Authenticate: Bearer`; `toNodeListener` továbbítja a fejléceket; `npm run token -w @football/server`; contract `ApiErrorCode` + `unauthorized`                                                                                                      |
| M4 – Hordozható állapot (11.4)         | `5554718` (M4a) + `5e8f7c4` (M4b)                                                    | core: `storage/keyValue.ts` (async `KeyValueStorage` + `SyncKeyValueStorage`, memória-impl., `loadStored*`/`saveStored*`, codec), `settings/settings.ts` (a volt `settingsView` tiszta része + `settingsCodec`), `theme/theme.ts`, `slip/savedSlip.ts`; web: `shared/storage/webStorage.ts`; kulcsok/formátum változatlan                                                                                                                                                                                                                                  |
| M5 – `packages/theme` (11.5)           | `ff5e4fd`                                                                            | `@football/theme`: `rnThemes { dark, light }`, `rnTheme(name)`, `tokenPaths` (generált `src/theme.generated.ts`, a `build-tokens.mjs` írja); px/ms → szám, árnyék RN-alakban; `tokens:check` a frontend verify-ban; `tokens.ts` a core-ból re-exportálja a ThemeName/ThemePreference/THEME_STORAGE_KEY-t; screenshot `m5-1440` (web változatlan)                                                                                                                                                                                                           |
| M6 – Expo-váz (11.6)                   | `0379a0b`                                                                            | `apps/mobile` (Expo SDK 58, expo-router, TS; NEM workspace-tag, saját lockfile; Metro `watchFolders`+`extraNodeModules`, TS `paths`): Meccsek-képernyő (`listFixtures`, `rnTheme` rendszer szerint, core `format*`), Kapcsolat-képernyő (base URL + token `expo-secure-store`), offline: core `storage/cachedResponse.ts` (`loadWithCache`) + AsyncStorage-adapter; `tsc` és `expo export --platform android` zöld                                                                                                                                         |
| S30 – Beállítások                      | (lásd git log: feat(ui): settings sections)                                          | szekció-menü (`SettingsNav`: asztalon bal oszlop, mobilon görgethető chip-sor, `aria-current` semleges); `missingCoverage` (csak a hiány, `.oe-pill--warning`); piac/iroda/liga jelölőnégyzetes tömör sorok; Megjelenés `.oe-segmented` → `ThemeStore.setPreference`; `SettingsStore` `saved`/`draft`/`dirty`/`save`/`discard`, localStorage csak mentéskor, szelvény a mentettet követi; `SaveBar` + `settingsDiff`; `toggleBtn` törölve; screenshot `s30-*`, `s30-*-mentes`, záró `s30-final-*` (16)                                                     |
| SB1 – Import-cél: PGlite vagy Supabase | (lásd git log: feat(db): batch odds import)                                          | `openTarget()` (`--pg` / env `DATABASE_URL`), köteges `insertOddsSnapshots` (unnest, kötegenként ~5 lekérdezés; a CSV-import 2. futása ~2 s), `openPg` időkorlátokkal; PGlite-on a számok egyeznek S08/S11/S11b-vel                                                                                                                                                                                                                                                                                                                                        |
| SB2 – Server Postgres-adapter          | (lásd git log: feat(server): serve read API from Postgres)                           | `dev.ts` → `openTarget` (`-- --pg` vagy env `DATABASE_URL`, különben PGlite); `pg.integration.test.ts` (`skipIf(!DATABASE_URL)`) átment a Supabase-en; `openPg` sorba fűzi a lekérdezéseket (pg@9 deprecation)                                                                                                                                                                                                                                                                                                                                             |
| SB1b – Import a Supabase-en            | (lásd git log: feat(db): batch upserts for remote import)                            | history/legacy/odds-csv `--pg`: 5341 + 3656 fixture, 510 legacy (150 899 quote) + 11 170 CSV-snapshot, 119 alias; 2. futás: fixture/odds 0 írás. `SqlRepository.upsert` kötegelt (több soros VALUES): a history-import 637 s → 5 s                                                                                                                                                                                                                                                                                                                         |
| SB3 – /odds → olvasó API               | (lásd git log: feat(frontend): read odds stats from the read API)                    | `services/readApi.ts` (`createApiClient`), Vite-proxy `^/api/(fixtures                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | odds/                                                                                                                                           | budget)`→ :5100;`OddsPage/services/oddsMatch.ts` (tiszta, tesztelt); OddsStore lusta, 2021 FT meccsek 1X2-vel (505 db); mentés-gomb (külső hívás) kikerült |
| SB4 – Snapshot-végpontok               | (lásd git log: feat(server): serve recommendation, backtest and arbitrage snapshots) | `/api/recommendations`, `/api/backtest`, `/api/arbitrage`; forrás `SnapshotSource` (ma `fileSnapshotSource(data/)`, kérésenként olvas; hiány → 404); contract: `getRecommendations/getBacktest/getArbitrage`, `ArbitrageResponse` drótforma (`sum: null`) → `reviveArbitrageSnapshot`; Vite-proxy bővítve                                                                                                                                                                                                                                                  |
| SB5 – Snapshot-oldalak → olvasó API    | (lásd git log: feat(frontend): load snapshot pages from the read API)                | `components/PageIntro/RemoteData` (betöltés/hiba + Újra, `loadErrorText`); Ma/Kiértékelés/Arbitrázs `readApi.getRecommendations/getBacktest/getArbitrage`-ből, a nézet-osztály propként kapja; a 3 JSON kikerült a bundle-ből (index 444 → 368 kB); screenshot 1440/390 + hibaállapot                                                                                                                                                                                                                                                                      |
| SB6 – Legacy FixturePage törlése       | (lásd git log: refactor(frontend): remove legacy FixturePage)                        | A routolatlan `FixturePage` (komponensek, `FixtureService`, `FixtureStore`) és az üres `DataService` törölve, `MainStore`-ból kivéve; `models.ts` marad (Odds/Arbitrázs importálja); ROADMAP 1.8 pipálva. Külső API-hívás csak az arbitrázs régi útján (8.3).                                                                                                                                                                                                                                                                                              |
| M7 – Mobil Kiértékelés (11.7)          | (lásd git log: feat(mobile): add evaluation screen)                                  | core `evaluation/labels.ts` (EVAL_MARKETS, szezon/liga-név, fej-chipek, szegmensek, `goalRows`; a web `evaluationView` re-exportálja, teszt); `apps/mobile/src/app/evaluation.tsx`: `getBacktest()` + `loadWithCache` (`oe_cache_backtest`), piac- és szegmensválasztó, ítélet, 4 KPI, sikermutatók, kalibrációs tábla; fejléc-link; `tsc` + `expo export --platform android` zöld                                                                                                                                                                         |
| M8 – Mobil Szelvény (11.7)             | (lásd git log: feat(mobile): add slip screen)                                        | core `slip/draft.ts` (`TIPPMIX_LABEL`, `draftTipFromItem`, `draftRows`/`draftLegs`, `buildSavedSlip`; teszt; a web re-használja a címkét); `apps/mobile/src/app/slip.tsx`: `getRecommendations()` + cache (`oe_cache_recommendations`), kész szelvények, tipp-toggle, odds-beírás státusszal, tét-lépcső, összesítő, mentés `savedSlipsCodec`-kel AsyncStorage-ba, mentett lista; `tsc` + `expo export` zöld                                                                                                                                               |
| M9 – Mobil Beállítások (11.7)          | (lásd git log: feat(mobile): add settings screen)                                    | core `toggleSettingsItem`/`withSettingsNumber` (teszt); `apps/mobile/src/lib/preferences.tsx` (`PreferencesProvider`: `settingsCodec` + `themeCodec` AsyncStorage-ban); `src/app/preferences.tsx`: téma (azonnal), tét-alapegység, value-szűrő, ligák/piacok/irodák, tárolás, backfill, becslés + figyelmeztetések, Mentés/Elvetés/Alapértékek, Kapcsolat-link; `useRnTheme` a mentett preferenciát követi; Szelvény tét-lépcső a beállításból; `tsc` + `expo export` zöld                                                                                 |
| I1 – Ütemező váz (1.7, lokális)        | (lásd git log: feat(server): add cron tick skeleton)                                 | `0006_cron_run.sql` (`cron_run` napló: running/ok/locked/error); db `SqlCronStore` (`pg_try_advisory_lock` kulcs `CRON_LOCK_KEY`, `startRun`/`finishRun`/`logLocked`/`listRuns`); server `cron.ts`: `createTickRunner` (inFlight-őr + advisory lock, no-op worker, hiba → `error` sor + unlock), `cronAuthorize` (Bearer `CRON_SECRET`), `createCronHandler` (`GET                                                                                                                                                                                         | POST /api/cron/tick`, a router az app-auth előtt adja át); `npm run tick -w @football/server [-- --pg] [--every 15]`; Vercel-schedule: BLOCKERS |
| M11b – Mobil Meccs-részlet (11.7)      | (lásd git log: feat(mobile): add match detail screen)                                | core `odds/history.ts` (`oddsHistoryMarkets`: piac/kimenet → legjobb odd időrendben, nyitó → legutóbbi, `formatOddsChange`/`formatOddsPath`; teszt); `src/app/match/[id].tsx` (`getFixture` + `getOddsHistory` párhuzamosan, `loadWithCache` meccsenkénti kulccsal, offline-jelzés); Meccsek sora csapatnévvel + `Link`; `tsc` + `expo export` zöld                                                                                                                                                                                                        |
| I2 – Beállítás-repository (2.1a)       | (lásd git log: feat(db): add settings repository)                                    | db `SqlSettingsRepository` (`settings.ts`: követett liga / csapatszűrő upsert + egyedi törlés, `setting` jsonb get/set, `market`/`bookmaker` `stored` jelző, `loadStoredScopeInput`); core `storage/storedScope.ts` (`resolveStoredScope`, `resolveStoredScopes`, `isQuoteStored`); PGlite- + unit-teszt; séma nem változott                                                                                                                                                                                                                               |
| I3 – Beállítás-API (2.1b)              | (lásd git log: feat(server): add settings API)                                       | server `settings.ts` (`readSettings`, `parseSettingsUpdate`, `applySettingsUpdate`), router `GET/PUT /api/settings` (`deps.settings`), Node-híd törzs-továbbítás; contract `SettingsResponse`/`SettingsUpdate` + `getSettings`/`updateSettings`; db `findMissingRefs` (FK-előellenőrzés); szerződés-teszt (PGlite)                                                                                                                                                                                                                                         |
| I4 – Feladatsor-mag (3.1a)             | (lásd git log: feat(core): add ingest task queue core)                               | core `ingest/tasks.ts` (`planTasks`, `TASK_PRIORITY`, `isoWeek`), `ingest/queue.ts` (`selectNextTask`, `expiredTaskIds`, `onTaskFailure`); terv `docs/plans/i4-task-queue-core.md`                                                                                                                                                                                                                                                                                                                                                                         |

| I5 – Worker a tickben (3.1b) | (lásd git log: feat(server): wire ingest worker into tick) | db `ingestTasks.ts` (`SqlTaskStore`,
| I6 – reference jobok (3.2) | (lásd git log: feat(server): add reference ingest jobs) | `packages/server/src/reference.ts`
(handler + upsert, `stored` marad), `referenceMocks.ts` (mentett adatból); terv `docs/plans/i6-reference-jobs.md` | | I7 –
fixtures*window (3.3a) | (lásd git log: feat(server): add fixtures_window ingest job) | `packages/server/src/fixturesWindow.ts`
(upsert, null nem ír felül), `referenceMocks.ts` `loadIngestMocks` (visszajátszás); terv `docs/plans/i7-fixtures-window.md` | | I8
– results (3.3b) | (lásd git log: feat(server): add results ingest job) | `packages/server/src/results.ts` (`fixtures?ids`, 1
hívás/feladat), `referenceMocks.ts` `withFixturesByIds` (ids-feloldás a mentett meccsekből); terv `docs/plans/i8-results.md` | |
I9 – standings (3.4) | (lásd git log: feat(server): add standings snapshot ingest job) | `packages/server/src/standings.ts`
(insert `ON CONFLICT DO NOTHING`), `referenceMocks.ts` `withStandings` (core `deriveStandings` a mentett meccsekből,
visszajátszott időpontig); terv `docs/plans/i9-standings.md` | | I10 – odds (3.5) | (lásd git log: feat(server): add odds snapshot
ingest jobs) | `packages/server/src/odds.ts` (`getAllPages`, stored kör, `insertOddsSnapshots`), `referenceMocks.ts` `withOdds`;
terv `docs/plans/i10-odds.md` | `loadPlannerInput`), server `ingestWorker.ts` (`createIngestWorker`, `toFailureKind`,
`createDbIngestWorker`); tick.ts + dev.ts bekötve; terv `docs/plans/ingest-worker.md` | | I11 – odds_best (3.5b) | (lásd git log:
feat(server): store odds_best) | core `odds/best.ts` (`computeBestOdds`), `odds.ts` (kör piacai × minden iroda → best, utána
szűrés), db `OddsSnapshotInput.best` + `insertBest` (ismeretlen iroda → null); megőrzés: BLOCKERS | | I12 – injuries (3.6) | (lásd
git log: feat(server): add injuries ingest job) | `packages/server/src/injuries.ts` (insert `captured_at = now`,
`ON CONFLICT DO NOTHING`), `referenceMocks.ts` `withInjuries` (csak mentett
`injuries-*.json`, ma nincs → `mock-missing`); terv `docs/plans/i12-injuries.md`| | I13 – standing_derived (4.3) | (lásd git log: feat(server): add derived point-in-time standings) | migráció 0007,`packages/server/src/standingDerived.ts` (`refreshStandingDerived`, meccsnap-`as_of`, `unnest`-upsert), a `results`job hívja; terv`docs/plans/i13-standing-derived.md`| | I14 – predikció-pipeline (5.2) | (lásd git log: feat(server): add prediction pipeline) |`packages/server/src/predictions.ts` (`runPredictions`, `withPredictions`az odds-handlerek után,`ensureModelVersion`); terv `docs/plans/i14-prediction-pipeline.md`| | I15 – kiértékelő job (5.3) | (lásd git log: feat(server): add evaluation job) |`packages/server/src/evaluation.ts` (`evaluateFixtures`, `buildEvaluationRows`), a `results`handler hívja; terv`docs/plans/i15-evaluation-job.md`| | I16 – liga-katalógus (2.2) | (lásd git log: feat(server): add league catalog reference job) |`reference.ts` `/leagues` ág (`toLeagueRows`, `upsertLeagues`, `upsertSeasons`), core planner `reference:leagues:<hét>`, `referenceMocks.ts` `leaguesEnvelopeFromFixtures`| | I17 – kiértékelő olvasó-API (5.5) | (lásd git log: feat(server): add evaluation read API) | core`evaluation/dbSummary.ts` (`summarizeEvaluations`, `scoreProbabilities`), server `loadEvaluationRecords`, `GET
/api/evaluation?model=`, contract `getEvaluation`; terv `docs/plans/evaluation-db-api.md`| | I17b – Kiértékelés „Élő (DB)” blokk (web) | (lásd git log: feat(ui): add live DB evaluation block) |`EvaluationPage/LiveEvaluation.tsx`, `liveEvaluationView.ts`(+teszt), Vite-proxy`/api/evaluation`; screenshot `docs/plans/screens/I17b-evaluation-dark-{1440,390}.png`| | I17c – „Élő (DB)” blokk (mobil) | (lásd git log: feat(mobile): add live DB evaluation block) | core`evaluation/liveView.ts`(+teszt, a web`liveEvaluationView.ts`-ből emelve), mobil `evaluation.tsx` `LiveEvaluation`, `evaluationCacheKey(model)`; screenshot nincs (emulátor nélkül) | | I18a – Beállítások ↔ settings-API (web) | (lásd git log: feat(ui): sync settings page with the settings API) | core `settings/remote.ts` (`settingsFromRemote`, `settingsUpdateFrom`, `SETTINGS_MARKET_IDS`; +teszt), `SettingsStore` `ISettingsRemote`+`syncStatus`/`saving`/`saveError`, MainStore → `readApi`, Vite-proxy `/api/settings`→ :5100, szinkron-pill + SaveBar-hiba; terv`docs/plans/i18-settings-ui.md`; screenshot `docs/plans/screens/I18a-settings-dark-{1440,390}.png`| | I18b – Liga-katalógus a Beállításokban | a9ac420 (server) + (lásd git log: feat(ui): list leagues from the league catalog API) | server`leagues.ts` (`loadLeagueCatalog`, `toCoverageDto`; +PGlite-teszt), router `GET
/api/leagues`, contract `LeagueDto`/`listLeagues`; core `leagueCatalog`(kézi jelöltek + DB csapatszám/coverage + adatos/követett DB-ligák),`estimateSettings(s,
catalog)`, `missingCoverage`csak`false`-ra, a kézi `SETTINGS_LEAGUES`coverage-e`null`, `sanitizeSettings`bármely pozitív egész liga-id-t elfogad;`SettingsStore.loadCatalog`/`leagues`; Vite-proxy `leagues`; screenshot `docs/plans/screens/I18b-settings-dark-{1440,390}.png`| | I18c – Csapatszűrő (web) | 01e47fd (server) + (lásd git log: feat(ui): add team filter to the settings page) | server`loadLeagueTeams`+ router`GET
/api/leagues/:id/teams`(season_team → fixture-tartalék, osztályozó nélkül), contract`LeagueTeamDto`/`LeagueTeamsResponse`/`listLeagueTeams`; a katalógus csapatszáma már nem számolja a „Relegation Round” meccseket (Bundesliga/Ligue 1: 18); core `ISettings.teamFilters`, `teamFilterMode`, `withTeamFilter`, remote diff (upsert/remove); web `SettingsStore` `teamsByLeague`/`loadTeams`/`setTeamFilter`, `TeamFilter.tsx`(Mind/Csak/Kizár szegmens), új szekció „Csapatszűrő”; screenshot`docs/plans/screens/I18c-settings-dark-{1440,390}.png`| | I18d – Mobil Beállítások ↔ API | (lásd git log: feat(mobile): sync preferences with the settings API) |`PreferencesProvider`: `sync()`(GET`/api/settings`+`/api/leagues`, fókuszkor is), `saveSettings` PUT csak a diffet (`settingsUpdateFrom`), AsyncStorage gyorsítótár; `syncStatus`sor a képernyő tetején; Ligák a core`leagueCatalog`-ból, a becslés ezzel; új `components/TeamFilterSection.tsx`(Mind/Csak/Kizár,`listLeagueTeams`) | | I18e – Csapatszűrő alkalmazása | (lásd git log: feat: apply team filter) | core `settings/teamFilter.ts` (`buildTeamFilterIndex`, `teamFilterAllows`, `NO_TEAM_FILTER`); planner `PlannerInput.teamFilter`→`odds\*\*`/`injuries`csak megengedett meccsre; db`SqlSettingsRepository.loadTeamFilterIndex()` (`season_team`∪`fixture`), `loadPlannerInput`hozza; server`runPredictions`: kiszűrt meccsen nincs ajánlás, naplózás marad (`features.teamFilterBlocked`) | | I18f – Ligánkénti piac-felülírás (web) | (lásd git log: feat(ui): league market overrides) | core `ISettings.leagueMarkets`+`remote.ts`leképezés (tesztek), store`setLeagueMarkets`/`toggleLeagueMarket`, `LeagueMarkets.tsx`; screenshot `docs/plans/screens/I18f-settings-dark-{1440,390}.png`| I19 – 2.4 Budget-panel |`acb8bb2`(server/core) + feat(ui): budget panel |`GET
/api/budget` jobonként/`/status`/cron, core `budgetView`, web `BudgetChip`; screenshot `docs/plans/screens/i19-budget-{dark,light}-{1440,390}.png`| | I21 – Budget-panel mobilon | feat(mobile): budget screen | `apps/mobile/src/app/budget.tsx` (`/budget`, link a Beállításokból), `BUDGET_CACHE_KEY` + `loadWithCache` offline-jelzéssel, core `budgetView` | | I20b – pillanatkép DB fixture-id |`c3bf6a9`|`csvFixtureIds.ts` (`loadCsvFixtureIds`, `fixtureIdFor`, teszt); újragenerált `recommendations-v0`/`arbitrage-v0`(csak`fixtureId`változott); backtest bájtra azonos | | I20 – 5.7 Odds-history (web) |`056c327`| core`odds/matchView` (`withoutAggregateQuotes`, `bookmakerName`, `selectionResult`, `matchResultText`, `peakPoint`, `sparkline`), `formatDateTime`; web `pages/MatchPage` (`/match/:id`), TipCard link; screenshot `docs/plans/screens/i20-match-{dark,light}-{1440,390}.png`
| |

## Polish backlog

- I20: sparkline pontjelölő/tooltip nélkül, kimenetenként külön y-skála; a TipCard link sima `<a>` (teljes újratöltés); a
  pillanatkép-lista forrás (`source`) nélkül; nincs vissza-link.

- I19: a Budget-panel kívül kattintásra nem zár, nyitva nem frissül magától; mobilon nincs; a pötty színe nem követi a
  keret-tónust (csak a sáv); a `/status` időpontja a Budapest-időt mutatja, a nap UTC.

- I18f: mobilon nincs ligánkénti piac-felülírás UI (a core már átviszi); az ajánlás nem szűr a liga piacaira (csak a tárolás
  `resolveStoredScope` és a becslés); csak sötét téma screenshot.

- I18e: a UI nem jelzi, hogy egy ajánlás a szűrő miatt maradt el; a kiértékelés nem bontja szét a `teamFilterBlocked` sorokat; az
  include-liga a csapat összes (régi) ligáját is érinti (kupa, kiesés előtti liga) – szezonra szűkíthető.

- I18d: nincs emulátoros screenshot; a fókuszkori szinkron minden belépéskor 2 hívás; hosszú csapatlistához nincs kereső; offline
  mentés csak helyi (mint a weben); a mentés-hiba a nyers szerverüzenet.

- I18c: kereső és „összes törlése” nincs; más ligák szűrői csak a számlálóban látszanak; a szűrő még nem hat az ajánlásokra
  (I18e); csak sötét téma screenshot; a hosszú csapatnév 390 px-en levágva (title-ben teljes).

- I18b: a `/api/leagues` a teljes `league` táblát adja (szűrés/keresés/lapozás nincs; ~1000 ligánál kell); a DB-katalógus extra
  ligái csak akkor jelennek meg, ha van csapatszám vagy követjük őket (keresővel lehetne hozzáadni); a 19-es csapatszám javítva
  (I18c: osztályozó kizárva); ismeretlen csapatszám → 20 (`FALLBACK_LEAGUE_TEAMS`); csak sötét téma screenshot.

- I18a: offline mentés csak helyi (újrakapcsolódáskor nincs feltöltés/ütközés-feloldás); a DB-ben hiányzó piac/iroda sor csak
  helyben jelölhető (a `reference` job tölti); friss DB-ben 0 követett liga → üres lista + figyelmeztetés (nincs „alap 5 liga”
  seed); a nem katalógusbeli liga bejelölése 400-at ad (I18b szűri); a `stakeMode`/`backfillCap` nincs a UI-ban; csak sötét téma
  screenshot.

- I17c: a mobil „Élő (DB)” blokk csak akkor látszik, ha a backtest-pillanatkép betölt (külön render-ág kellene); a piac-tábla
  „Csoport” oszlopa mobilon elhagyva; nincs screenshot (emulátor nélkül); a modell-chipek sok verziónál tördelődnek (választó?).

- I17b: az „Élő (DB)” blokk csak KPI + piac-tábla; kalibrációs grafikon, ítélet-sáv és sikermutatók a DB-adatból még nincsenek; a
  modellverzió-választó a szekciófejben elcsúszva ül (saját sor / jobbra igazítás); csak sötét téma screenshot, adat nélküli
  (üres) állapotról; a Vite-proxy `/api/settings`-et még a régi backendre küldi.

- I17: az összesítés a core-ban fut a teljes sorlistán (SQL-aggregálás, ha nagy); liga-/piacszűrő és idősor még nincs az API-ban
  (ROADMAP 5.5); a piacok csak `marketId`-vel (név a kliensen).
- I16: valódi `/leagues` válasz mentése (💸 1 hívás → `data/history/api-football/leagues.json`), amíg nincs, a katalógus csak az 5
  mentett liga, coverage nélkül; `is_current` frissítése soronkénti jsonb-vizsgálattal (egyszerűsíthető); a budget
  (`api-football.md` §6) a bets/bookmakers havi, a planner heti ütemű – egyeztetni.
- I15: ázsiai vonalak (half_win/half_loss) nincsenek; a záró odds csak a tárolt quote-okból (`odds_best` nincs bekötve); a
  kiértékelt sor eredmény-korrekciókor nem frissül; Brier/log-loss csoportonként ismétlődik (aggregáláskor dedup); nincs olvasó
  API.

- I14: a feature-snapshot kimenetenként ismétlődik a `features` jsonb-ben (külön tábla); az `odds_best` (minden iroda) nincs
  bekötve, csak a tárolt quote-ok; `minBookmakers: 5` a kevés tárolt irodával szinte sosem ad ajánlást; a teljes történet minden
  futásnál betöltődik (liga/időablak-szűrés); nincs olvasó API (az `/api/recommendations` még a JSON-pillanatkép).

- I13: `standing_derived` – H2H-tiebreak és pontlevonás nincs; nincs olvasó API/DTO; minden results-futás a teljes szezont
  újraszámolja (inkrementális lehetne); nincs a `COUNTABLE_TABLES`-ben.

- I12: nincs valódi `/injuries` válasz a repóban (a teszt szintetikus) – mentés (💸 1 hívás, 2022–2024-es meccsnap, `ids`) →
  `data/history/api-football/injuries-<...>.json`, a `loadIngestMocks` magától felveszi; soronkénti INSERT; a sérültlista nincs a
  read API-ban/UI-ban (lefedettség-chip, 7.1 feature).

- I11: az `odds_best` nem olvasható vissza (`getLatestOdds`/`listOdds` nem adja, nincs DTO) – az odds-history/CLV szelet köti be;
  a mock-odds csak 1–2 irodát hoz, így a best ma ≈ a tárolt quote.

- I10: a mock-odds szintetikus (a 2021-es Unibet-blokkok ciklikusan a nap meccseire képezve) – valódi `/odds` válasz mentése (💸 1
  hívás/oldal) a 7 napos megőrzésen belüli meccsre; a dev-tick (falióra 2026) nem ütemez odds-feladatot, mert a DB-ben a mentett
  (2024-es) meccsek vannak – csak a tesztek (2024-es órával) futtatják.

- I9: a mock-tabla `form` és `description` (BL/EK/kiesés zóna) mezője `null` (a mentett meccslistából nem képezhető); a
  holtverseny a core közelítése (pont → gólkülönbség → rúgott gól), nem ligánkénti H2H; valódi `/standings` válasz mentése (💸 1
  hívás) a zónákhoz.

- I8: a `fixtures?ids` válasz statisztikái/eseményei (`fixture_team_stats`, `fixture_event`) nincsenek feldolgozva (a mentett
  adatban nincs ilyen, `TODO(polish)` a `results.ts`-ben); a dev-tickben a visszajátszott (2024-es dátumú) meccsekre nem tervez
  `results`-ot a planner (−72 h ablak).

- I7: a mock-kulcsok csak a betöltés napja −1…+30 napra (hosszan futó dev-szerver → újraindítás); a meccsek a mentett szezon
  dátumával kerülnek be (a planner odds-feladatai ezért nem indulnak mockban); soronkénti upsert; venue-tábla nincs töltve.
- I6: a mock `/teams` a mentett meccsek csapataiból (nincs `code`/`country`/venue); `/odds/bets` csak a mentett odds-fájlok piacai
  (Unibet); soronkénti upsert (unnest/batch helyett).
- I5: `enqueue` soronkénti INSERT (unnest); claim nem `FOR UPDATE SKIP LOCKED` (a tick advisory lockja véd); hibás futásnál az
  elköltött hívás nem számít a `calls`-ba; a no-op handler `done`-ra zár (dev-tickek után a heti/havi `reference` kulcs foglalt).
- I4: `predictions_api` és `backfill_*` nincs a plannerben; a beragadt `running` sorok visszaállítása kész (I5 `resetStale`);
  `injuries` köteg-index eltolódhat, ha egy meccsnapra >20 meccs jut és közben változik a lista (top ligában nem fordul elő).

- I3: a PUT nem egy tranzakcióban ír (a validálás és az FK-előellenőrzés előre fut, csak DB-hiba hagyhat félig alkalmazott
  frissítést); a core `ISettings` (web/mobil localStorage) és a szerver `SettingValuesDto` még két külön alak (a `leagues` /
  `markets` / `bookmakers` listák a DB-ben `followed_league` / `stored` jelzők) – az átkötő szelet egyesíti; a migráció
  alapértékei (min. odds 1,3, max. 5, EV 5%) eltérnek a core `DEFAULT_SETTINGS`-től.

- I1: a tick a teljes futás végén válaszol (külső pinger 30 s timeoutjához azonnali 202 + háttérfutás kellene, `TODO(polish)`); a
  `cron_run` sorok megőrzése/törlése nincs (a 3.5b karbantartó jobba); a tick-napló nincs a UI-ban (2.4 Budget-panel).

- M11b: meccs-részlet odds-mozgás csak szöveges pontsor (sparkline kell); irodanév helyett csak darabszám (a quote `bookmakerId`);
  piac-címke kézi katalógus (`HISTORY_MARKET_LABELS`: 1, 2, 5, 8, 12); nincs screenshot; tab-navigáció (6 képernyő).

- M11a: `/api/odds/:id/history` lapozás/limit nélkül adja az összes snapshotot (meccsenként kevés); `/api/fixtures/:id` nem ad
  ligát/szezont névvel.
- M10: mobil Arbitrázs: nincs iroda-szűrő; az Arbitrázs a Beállításokból nyílik (fejléc → tab-navigáció kell); a lábak táblája
  egyenlő oszlopokkal (hosszú irodanév tör); nincs screenshot.
- M9: mobil Beállítások: nincs szekció-menü és „elhagyod mentés nélkül?” jelzés; a web `SettingsStore` még saját
  `toggle`/`setNumber`-t használ (→ core `toggleSettingsItem`/`withSettingsNumber`); a beállítás az ajánlásokra nem hat; a
  checkbox pipája szöveg-karakter (nincs ikonkészlet); nincs screenshot.
- M8: mobil Szelvény: mentett szelvény törlése/kiértékelése nincs, nincs screenshot; a fejlécben 3 link van → tab-navigáció
  kellene.
- M7: mobil Kiértékelés: kalibráció táblázatként (nincs diagram), pontossági/bontás-táblák és a ROI-sáv grafika hiányzik; nincs
  screenshot (emulátor/expo-web nincs a gépen; az expo-secure-store weben nem fut); a fejléc két linkje keskeny kijelzőn szűkös.
- SB5: `RemoteData` betöltéskor csak egy kártya (skeleton nincs), oldalváltáskor újratölt (nincs cache); a 390 px-es Edge-headless
  screenshot jobbra vágott (ablak-minimum, CDP-vel kell mérni).
- SB3: az Odds-statisztika meccsenként hív `getOdds`-ot (~1250 kérés, PGlite-on ~4 s) → tömeges odds-végpont; az `ODDS_INFO`
  sekély másolata miatt a liga-váltás a beágyazott számlálókat nem nullázza (régi hiba).
- M6: a mobil lista csapat-id-t mutat (a `FixtureDto`-ban nincs csapatnév); ajánlás-végpont híján meccslista; Sora/Manrope fontok
  nincsenek betöltve; a sablon fölösleges natív függőségei (`@expo/ui`, `expo-glass-effect`, `expo-symbols` stb.) bent maradtak;
  az apps/mobile nincs a gyökér prettier-globban.
- M4/M5: az `index.html` festés előtti scriptje a `oe-theme` kulcsot literálként tartja (a TS-ben már egy helyen: core).
- M5: RN-téma: a `font.tracking` em-ben, a line-height szorzó (RN-ben × fontSize kell); a fontok (Sora, Manrope) betöltése az
  Expo-appra vár; a `data-accent` variáns nincs az RN-témában.
- PWA (M1): nincs „új verzió elérhető” jelzés (a SW `skipWaiting`-gel azonnal vált, a következő betöltés kapja); a lusta chunkok
  csak első megnyitáskor kerülnek a cache-be (az adott oldal offline csak akkor megy, ha online már megnyitottad); nincs
  világos-téma `theme_color` a manifestben (a meta-t a ThemeStore állítja).

- Kiértékelés (S28): kalibráció csak összesítve (szegmensnél „összesített adat” pill); PRD 9 „saját modell vs. API /predictions”
  sor nincs (nincs adat); a bontás-sorok gombja 44 px → magas sorok; a táblák `--min` 600 px (referencia 640/720); a pozitív
  ROI-sáv színe inline token-felülírás (vendor CSS csak negatívat ad); a diagram pontjain csak `title` tooltip; az ítélet-szöveg
  nem említi a „PRD szerint nem élesíthető” mondatot.

- Szelvény (S27b): a Hármas preset a §8.2-ben nem szerepel (DECISIONS: felülvizsgálandó); a SlipBar a referenciában nincs; a
  szingli-összevetés megjegyzés a referenciában nincs, de maradt; a sticky panel magasabb lehet a viewportnál (hosszú
  Tippmix-űrlap) → max-height + belső görgetés?

- Tippkártya (S27a): „Miért?” csipek rejtve (a pillanatkép nem menti a `FactorContribution`-t → generátor bővítése); „Sérültlista
  nincs a forrásban” chip csak `warnings`-ból (nincs lefedettség-mező); 390-en a nagy EV a cím alá, balra törik (referencia?); a
  „Mit jelent?” szöveg „5 iroda” mondata beégetett; tabella-zónák a `standings.description`-ből.

- Közös keret (S26): a v0.2 `.oe-segmented__btn` 40 px magas (< 44); az Arbitrázs sávszűrőjében még `<small>` hint, a szűrők a fej
  alatt (S29); a Kiértékelés fej alatt még a régi csempe-sor, az ítélet-sáv és a sikermutatók S28; az `oeClasses.ts`
  `statusDot`/`card` marad (nincs v0.2 megfelelő).

- Beállítások (S30): a v0.2 `.oe-segmented__btn` „Nyitó + záró” + `<small>` hint szóköz nélkül fut össze (vendor CSS); az aktív
  menüpont scroll-alapú (felső harmad), nincs IntersectionObserver; a mobil chip-sor görgetősávja látszik; a fej-chipek és csempék
  a piszkozatot mutatják; nincs „elhagyod a lapot mentés nélkül?” figyelmeztetés (route-váltáskor a piszkozat a store-ban
  megmarad).

- Beállítások (S22): a beállítás még nem hat az ajánlásokra/ingestionre (a `/` pillanatképe előre számolt); localStorage, nem a DB
  `setting` tábla; liga-katalógus és `coverage` kézzel (később `/leagues`); csapat-szűrő, ligánkénti piac-felülírás, tét-mód
  (flat/Kelly) nincs; a tét-lépcső ½/1/2/5 egység fix.

- Kiértékelés (S21): csak backtest-adat (élő `prediction`-napló nincs); a kalibráció nem szegmentált; piaci kalibrációs görbe és
  időbeli ROI-görbe nincs; a PageIntro alcíme 1440-en 2 sorba tör; 390-en a táblák a dobozukban vízszintesen görgetnek; a diagram
  pontjain csak `<title>` tooltip.

- Mobil szelvény (S20): „Szingli csomag” és „Rendszer 2/3” preset nincs (a szelvény-modell egy kötés); a BottomSheet nem csapdázza
  a Tab-fókuszt; 390-en a „Kész szelvények” szekciófej 2 sorba tör; a presetek a ModeSwitch nélkül, mindig látszanak; nyitás/zárás
  animáció nincs.

- Szelvény (S19): min. alatti lábnál konkrét cserejavaslat nincs (csak szöveg); mentett szelvény csak localStorage-ben (DB `bet`
  íróval később); a tét-lépcső konstans (`STAKE_OPTIONS`, S22 a beállításból); a kijelölés újratöltéskor elvész; 390-en a panel a
  lista alatt van (S20).

- Ajánlások (S18): a „Tét” szöveg az `elo` szintű zónát is kiírja (15. Tottenham „európai kupahelyért”) → csak kritikus/reális
  zóna; odds-időbélyeg „P 16:00” helyett „tegnap 16:00”; CSV-csapatnevek („Man City”) és CSV-sorszám fixture-id helyett
  API-Football név/id.

- MatchDetails: tabella-zónák fixek (BL 1–4, EK 5–6, kiesés utolsó 3), ligánként a `standings.description`-ből kellene; 1440-en a
  4 blokk 3+1 elrendezésű (auto-fit 300 px); a tabella-sorban a pont/gólkül. is félkövér (referenciában csak a név); Hiányzók
  blokk.
- Nav-link 36 px magas (a referencia szerint), a DESIGN érintési célja 44 px; 390-en a nav 2 sorba törik → mobil overflow-menü?
- Arbitrázs (S29): a sáv-szegmens súgója csak `title` (a `<small>` hint kikerült); a sáv-szűrő 40 px magas (vendor); a „Legjobb
  hozam” csempe elméleti (kerekítés nélküli) érték; a kártya `.oe-tip` padding inline szűkítve (space-9).
- Arbitrázs (S23): a pillanatkép CSV-ből, nem a DB `odds_snapshot`-ból (8.1/8.3); a beállított ligák/irodák nem szűrnek; odds-kor
  figyelmeztetés nincs; a „most” utáni 10 nap oddsa kezdés − 48 h; csak 1X2 és Gól 2,5 (AH nincs); a régi `/legacy/arbitrage`
  (oldalsáv, modál – ui-audit #3/#7/#8 ott maradt) a 8.3-mal törlendő.
- Headless Edge 500 px alatt nem szűkíti a viewportot: 390-es screenshot iframe-burkolóval (`<iframe width=390>`) készül.
- `oeClasses.ts` (S25): appsaját Tailwind-osztálylisták; ahol S26–S30 v0.2 osztályt ad (pl. oe-status-pill, oe-kpi), ott cserélni.
- Régi Tailwind színnevek (bg, surface, accent…) aliasként élnek a `tailwind.config.cjs`-ben; A3 után törölni.
- `components.css` Google Fonts `@import`-ot húz (külső hálózat); később self-host.
- `/api/fixtures` a teljes szűrt listát olvassa, a lapozás JS-ben (TODO(polish): LIMIT/OFFSET SQL-ben).
- Név-pingpong: a history- és a legacy-import 1 ligát + 5 csapatot más névvel ír (mindkét 2. futás 'updated'); forrás-prioritás
  kell.
- Fixture-mód: `/fixtures/statistics` és `/odds?bet=` szűrés nincs mentve (üres válasz); az `/odds/mapping` csak 1 mentett oldal.

## Jegyzet a következő sessionnek (max. 10 sor)

- **I21 kész.** Mobil `apps/mobile/src/app/budget.tsx` (`/budget`, „API-keret”; link a Beállítások aljáról): `getBudget` →
  `loadWithCache(BUDGET_CACHE_KEY)` → core `budgetView` (pill + sáv tónusszínnel, Felhasznált/Maradék/Tartalék, jobonként élő +
  mock, `/status`-egyeztetés, cron-összesítő), cache-ből „offline – utolsó frissítés” sáv, lehúzásra újratölt. Screenshot nincs
  (emulátor nincs); `tsc` + `expo export` zöld. Polish: a pill a Meccsek fejlécében (tab-navigációval). Következő: I22.

- **I20b kész.** A `recommendations`/`arbitrage` generátor a `packages/db/src/import/csvFixtureIds.ts`-sel (S11b `matchCsvRows` a
  mentett `data/history/api-football` fájlokon, DB nélkül) a DB/API-Football meccs-id-t írja (pl. 866 → 1224234 Bochum–Augsburg).
  Párosítatlan célsor → hiba. Csak a `fixtureId` mezők változtak (2 ajánlás, 88 arbitrázs-meccs, sorrend azonos); mind a 88 id
  megvan a `.data/pglite`-ban (másolaton ellenőrizve). Backtest bájtra azonos. A böngészőben mentett szelvény régi id-kat tarthat
  (localStorage) — ürítés után rendben. Következő: I21.

- **I20 kész.** Web `/match/:id` (`pages/MatchPage/MatchPage.tsx` + `OddsSparkline.tsx`): `getFixture` + `getOddsHistory` (+
  `getSettings` az iroda-nevekhez, hibánál core katalógus). Core `odds/matchView.ts` (ál-irodák kiszűrése, elszámolás a
  végeredményből, sparkline-geometria), `formatDateTime`. A TipCard lenyitott részén link; a pillanatkép-id-k nem DB-id-k → 404
  üzenet, javítás: I20b. Screenshot: a `.data/pglite` scratchpad-másolatán futó szerver, `/match/1208338` (Man City – Palace).
  Következő: I20b.

- **I19 kész.** `GET /api/budget` + `jobs` (`api_call_log` ⟕ `ingest_task.kind`, feladat nélkül `manual`, `/status` nélkül;
  élő/mock külön), `status` (a mai utolsó `/status` log-sor), `cron` (`cron_run` összesítő); server `loadBudgetDetails(db, day)`,
  `ApiDeps.budgetDetails` (hiányában üres bontás). Core `budgetView`/`reconcileBudget` (drift = limit − used − syncedRemaining).
  Web `components/AppShell/BudgetChip.tsx`: a pill gomb (aria-expanded), alatta kártya; 640 px alatt `fixed` a gutterek közt.
  Screenshot: scratch PGlite-ba seedelt minta + `shots.mjs --click ".oe-status-pill"` → `docs/plans/screens/i19-budget-*`.
  Következő: I20 (5.7 Odds-history).

- **I18f kész.** Core `ISettings.leagueMarkets` (`{leagueId, markets}[]`, rendezett; `leagueMarketOverride`,
  `effectiveLeagueMarkets`, `withLeagueMarkets`); `settingsFromRemote` a `followedLeagues[].markets`-et (id-szöveg vagy
  `market.code`) képezi le, a `settingsUpdateFrom` változáskor `followedLeagues.upsert`
  `{leagueId, enabled, markets: ids-as-string | null}`. A tárhelybecslés ligánként a saját piacaival számol. Web:
  `components/LeagueMarkets.tsx` (Globális/Egyéni + piac-kapcsolók). `shots.mjs --storage` (localStorage-minta szerver nélkül).
  Következő: I19 (2.4 Budget-panel).

- **I18e kész.** Szűrő-jelentés: Kizár = a csapat meccsei ki; Csak = a csapat ligáiban csak az include-csapatok meccsei; ütközés →
  exclude. Gyűjtés: a planner csak az `odds_*`/`injuries` meccseit szűri (tabella/eredmény nem); predikció: a naplózás marad, csak
  az ajánlás tiltott (DECISIONS I18e). `runPredictions` `opts.teamFilter` nélkül a DB-ből tölti. Terv:
  `docs/plans/i18e-team-filter-apply.md`. Következő: I18f (ligánkénti piac-felülírás UI).

- **I18d kész.** Mobil `lib/preferences.tsx`: a `PreferencesProvider` a web `SettingsStore` mintáját követi (remoteRef a
  PUT-diffhez, `settingsFromRemote(res, helyi)`), API-cím nélkül `off` és minden helyi. A képernyő piszkozata csak akkor igazodik
  a frissült mentetthez, ha érintetlen vagy épp mentettünk. Csapatszűrő mobilon is kész (nem kellett külön szelet). Következő:
  I18e.

- **I18c kész.** `GET /api/leagues/:id/teams` (server `loadLeagueTeams`, dev.ts bekötve; `season_team` üres helyben → meccsekből).
  A 19-es csapatszám oka: „Relegation Round” (osztályozó) meccsek a `fixture`-ben – SQL-ben kizárva. Core `ISettings.teamFilters`
  (sanitize: id szerint rendezve, utolsó mód nyer), `settingsUpdateFrom` → `teamFilters: { upsert, remove }`. Web:
  `TeamFilter.tsx` (observer osztály, a csapatlistát didMount/didUpdate-ben kéri). Screenshothoz a helyi PGlite-ba ideiglenesen 2
  ligát + 2 szűrőt PUT-oltam, utána visszavontam. Következő: I18d (mobil), majd I18e (szűrő alkalmazása).

- **I18b kész.** `GET /api/leagues` (server `leagues.ts`, dev.ts bekötve), contract `listLeagues()`; a web `SettingsStore.leagues`
  = core `leagueCatalog(catalogRows, saved.leagues)`, a becslés ezzel számol. A `sanitizeSettings` már nem szűr a kézi listára
  (liga-id = pozitív egész, bemeneti sorrend). Következő: I18c (csapatszűrő UI: `team_filter` a követett ligák csapataiból; a
  csapatokhoz új olvasó-végpont kell, pl. `/api/leagues/:id/teams` a `season_team`-ből).

- **I18a kész.** A web `SettingsStore` a `MainStore`-ban `readApi.getSettings/updateSettings`-szel szinkronizál (`sync()` flow,
  `syncStatus`), a localStorage csak gyorsítótár; a `save()` most flow (Promise), PUT csak a diffet (`settingsUpdateFrom`). A lap
  szövegmezői `reaction`-nel követik a `saved`-et. Következő: I18b (liga-katalógus API: router `/api/leagues` ág + contract).
  Screenshot: CDP-script (headless Edge, `Emulation.setDeviceMetricsOverride`), mindkét dev-szerver (:5100, :3000) kell.

- **I17c kész (mobil).** A web `liveEvaluationView.ts` formázói (`ALL_MODELS`, `modelOptions`, `liveChips`, `liveMarketRows`) most
  a core `evaluation/liveView.ts`-ben (index exportálja), a web `LiveEvaluation.tsx` onnan importál. Mobil: `evaluation.tsx` alján
  `LiveEvaluation` (hook), `loadWithCache` + `evaluationCacheKey(model)` (`src/lib/storage.ts`), modellverzió-chipek, üres
  állapot, offline-sáv; a lehúzás újratölti (`reload` számláló). Következő: I18 (Beállítások UI).

- **I17b kész (web).** `/evaluation` alján `LiveEvaluation` (osztálykomponens, saját betöltés): `readApi.getEvaluation(model)`,
  modellverzió-`select` (`modelOptions`: '' = mind), `records === 0` → EmptyState, különben `KpiRow(kpis(bets))` + piac-tábla
  (`liveMarketRows`, piacnév: core `marketLabel`). A backtest és az élő blokk egymástól függetlenül tölt. Vite-proxy: `evaluation`
  hozzáadva a :5100-as listához. A helyi PGlite-ban 0 kiértékelés → csak az üres állapot látszik. Screenshot: CDP
  `Emulation.setDeviceMetricsOverride` (a `--window-size=390` headless Edge-ben szélesebb viewportot ad). Következő: I17c (mobil),
  I18.

- **I17 kész (5.5 API).** `GET /api/evaluation?model=<verzió>` → `EvaluationSummaryResponse` (= core `EvaluationSummary`):
  `modelVersions` (szűrés előtti), `predictions` (Brier/log-loss **csoportonként – futás×meccs×piac×vonal – 1 sorral**,
  `evaluationGroupKey`), `calibration` (minden nem-void predikció), `bets` (csak `is_recommendation`; `summarizeBets`: hit vs.
  várt, flat ROI + SE, CLV), `markets[]`. Forrás: `loadEvaluationRecords(db)` (`deps.evaluations`, dev.ts bekötve; hiányában 404).
  Kliens: `createApiClient(...).getEvaluation(model?)`. A helyi PGlite-ban valószínűleg még nincs `evaluation` sor → az I17b
  UI-nak üres állapot kell. Következő: I17b (web Kiértékelés-oldal bekötése), utána I18.

- **I16 kész (2.2).** A planner hetente `reference:leagues:<ISO-hét>` (`/leagues` paraméter nélkül, 1 hívás) feladatot tesz be; a
  `reference` handler `/leagues` ága `league` + `season` upsert (`jsonb_to_recordset`, 1-1 lekérdezés): null mező nem ír felül,
  `coverage` nyersen jsonb-ben, `coverage_checked_at = ctx.now` csak hozott coverage-nél. Mock:
  `data/history/api-football/ leagues.json`, ha van (ma nincs), különben a mentett meccsek `league` blokkjaiból 5 liga ×
  szezonévek **coverage nélkül** (DECISIONS 2.2). Helyi `.data/pglite`: az új heti kulcs még nincs benne, a következő tick tölti
  (DB nem törölve). Következő: I17 kiértékelő dashboard DB-ből (5.5), utána I18 Beállítások UI (2.3).

- **I15 kész (5.3).** `evaluateFixtures(db, fixtureIds, { now })` (`packages/server/src/evaluation.ts`): FT/AET/PEN (rendes
  játékidő: `ft_*`, különben `goals_*`) vagy PST/CANC/ABD (→ void) meccsek még ki nem értékelt predikcióira 1-1 `evaluation` sor
  (meglévő 0004-es séma); flat profit a `best_odd`-ra; Brier/log-loss a piac eloszlására (a csoport minden során ugyanaz); CLV a
  kezdés előtti utolsó snapshot quote-maximumához. `ON CONFLICT DO NOTHING` → idempotens. A `results` handler hívja (`ctx.now`).
  Következő: I16 liga-katalógus (2.2), utána 5.5 kiértékelő dashboard DB-ből.

- **I14 kész (5.2).** `runPredictions(db, fixtureIds, { now, trigger? })` (`packages/server/src/predictions.ts`): NS/TBD meccsek
  (kezdés > now), történet = befejezett meccsek kezdés < now, odds = legutóbbi snapshot (`captured_at ≤ now`) `odds_quote`-jai
  (piac 1 és 5/2.5), tabella = `standing_derived` utolsó `as_of` ≤ meccsnap éjfele. Kimenetenként 1 `prediction` sor (`p_model` =
  piaccal kombinált p, `features` = teljes snapshot), egy CTE-ben a `prediction_run`-nal; nincs sor → nincs run. `withPredictions`
  köti az `odds_early`/`odds_late` handler után. Következő: I15 kiértékelő job (5.3).

- **I13 kész (4.3).** Tábla `standing_derived` (migráció 0007; PK liga, szezon, `as_of`, csapat).
  `refreshStandingDerived(db, league, season, asOfs?)` (`packages/server/src/standingDerived.ts`): a `fixture` FT/AET/PEN
  meccseiből core `deriveStandings`, alapból minden meccsnap UTC-éjfelére + az utolsó meccsnap utáni éjfélre (= aktuális tabella);
  upsert, `season` sor nélkül 0. A `results` handler befejezett meccs után hívja. Teszt: a mentett PL 2024 végtabellája = a
  hivatalos 2024/25 végeredmény. Következő: I14 predikció-pipeline (5.2).

- **I12 kész (3.6).** `createInjuriesHandler(db)` (`packages/server/src/injuries.ts`): a planner `injuries` feladata (`{ ids }` ≤
  20, T−24 h) → 1 hívás `/injuries?ids=a-b-c` → `toInjuryRows` (csak a kért meccsek) → `upsertTeams` + `insertInjuries`
  (`injury_report`, `captured_at = now`, FK-hiányos sor kimarad). Mock: `withInjuries(map, items)` csak mentett elemekre válaszol
  (ismeretlen köteg → `mock-missing`, nem üres lista); a teszt `SYNTHETIC` kézi elemeket ad. Következő: I13 `standing_derived`
  (4.3).

- **I11 kész (3.5b, csak `odds_best`).** `toOddsSnapshots` (`packages/server/src/odds.ts`): követett ligán a kör piacain minden
  iroda jegyzése → core `computeBestOdds` (kulcs: piac, kimenet, vonal; max + iroda, átlag, `n_books`) → `best`; az `odds_quote`
  csak `isQuoteStored`. Snapshot akkor íródik, ha van `best` (tárolt quote nélkül is). db: `insertBest` a `insertOddsSnapshots`
  tranzakciójában, csak új snapshotra; ismeretlen iroda → `bookmaker_id` null, ismeretlen piac → kimarad; `odds_best` a
  `COUNTABLE_TABLES`-ben. Megőrzés (`odds_retention`) BLOCKERS. Következő: I12 `injuries` (3.6).

- **I10 kész (3.5).** `createOddsHandler(db, 'early'|'late')` (`packages/server/src/odds.ts`): a planner
  `{ league, season, date, fixtures }` feladata → `client.getAllPages('/odds', { league, season, date }, { maxPages: ⌈n/10⌉ })` →
  `toOddsSnapshots` (csak a feladat meccsei, `resolveStoredScope` + `isQuoteStored`, `parseSelection`, odd > 1, dedupe;
  `captured_at = now`, `provider_updated_at = update`) → `SqlRepository.insertOddsSnapshots` (meglévő kulcs no-op). Mock:
  `withOdds(map, saved, odds)` a `/odds?date&league&season[&page]` kulcsra; `loadIngestMocks` adja. Következő: I11 `odds_best`.

- **I9 kész (3.4).** `createStandingsHandler(db)` (`packages/server/src/standings.ts`): a planner `standings` feladata
  (`{ league, season }`, forduló előtti UTC-nap 00:00-tól) → 1 hívás `/standings` → `upsertTeams` + `upsertSeasonTeams` (`season`
  sor) + insert a `standing_snapshot`-ba `captured_at = now`-val (`ON CONFLICT DO NOTHING`). Mock:
  `withStandings(map, saved, clock)` – Proxy, a `/standings?league&season` kulcsra a core `deriveStandings`-szel számol a
  `replayInstant(clock())` előtt befejezett mentett meccsekből; `loadIngestMocks(root, now, clock)` ezt is adja. Következő: I10
  odds-snapshot (3.5).

- **I8 kész (3.3b).** `createResultsHandler(db)` (`packages/server/src/results.ts`): a planner `results` feladata (`ids` ≤ 20,

  1. kör +3 h, 2. kör +26 h – a core-ban) → `/fixtures?ids=<rendezett a-b-c>` → `upsertTeams` + `upsertFixtureRows` (I7; státusz
     mindig, null nem ír felül). Mock: `withFixturesByIds(map, items)` – Proxy, a statikus térkép mellett `ids` szerint old fel a
     mentett meccsekből (> 20 id → API-szerű `errors`); `loadIngestMocks` ezt adja. Teszt: mentett 2023-as PL FT-meccsek `NS`-ként
     beszúrva. Következő: I9 `standings` (3.4).

- **I7 kész (3.3a).** `createFixturesWindowHandler(db)` (`packages/server/src/fixturesWindow.ts`):
  `/fixtures?league&season&from&to` → hiányzó `team`/`season_team` + `fixture` upsert (kezdés/státusz mindig,
  eredmény/forduló/játékvezető: null nem ír felül). Mock: `loadIngestMocks(ROOT, now)` (reference + ablak), `replayDay`: a 2026-os
  nap a mentett szezon azonos napjára vetül, a meccsek eredeti dátummal. `createDbIngestWorker` alapból köti. Következő: I8
  `results` (`fixtures?ids`, max. 20, NS → FT, +26 h második kör) – a mockhoz a mentett FT-meccsek kellenek `ids` kulccsal; a
  mentett adatban nincs NS státusz.

- **I6 kész (3.2).** `createReferenceHandler(db)` (`packages/server/src/reference.ts`): `/teams` → `team` + `season_team`
  (`season` sort létrehozza, ha a liga ismert), `/odds/bookmakers` → `bookmaker`, `/odds/bets` → `market` (`code` = `BETS_TYPES`
  kulcs, `analyzed` = ismert piac). Saját SQL-upsert: a `stored`-ot nem írja (a `SqlRepository.upsert*` false-ra írná!).
  `createDbIngestWorker(db, { fixtures })` alapból köti; a tick.ts/dev.ts `loadReferenceMocks(ROOT)`-ot ad. Ismeretlen endpoint /
  hiányzó mock → végleges hiba. **Helyi `.data/pglite`:** az I5 no-op handlere a heti/havi `reference` kulcsokat már `done`-ra
  zárta, ezért ott a törzsadat csak a következő ISO-héten / hónapban töltődik (a DB-t nem töröltük); a teszt friss memória-PGlite.

- **I5 kész (3.1b).** `SqlTaskStore` (`@football/db`): `enqueue` (ON CONFLICT DO NOTHING, beszúrt db), `skipExpired`,
  `resetStale`, `listRunnable`, `claim`, `complete`, `fail`, `list`; `estCalls` a `params._estCalls`-ban (olvasáskor leválik).
  `loadPlannerInput(db, now)`: engedélyezett `followed_league` + szezon (`season.is_current` → max meccs-szezon → 2024).
  `createIngestWorker({ tasks, budget, plannerInput, client?, handlers?, maxTasks? })` → `TickWorker`; kindonként
  `TaskHandler = (task, {now, client}) => {calls}`, hiányzó = no-op. `toFailureKind(e)`: api-client → core hibafajta.
  `createDbIngestWorker(db)` = mock kliens, a tick.ts/dev.ts ezt használja. Következő: I6 (reference handler).

- **I4 kész (3.1a).** Core:
  `planTasks({ now, leagues:[{id,season}], fixtures:[{id,leagueId,kickoff,status,round?}], horizonHours? })` → `TaskPlan[]`
  (`kind`, `dedupeKey`, `params`, `priority`, `notBefore`, `deadline`, `estCalls`), dedupeKey szerint rendezve, lejárt határidő
  nélkül. Worker-oldal: `selectNextTask(tasks, now, remainingCalls)` (a fontosabbat nem ugorja át keret híján), `expiredTaskIds`
  (pending + lejárt → `skipped`), `onTaskFailure(task, {kind,message}, now)`; a hívó képezi le az api-client `ApiErrorKind`-ot:
  plan/token → `plan`/`token`, quota → `quota`, budget → `budget`, retryable http → `transient`, egyéb → `permanent`. **I5-höz:**
  az `ingest_task` táblában nincs `est_calls` oszlop → additív migráció
  (`ADD COLUMN IF NOT EXISTS est_calls smallint NOT NULL DEFAULT 1`) vagy `params`-ba. Következő: I5.

- **I3 kész (2.1b).** `GET/PUT /api/settings` (`packages/server/src/settings.ts`, router `deps.settings` – hiányában 404; dev.ts
  bekötve). Contract: `SettingsResponse` / `SettingsUpdate`, `api.getSettings()` / `api.updateSettings(update)` (PUT, JSON;
  `FetchLike` init kapott `body?`). PUT-ágak: `values` (részleges), `followedLeagues{upsert,remove}`,
  `teamFilters{upsert,remove}`, `markets[{id,stored}]`, `bookmakers[...]`; minden előbb validálódik (ismeretlen
  mező/piackód/liga/csapat, tartomány, min<max) → 400 `bad-request`, semmi sem íródik. `setting`-kulcsok a 0005-ös alapsorokéi
  (`unit_ft`, `stake_mode`, `backfill_cap`, `odds_retention` = bool) + új `backfill_reserve`. A Node-híd (`node.ts`) már
  továbbítja a kérés törzsét. Következő: I4.

- **I2 kész (2.1a).** `new SqlSettingsRepository(db)` (`packages/db/src/settings.ts`): `listFollowedLeagues`,
  `upsertFollowedLeague({ leagueId, enabled?, priority?, markets? })` (a meg nem adott mező marad; `markets: null` = globális),
  `removeFollowedLeague`, `*TeamFilter`, `getSettings`/`getSetting`/`setSetting` (jsonb), `setMarketStored`/`setBookmakerStored`,
  `loadStoredScopeInput()` → core `resolveStoredScope(leagueId, input)` / `isQuoteStored`. Felülírás-elem = piackód vagy id
  szövegként. Tick-worker: `TickWorker` (`packages/server/src/cron.ts`), az I5 köti be. Következő: I3 (`/api/settings`).

- **M11b kész.** Mobil meccs-részlet `src/app/match/[id].tsx` (a Meccsek soráról `Link`), nézet-logika a core
  `odds/history.ts`-ben (`oddsHistoryMarkets`, `marketLabel`, `outcomeLabel`, `snapshotKindLabel`). Cache-kulcs:
  `matchCacheKey(id)` (`src/lib/storage.ts`). A Mobil lista üres: következő a ROADMAP következő nyitott, nem blokkolt szelete
  (APK-build EAS-fiókot igényel → BLOCKERS), vagy a polish backlog (tab-navigáció).

- **M11a kész.** Contract: `getFixture(id)`, `getOddsHistory(id)` (`/api/fixtures/:id`, `/api/odds/:id/history`),
  `FixtureDto.homeTeamName/awayTeamName` (opcionális; a lista is adja). Repo: `listTeams(ids?)`, `listOdds(fixtureId)`. Következő:
  M11b képernyő (terv: `docs/plans/m11-match-detail.md`).
- **M10 kész.** Mobil Arbitrázs (`src/app/arbitrage.tsx`, a Beállítások aljáról linkelve – a fejlécbe nem fért 4. link).
  Nézet-logika a core `arbitrage/view.ts`-ben (`arbitrageRows`, `arbitrageTiles`, `ARB_BAND_OPTIONS`, `defaultArbitrageFilter`…);
  a web `arbitrageView.ts` csak alias-re-export. Cache: `ARBITRAGE_CACHE_KEY` (drótforma, olvasáskor `reviveArbitrageSnapshot`).
  Következő: M11 Meccs-részlet. Tab-navigáció érett (5 képernyő) – polish backlog.
- **M9 kész.** Mobil Beállítások (`src/app/preferences.tsx`, fejléc „Beállítások”); a Kapcsolat (`settings.tsx`) onnan linkkel.
  App-szintű állapot: `src/lib/preferences.tsx` (`PreferencesProvider` a `_layout`-ban, `usePreferences()` → `settings`,
  `saveSettings`, `themePreference`, `setThemePreference`; AsyncStorage, web-formátum). `useRnTheme` már a mentett preferenciát
  követi (`useThemeName`). A Szelvény tét-lépcsője `stakeOptions(settings.stakeUnit)`. Következő: M10 Arbitrázs.

- **M8 kész.** Mobil Szelvény-képernyő (`slip.tsx`) a core `slip/draft.ts`-re építve; mentés a web `oe_saved_slips` formátumában.
  Következő: M9 Beállítások (`settingsCodec` + `themeCodec`; a tét-lépcső innen jöjjön a Szelvénybe).

- **M7 kész.** Mobil Kiértékelés-képernyő a `getBacktest()`-ből; a közös címkék a core `evaluation/labels.ts`-ben (a web
  `evaluationView.ts` re-exportál). Mobil ellenőrzés: `cd apps/mobile && npx tsc --noEmit` + `expo export --platform android`.
  Következő: M8 Szelvény (fejléc-linkek helyett érdemes tab-navigációra váltani, ha 3+ képernyő lesz).

- **SB6 kész.** A legacy FixturePage törölve, ROADMAP 1.8 pipálva. A frontendben `ApiURLs.FOOTBALL`/`FetchService` már csak az
  `ArbitrageStore`/`ArbitrageService` régi útján él (8.3 viszi ki). Következő: Mobil M7 Kiértékelés (a `getBacktest()` az SB4 óta
  van a contractban → a mobil képernyő közvetlenül abból tölthet).

- **SB5 kész.** A Ma/Kiértékelés/Arbitrázs oldal az olvasó API-ból tölt (`RemoteData` wrapper; dev:
  `npm run dev -w @football/server`

  - Vite :3000). A view-tesztek továbbra is a `data/*.json`-t használják. Következő: SB6 (legacy FixturePage le a külső API-ról).

- **SB4 kész.** A server `snapshots` függősége (`SnapshotSource`) adja a 3 pillanatkép-végpontot; a dev-szerver a repó `data/`-ját
  olvassa. A contract DTO-k `import type`-pal a `@football/core` pillanatkép-típusaira épülnek (a contract és a server
  `dependencies`-ében ott a core). Arbitrázsnál a kliens `reviveArbitrageSnapshot(await api.getArbitrage())`. Következő: SB5 (a 3
  oldal → `readApi`, a JSON-importok ki a bundle-ből; a view-tesztek maradhatnak a JSON-on).

## Archív jegyzetek (korábbi sessionök, csak referencia)

- **SB3 kész.** Dev: `npm run dev -w @football/server` (:5100, PGlite vagy `-- --pg`) + Vite :3000; a proxy az olvasó-API
  útvonalakat a :5100-ra, a többi `/api`-t a legacy :5000-re küldi. Az /odds nincs routolva; az app indulásakor már nincs
  legacy-hívás. Következő: SB4 (snapshot-végpontok).

- **SB1b kész.** A Supabase-ben minden import lefutott, fixture/odds idempotens. Az upsert kötegelt: a 3 import ~20 s távolról.
  Következő: SB3 (frontend /odds → `createApiClient`, Vite-proxy :5100, server `-- --pg`).

- **SB2 kész.** `npm run dev -w @football/server -- --pg` → Supabase (curl: `/api/fixtures?limit=1` total 5341, ~10 s az első
  válasz – TODO(polish) count-lekérdezés). Vigyázat: a gyökérből indított `npx vite-node` betölti a gyökér `.env`-et a
  `process.env`-be, így ott a `DATABASE_URL` jelen van → Postgres. Integrációs teszt: `DATABASE_URL` exporttal
  (`grep ^DATABASE_URL= .env | cut -d= -f2-`), `NODE_OPTIONS=--use-system-ca`, sandboxon kívül.

- **SB1 kész (kód), a Supabase-futás SB1b.** Az odds-import soronként ~1 snapshot/s volt távolról (2209 snapshot + 44 030 quote
  maradt bent egy megszakított futásból; az import idempotens, folytatja). Most `insertOddsSnapshots` kötegel. `openPg`: connect
  30 s, query 120 s időkorlát, így a hálózati hiba nem akasztja meg a kört. Távoli DB-próba: `select 1` script előbb.

- **Supabase él (2026-11-13).** `DATABASE_URL` a gyökér `.env`-ben (Session pooler, eu-west-3).
  `npm run db:migrate -w @football/db` (NODE_OPTIONS=--use-system-ca, sandboxon kívül) idempotens; 0001–0005 alkalmazva, RLS
  minden táblán (policy nincs → anon kulccsal zárva). Adapter: `openPg()` (`src/pg.ts`). Következő: az importok (`import:history`,
  `import:odds-csv`) Supabase-célra + a server Postgres-adaptere.

- **M6 Expo-váz kész.** `cd apps/mobile && npm install` (külön, nem workspace; `NODE_OPTIONS=--use-system-ca`, sandboxon kívül,
  lassú hálózat: ~25 perc). Ellenőrzés: `npx tsc --noEmit` + `npx expo export --platform android` (a `dist/` git-ignored, töröld).
  Új megosztott csomag mobilon: a `metro.config.js` `shared` listájába + `tsconfig.json` `paths`. A megosztott csomag nem
  importálhat külső npm-függőséget (a Metro csak az apps/mobile/node_modules-ból old fel). APK + éles API → BLOCKERS. Következő:
  M7 (11.7+).

- **M5 `packages/theme` kész.** Mobilon: `import { rnTheme } from '@football/theme'` (függőség nélküli, TS-forrás). A forrás
  továbbra is `frontend/src/design/tokens/tokens.json`; token-változás után `npm run tokens -w football-app-web` (különben a
  `verify` `tokens:check`-je bukik). Következő: M6 (Expo-váz; React 17 vs. 19 ütközés → külön, nem-workspace app lehet).

- **M4 Hordozható állapot kész.** Mobilon: `loadStored(asyncStorage, settingsCodec | themeCodec | savedSlipsCodec)` a core-ból; a
  web store-ok a `webStorage` szinkron útját használják (villanás nélkül). Formátumváltáskor: verziómező + ág a
  `migrateSettings`/`migrateSavedSlips`-ben. A `settingsView.ts` csak újraexportál + UI-adat. `ThemeName`/`ThemePreference` most a
  core-ban ÉS a generált `tokens.ts`-ben is él (M5-nél egyesíthető). `LocalStorageUtil` (arbitrázs-cache) web-only maradt.
  Következő: M5.

- **M2 contract kész.** `@football/contract` önálló DTO-kat ad (nem függ a db-től); a server `satisfies`-szal köti a válaszait,
  így séma-eltérésnél a server typecheck bukik. Új végpontnál: DTO + kliensmetódus + `contract.test.ts` eset. A kliens a saját
  `FetchLike` típusát használja (nincs DOM-lib), query-string kézzel (`buildFixtureQuery`). A frontend még nincs átkötve
  (Vite-proxy a legacy :5000-re). M3: a Bearer fejlécet a kliens már küldi; a szerver-oldali ellenőrzés hiányzik. Következő: M3.

- **M1 PWA kész.** A SW csak prod-buildben regisztrál (`src/pwa/registerServiceWorker.ts`, `<html data-sw="registered">`). A
  cache-szabály a `cacheStrategy.ts` `SW-SHARED` blokkjában él, a `public/sw.js` szó szerinti másolata – mindkettőt együtt
  módosítsd (a teszt elbukik, ha eltérnek). Ellenőrzés: `npm run build` + `vite preview` + CDP-script (offline emulációval): 0
  konzolhiba, offline reload a cache-ből megy és mutatja a jelzőt. Következő: M2 `packages/contract`.

- **S30 kész, Floodlight v0.2 lezárva.** `SettingsStore`: `saved` (localStorage, ezt követi az app, pl. `stakeOptions` és a
  MainStore tét-reaction) vs. `draft` (űrlap); `save()`/`discard()`/`dirty`/`diff`. A téma nem része a piszkozatnak (`ThemeStore`
  azonnal). Mentés-sáv screenshot: `shots.mjs ... --click "#ligak li:nth-child(6) input"`. Záró ellenőrzés: nyers hex/rgb grep
  csak `design/tokens` + vendor `design/components` alatt; 16 `s30-final-*` kép, 0 görgetés, 0 konzolhiba. Következő: ROADMAP
  következő nyitott szelete; a nyitott hiányzó-adat tételek fent.

- **S29 kész.** Arbitrázs-sáv a UI-ban mindig `arbitrageStakes(odds,total,STAKE_ROUNDING).band` (tét-függő), a pillanatkép
  `o.band` csak sum-alapú (riporthoz). 10 000 Ft-nál 2 arb (Valladolid–Osasuna +16 Ft, Sevilla–Alaves +1 Ft), Monza–Napoli (−2,5
  Ft) „Közeli”. `PageHead` kapott `notice` slotot (S30 a Beállításokban használhatja). Következő: S30.

- **S28 kész.** Ítélet és célok: `evaluationVerdict(cmp, report.calibration[market])` (core) →
  `{tone,title,text,goals,met,total}`; a view (`evaluationView.ts`) csak formáz: `goalRows`, `kpis`, `scoreRows`,
  `calibrationRows`/`calibrationSummary`, `segmentRows`. CSS-változók React style-ban: `vars({...})` (`CalibrationChart.tsx`). Gól
  2,5 screenshot: `--click '.oe-segmented__btn[aria-pressed="false"]'`. Az `oeClasses.ts`-ből nem lett felesleges elem (a
  Kiértékelés nem használta). Következő: S29.

- **S27b kész.** `<SlipPanel store now presetTips />` – üresen hint + `SlipPresets` (`.oe-preset`), kitöltve a referencia
  sorrendje + „Szelvény ürítése”. Mobilon nincs BottomSheet: a panel a lista alatt, a SlipBar horgony. Kitöltött screenshot:
  `shots.mjs ... --click ".oe-preset"` (→ `docs/plans/screens/s27b-ma-dark-{1440,390}-kitoltve.png`). Következő: S28.

- **S27a kész.** Ma fej: `<PageIntro title subtitle date><DataState {...dataState(snapshot)} /></PageIntro>` (`.oe-hero`).
  TipCard: `TipActions` = SlipToggle + `Disclosure` (két egyenrangú gomb), részletek mindig renderelve `hidden`-nel. Szelvényhez
  és a lista feletti „Kész szelvények” blokkhoz (SlipPresets) NEM nyúltam → S27b. Screenshot:
  `MSYS_NO_PATHCONV=1 node frontend/scripts/shots.mjs --pages ma=/ --out "docs/plans/screens/s27b-{page}-{theme}-{width}.png"`
  (saját Vite :3126 ha nem fut, Edge CDP :9333, kiírja scrollWidth/konzolhibát, exit 1 hibánál). Git Bash nélkül a
  `MSYS_NO_PATHCONV` nem kell.

- **S26 kész.** Kompakt fej: `<PageHead title chips filters />` (`components/PageIntro/PageHead.tsx`); a nagy `PageIntro` csak a
  Ma oldalon (S27a: → `.oe-hero` + `DataState`). Fejléc: `.oe-status-pill[data-state]`. Screenshot: CDP-script (Edge
  `--remote-debugging-port`, vite `--port 3126 --strictPort`), 4 oldal × 2 téma × 2 szélesség, scrollWidth + konzolhiba + fejléc ≥
  44 px mérés.

- **S25 kész (Floodlight v0.2 alap).** Téma: `<html data-theme>`, inline script az `index.html`-ben, `MainStore.ThemeStore`
  (`effective`, `toggle`, `setPreference`). A `components.css` vendor – NE szerkeszd; hiányzó elemhez `components/ui/oeClasses.ts`
  (Tailwind, csak tokenkulcs: `sp-N`, `touch`, `on-bg`, `tint-*`, `accent-text`…). Szövegszín accenthez
  `accent-text`/`negative-text`. Screenshot: `%TEMP%/claude/.../scratchpad/s25shot.mjs` mintája (CDP, saját vite
  `--port 3100 --strictPort`, mert a :3000-en egy régi dev server futhat elavult HMR-rel).

- **M1 lezárva (2026-11-13, S24).** Kész: fixture-mód, DB-séma + repo + import, api-client budgettel, olvasó API, core (format,
  odds-matek, szelvény, feature-ök, elo-poisson v0, kiértékelés, backtest), UI (`/`, `/evaluation`, `/settings`, `/arbitrage`).
  Blokkolt: Supabase/`DATABASE_URL` és Vercel `api/` (BLOCKERS.md). Tulajdonosi döntés: Supabase-projekt + Vercel-bekötés; a v0
  modell rosszabb a piacnál (backtest-v0.md) → M2 fókusz a modell-illesztés és az élő adat. A régi oldalak kódja
  (`LegacyArbitragePage`, `OddsPage`, `FixturePage`, régi store-ok) route nélkül él, 8.3-ban törlendő.

- Arbitrázs (S23): `/arbitrage` = `pages/ArbitragePage/ArbitragePage.tsx` (komponens-state szűrő), `ArbitrageCard`,
  `arbitrageView.ts` (tiszta, teszt mellette); adat `reviveArbitrageSnapshot(json)` (JSON `Infinity` → `null`). Régi oldal:
  `LegacyArbitragePage.tsx` a `/legacy/arbitrage`-on. ui-audit #1–3/#7/#8 az új oldalon nem áll fenn (gombok + aria, stabil
  kulcsok, nincs oldalsáv/modál). S24: minden route screenshot (`%TEMP%/s23/shot.mjs <url> <out>`), GOAL-M1 lista → M1 lezárva.

- Beállítások (S22): `MainStore.SettingsStore` (`settings`, `estimate`, `warnings`, `stakeOptions`, `toggle*`, `setNumber`); a
  SlipStore 2. konstruktor-paramétere a tét-lépcső getter, a MainStore `reaction`-nel állítja a tétet egységváltáskor. Screenshot:
  CDP-script (`%TEMP%/s22/shot.mjs <url> <out>`: 1440 + 390, scrollWidth + konzolhibák).

- Kiértékelés (S21): `/evaluation` a `backtest-v0.json`-t importálja (`as unknown as BacktestReport`); nézet-modell tiszta
  függvényekkel a `pages/EvaluationPage/evaluationView.ts`-ben (teszt mellette). S22: a budget-becslés a core `budget/`-ből.

- Mobil szelvény (S20): a `SlipPanel` fragmentet ad: asztali `aside.oe-slip--desktop` + `SlipBar` + `BottomSheet`
  (`store.sheetOpen`), a `TippmixTransfer` `idPrefix`-szel (slip/sheet). A mobil-szabályok a `components.css` végén
  (`@media 640`). Screenshot: CDP-script (`Emulation.setDeviceMetricsOverride` 390, mobile) — ez valódi 390-es viewport, iframe
  nem kell. A :3000-es dev szerver már futhat (port foglalt) – HMR-cache miatt az első betöltés régi modult adhat.

- Szelvény (S19): `MainStore.SlipStore` (`toggle`, `blockedReason`, `summary`, `transferRows`, `canSave`, `save`);
  `<SlipPanel store now />` az `.oe-split__aside`. S20: < 640 px-en SlipBar (`.oe-slipbar`) + BottomSheet (`.oe-sheet`) ugyanazzal
  a SlipPanel-tartalommal; kitöltött-szelvény screenshot: Edge `--remote-debugging-port` + CDP-script (kattintás a „+ Szelvényre”
  gombokra).

- Ajánlások (S18): a `/` a `data/recommendations/recommendations-v0.json` (`RecommendationSnapshot`, core `recommend/snapshot.ts`)
  pillanatképet olvassa; `toTip`/`groupTipsByDay` a `pages/RecommendationsPage/recommendationsView.ts`-ben; a „most” a pillanatkép
  `now`-ja (TipCard `now` prop). `ITip` új mezői: `reasons`, `stakeUnits`. S19: a `selectedIds` state → SlipStore, a SlipPanel a
  `summarizeSlip`-re épül; a `sampleTips` csak a komponens-tesztekhez maradt.

- MatchDetails (S17): `<MatchDetails tip />` a TipCard `children`-jébe; adat: `ITip.home/away` (rank, points, goalDiff, stake,
  last5), `ITip.h2h` (eredmény a mostani hazai szemszögéből), `ITip.leagueSize` (alap 20). S18-nál ezeket a features-ből
  (`deriveStandings`, `teamForm`, `headToHead`, `teamMotivation` → stake szöveg) kell kitölteni. Az első kártya nyitva indul.

- TipCard (S16): `<TipCard tip selected expanded blockedReason? onToggleSlip onToggleExpand now?>{MatchDetails}</TipCard>`; a
  lenyitott tartalom a `children` (S17 ide köti a MatchDetails-t; adat: `ITip.home/away` {rank, points, goalDiff, stake, last5},
  `ITip.h2h`, típusok a `components/TipCard/tipView.ts`-ben). A `/` most `sampleTips()`-et mutat komponens-state-tel (egy nyitott
  kártya); S18 cseréli RecommendationStore-ra, S19 a kijelölést SlipStore-ra. Komponens-teszt: `renderToStaticMarkup` (node env).

- Backtest (S15): `data/backtest/backtest-v0.json` = `BacktestReport` (`overall`/`bySeason`/`byLeague` → `h2h`/`ou25` →
  `model`/`marketOpening`/`marketClosing` {n, meanBrier, meanLogLoss} + `bets` (BetSummary); `calibration.h2h/ou25`). S21 ezt
  importálja. Eredmény: v0 rosszabb a piacnál (LL 1X2 +0,040, O/U +0,015), túl lapos (a favorit alulbecsülve) → `eloGoalSlope`/K
  illesztése = ROADMAP 6.0/7.x; a „value” tippek ROI −21% / −12%, ezért az ajánlásoknál piaci kombinálás kell.

- Modell v0 (S13): `eloPoissonPrediction(fixture, { history, leagueMatches?, elo? })` → `probabilities`
  (home/draw/away/over25/under25/btts), `lambdaHome/Away`, `inputs` (features-snapshot), `explanation` (tényező, `deltaPp`, magyar
  `text`). Backtestben az Elo-t inkrementálisan léptesd (`createEloState` + `updateElo` meccsenként, átadva `elo`-ként), különben
  O(N²). Paraméterek fixek (`DEFAULT_ELO_POISSON_PARAMS`), illesztés S15 után; forma-reziduum, motiváció-korrekció = v2.

- Feature-ök (S12): `buildMatchFeatures(fixture, { seasonMatches, history?, teamIds?, zones? })` → home/away (forma, helyszíni
  forma, hazai/vendég bontás, tabellahely, tier, motiváció), H2H a hazai szemszögéből, szezonszakasz, liga hazai előnye,
  `motivationDiff`. Bemenet: `PlayedMatch` (id, kickoff, home/awayTeamId, home/awayGoals); minden pont-idejű (`kickoff < asOf`).
  S13 az Elo-t erre építse; a forma ellenfél-korrekciója (Elo-reziduum) TODO az S13-ban.

- CSV-odds a DB-ben (S11b): `odds_snapshot(source='football-data-csv', kind=opening_csv|closing_csv)`, irodák: 8 Bet365, 4
  Pinnacle, 900001 átlag, 900002 maximum; piac 1 (Home/Draw/Away), 5 (Over/Under, line 2.5). Záró `captured_at` = kezdés, nyitó =
  kezdés − 48 h. Tiszta függvények: `parseFootballDataCsv`, `matchCsvRows`, `csvRowSnapshots` (`@football/db`). S15 a záró oddsból
  számol CLV-t.

- Olvasó API: `packages/server` (`createApiHandler`, `toNodeListener`); lokálisan `npm run dev -w @football/server` → :5100 a
  `.data/pglite`-ból. A Vite-proxy még a legacy :5000-re mutat (`/api/odds` ütközik); a frontend bekötése az első DB-t olvasó
  UI-szeletnél. Vercel `api/` belépési pont: 1.6 (BLOCKERS).

- API: `createClientFromEnv(process.env, { budget: new SqlBudgetStore(db), logger: new SqlCallLogger(db), fixtures })` – env
  `API_FOOTBALL_MODE=mock|live` (alap mock), `API_FOOTBALL_KEY`, `API_FOOTBALL_HOST`. Hibák: `ApiFootballError.kind` (`budget`,
  `plan`, `quota`, `token`, `http`, `api`, `mock-missing`), `retryable` csak 5xx/429. Mock-kulcs: `fixtureKey(endpoint, params)`.
  Az S11 élő hívásai ezen menjenek (napló: `api_call_log`; a válasz fixture-be mentése a hívó dolga).

- Import: `importLegacy(repo, { fixtureFiles, oddsFiles })`, `mapLegacyFixtures/mapLegacyOdds/parseSelection` (`"Over 2.5"` →
  Over + line 2.5) a `@football/db`-ből; az S11 CSV-import ugyanide (`packages/db/src/import/`). Lokális DB: `.data/pglite`
  (git-ignored); scriptek: `packages/db/scripts/` (vite-node).

- DB: `import { openMemoryRepository } from '@football/db'` → `{ db, repo }` (PGlite + migrációk; `dataDir` arg = fájlba ment).
  Upsertek idempotensek (`unchanged` = S08 ellenőrzés), `insertOddsSnapshot` → `{id, created}` (kulcs:
  fixture+captured_at+source), predikció csak `appendPredictions`. Sorrend az FK-k miatt: league/season/team/bookmaker/market →
  fixture → odds.
- Új oldal: `pages/<X>Page/`, `<PageIntro title subtitle date? aside?/>` + tartalom; a keret (`oe-container`, fejléc) az
  `AppShell`-ből jön. Route: `components/Main/Main.tsx`.
- Szelvény: `summarizeSlip(legs, stake)` → eredő odds, esély, EV, min. odds, nyeremény, szingli-összevetés, kockázat, `estimated`
  (van-e láb beírt Tippmix-odds nélkül). A SlipStore (S19) erre épüljön.
- Core-ból: `formatOdds/Percent/Pp/Ev/Ft/Units/Kickoff/YearMonth/Score/Pairing/Age` (NBSP ezres, `−` mínusz, Europe/Budapest),
  `fairProbabilities`, `consensusFairProbabilities`, `bestOdds`, `expectedValue`, `edgePp`, `minOdds`. S04 a szelvény-matekot
  ezekre építse (`packages/core/src/slip/`).

- Tokenek élnek: Tailwindben Floodlight nevek (`bg-canvas`, `bg-raised`, `border-border-default`, `text-text-secondary`,
  `rounded-l`, `font-display`, `text-num-m`…), TS-ben `v('…')`; az oe-\* osztályok globálisan betöltve.
- Fixture-mód él: minden `FetchService*.get` a `resolveFixture`-ből felel, hacsak nincs `VITE_DATA_MODE=live` (a `.env`-be a
  tulajdonos írja).

- Történeti adat: `data/history/` (README). 2022–24 meccsek a DB-ben (`npm run import:history -w @football/db`, a
  `mapLegacyFixtures` újrahasznosítva). CSV: `B365H/D/A` nyitó, `B365CH/CD/CA` záró, `PSH`/`PSCH` Pinnacle, `AvgH`/`AvgCH`,
  `Avg>2.5`/`AvgC>2.5`; `Date` dd/mm/yyyy; csapatnév-eltérés („Man United”) → alias. 2026-11-12-én 15 élő hívás ment el (keret
  20).
- ui-audit P0/P1 = a §5 táblázat 🔴 (#1–3) és 🟠 (#4–8) tételei, szeletekhez rendelve.
