# STATE – autonóm fejlesztés állapota

> Minden session ezt olvassa el ELSŐKÉNT, és minden szelet végén frissíti. Ha minden szelet kész, írd ide külön sorba: ALL_DONE

## Aktuális fázis

M1 (docs/GOAL-M1.md): S01–S24 kész, az M1 végállapota teljesül. ALL_DONE M1

**Most: „Floodlight v0.2” redesign** (S25–S30). Terv: `docs/plans/redesign-floodlight-v0.2.md` (a tulajdonos jóváhagyta,
2026-11-13); csomag: `docs/design/floodlight-v0.2/` (DESIGN.md, CHANGES.md „Kész, ha” pontok, screens/, reference/).

## Következő szeletek (sorrendben, az első a soron következő)

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
(`?theme=light|dark`) → `docs/plans/screens/<szelet>-<oldal>-<téma>-<szélesség>.png`, összevetés a csomag screens/-ével.
Adatot nem találunk ki: a terv „Hiányzó adat” blokkjai rejtve. Üzleti logika / modell / ingestion / DB-séma nem változik.

1. **S25 – Tokenek és téma** (CHANGES 0.): v0.2 tokens + components.css (vendor, változatlan), DESIGN.md csere, data-theme +
   villanásmentes inline script, ThemeStore (MobX, `oe-theme`), fejléc-váltó, kieső osztályok/tokenek kiváltása
   (Tailwind-utility tokenből), ADR: Tailwind + Floodlight komponens-CSS. A v0.2 `reference/*.html` → `src/design/reference/`
   (a v0.1 `components.html` helyett, CLAUDE.md hivatkozás frissítése).
2. **S26 – Közös keret** (CHANGES 1.): fejléc/nav/`.oe-status-pill`, `PageHead` (kompakt cím + meta-chipek), semleges kiválasztás.
3. **S27a – Ma: tippkártya + adat-állapot sor** (CHANGES 2.1, 2.4, 2.5).
4. **S27b – Ma: szelvény + presetek** (CHANGES 2.2, 2.3; core preset/„minden N-edik” tesztekkel).
5. **S28 – Kiértékelés** (CHANGES 3.; core goals/verdict tesztekkel).
6. **S29 – Arbitrázs** (CHANGES 4.; core kerekítés-címke teszttel).
7. **S30 – Beállítások** (CHANGES 5.).

## Kész

| Szelet                          | Commit                                                          | Megjegyzés                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S01 – 0.5 Fixture-mód           | (lásd git log: feat(data): fixture mode)                        | `VITE_DATA_MODE=fixture                                                                                                                                                                                                                                                                                                                                                       | live`, alap fixture; resolver: `frontend/src/services/fixtures/` |
| S02 – A1 Tokenek bekötése       | (lásd git log: feat(design): wire Floodlight tokens)            | `npm run tokens` (predev/prebuild), tokens+components.css az `index.tsx`-ben, Tailwind theme `var(--…)`                                                                                                                                                                                                                                                                       |
| S03 – Core format + odds-matek  | (lásd git log: feat(core): add Hungarian format)                | `format/format.ts`, `model/market.ts` (B0: fair p, konszenzus, legjobb odds), `odds/value.ts` (EV, edge, min. odds)                                                                                                                                                                                                                                                           |
| S04 – Core szelvény-matek       | 2e38979                                                         | `slip/slip.ts`: `summarizeSlip`, `riskLevel`, `slipTypeName`, `addLeg`/`hasFixture` (egy meccs = egy tipp), `legOdds`                                                                                                                                                                                                                                                         |
| S05 – B App shell               | (lásd git log: feat(ui): add app shell)                         | AppShell/AppHeader/PageIntro/EmptyState; `/`, `/evaluation`, `/settings`; `/odds`,`/fixtures` → `/`, régi nézetek `/legacy/*`; ui-audit #4, #12                                                                                                                                                                                                                               |
| S06 – 1.3 DB-séma               | (lásd git log: feat(db): add Postgres schema)                   | `packages/db`: `migrations/0001–0005_*.sql` (§10 teljes), `migrate()` + `schema_migration` checksum; PGlite-teszt; `api_budget_reserve` ≤ 100                                                                                                                                                                                                                                 |
| S07 – DB repository             | (lásd git log: feat(db): add repository)                        | `Repository` + `SqlRepository` (`SqlExecutor` fölött), `openMemoryRepository()` = PGlite+migrate; upsert → `{inserted,updated,unchanged}`                                                                                                                                                                                                                                     |
| S08 – 1.4 Legacy import         | (lásd git log: feat(db): import legacy JSON)                    | `npm run import:legacy -w @football/db [-- dataDir]` → `.data/pglite`; 3656 fixture, 510 snapshot, 150 899 quote; a 2. futás 0 írás                                                                                                                                                                                                                                           |
| S09 – 1.2 api-client + budget   | (lásd git log: feat(api-client))                                | `@football/api-client`: `ApiFootballClient` (mock/live), `SqlBudgetStore` (`api_budget_reserve`), `SqlCallLogger`, `getAllPages`, `status()`                                                                                                                                                                                                                                  |
| S10 – 1.5 Olvasó API            | (lásd git log: feat(server))                                    | `@football/server`: `createApiHandler({repo,budget})` Web Request→Response; `/api/fixtures` (szűrés+lapozás), `/api/odds/:id`, `/api/budget`; `npm run dev -w @football/server` :5100                                                                                                                                                                                         |
| S11a – Történeti meccsek        | (lásd git log: feat(data): fetch 2022–2024 history)             | 15 élő hívás (`fetch:history`, napló: `api_call_log`); `data/history/api-football` 5341 meccs + `football-data` 15 CSV; `import:history` idempotens                                                                                                                                                                                                                           |
| S11b – CSV-odds import          | (lásd git log: feat(data): import football-data CSV odds)       | `import:odds-csv`: 5330/5330 párosítva, 11 170 snapshot (opening/closing), ~213k quote, 119 `team_alias`; 2. futás 0 írás                                                                                                                                                                                                                                                     |
| S12 – Core feature-ök           | (lásd git log: feat(core): add match features)                  | `features/`: `teamForm`, `homeAwaySplit`, `leagueHomeAdvantage`, `headToHead`, `deriveStandings` (4.3 mag), `tablePosition`, `seasonPhase`/`tableTier`, `teamMotivation` (§3.1), `buildMatchFeatures`                                                                                                                                                                         |
| S13 – Modell v0                 | (lásd git log: feat(core): add elo-poisson model)               | `model/elo.ts` (inkrementális Elo), `poisson.ts` (Dixon–Coles mátrix → 1X2/O-U 2.5/BTTS), `eloPoisson.ts` (`eloPoissonPrediction`, ablációs indoklás); terv: `docs/plans/model-v0.md`                                                                                                                                                                                         |
| S14 – Kiértékelés + budget      | (lásd git log: feat(core): add evaluation and budget estimates) | `evaluation/` (`settleBet`, `flatProfit`, `brierScore`, `logLoss`, `closingLineValue`, `calibrationBuckets`, `summarizeBets`, `summarizeProbabilities`); `budget/` (`estimateLeagueCallsPerRound`, `estimateDailyCalls`, `estimateOddsStorage`)                                                                                                                               |
| S15 – Backtest-futtató          | (lásd git log: feat(core): add walk-forward backtest)           | `backtest/` (`runBacktest`, `summarizeSegment`, `buildBacktestReport`); `npm run backtest -w @football/db` (CSV, 0 hívás) → `data/backtest/backtest-v0.json` + `docs/analysis/backtest-v0.md`; v0 LL 1X2 0,997 vs. záró 0,957                                                                                                                                                 |
| S16 – A2a TipCard               | (lásd git log: feat(ui): add TipCard)                           | `components/TipCard/`: `TipCard`, `TeamForm`, `ProbabilityBars`, `TipActions`, `Disclosure`, `tipView.ts` (`ITip` = PRD 6 nézet-modell, magyar címkék); `components/EngineBanner/`; `/` minta-kártyákkal (`sampleTips`), screenshot 1440/390                                                                                                                                  |
| S17 – A2b MatchDetails          | (lásd git log: feat(ui): add MatchDetails)                      | `components/MatchDetails/`: `LeagueStrip`, `H2HList`, `RecentList`, `matchDetailsView.ts` (sáv-zónák, H2H/forma összegzés); core `formatDecimal`/`formatSignedInt`; `ITip.leagueSize`; minta-H2H; screenshot 1440/390                                                                                                                                                         |
| S18 – 5.4 Ajánlások oldal       | (lásd git log: feat(ui): recommendations page)                  | core `recommend/` (`blendProbabilities` w=0,25, `evaluateMarket`, `pickRecommendation`, `dataWarnings`, `confidenceLevel`, snapshot-típusok); `npm run recommendations -w @football/db` → `data/recommendations/recommendations-v0.json` (2025-04-12/13: 40 meccs, 2 tipp); `/` Ma/Holnap + indoklás; screenshot 1440/390                                                     |
| S19 – SlipStore + SlipPanel     | (lásd git log: feat(ui): add SlipStore and SlipPanel)           | core `parseOddsInput`/`transferStatus`; `stores/SlipStore.ts` (MainStore.SlipStore; tét 500–5000, beírt odds, `save()` → localStorage `oe_saved_slips`); `components/SlipPanel/` (SlipLegs, SlipTotals, RiskMeter, StakeSelector, TippmixTransfer, `slipView.ts`); `/` `.oe-split`; screenshot 1440/390 (CDP-kattintással kitöltve)                                           |
| S20 – Mobil szelvény + presetek | (lásd git log: feat(ui): add mobile slip and SlipPresets)       | core `slip/presets.ts` (`presetCandidates`, `buildSlipPresets`: Szingli/Dupla/Hármas, „Ajánlott” = max EV nem magas kockázattal); `SlipStore.applyPreset`/`hasExactly`/`openSheet`; `SlipPresets`, `SlipBar`, `BottomSheet` (Esc, háttér, ✕, fókusz vissza); < 640 px: `.oe-slip--desktop` rejtve; screenshot 1440/390 (sáv + lap)                                            |
| S21 – `/evaluation` dashboard   | (lásd git log: feat(ui): evaluation dashboard)                  | `pages/EvaluationPage/`: `evaluationView.ts` (szegmens-opciók, `betTiles` ROI ±1,96 SE, `scoreRows` modell/nyitó/záró, `verdict`, `segmentRows`, `calibrationPoints`/`calibrationError`), `CalibrationChart` (SVG, tokenekkel); szűrő: piac (1X2/Gól 2,5) + szegmens (szezon/liga, a bontás-sorra kattintva is); forrás `data/backtest/backtest-v0.json`; screenshot 1440/390 |
| S22 – `/settings`               | (lásd git log: feat(ui): settings page)                         | `pages/SettingsPage/settingsView.ts` (katalógus: 9 liga, 3 piac, 8 iroda; `sanitizeSettings`, `estimateSettings` a core `budget/`-ből, `settingsWarnings`, `stakeOptions`); `stores/SettingsStore.ts` (localStorage `oe_settings`); a SlipStore tét-lépcsője az alapegységből; screenshot 1440/390                                                                            |
| S23 – `/arbitrage`              | (lásd git log: feat(ui): arbitrage page)                        | core `arbitrage/scan.ts` (`scanMarket`, `arbitrageSum`, `arbitrageStakes`, `arbitrageBand`, `ArbitrageSnapshot`; egyezik a régi `analyzeBookmakers`-szel); `npm run arbitrage -w @football/db` → `data/arbitrage/arbitrage-v0.json` (88 meccs, 3 arb, 70 közeli); kártyák, sáv/piac/iroda szűrő, tét-elosztás 10 Ft-ra; régi oldal `/legacy/arbitrage`; screenshot 1440/390   |
| S24 – M1 zárás                  | (lásd git log: chore(m1): close M1)                             | ui-audit P0/P1: a régi `/legacy/*` nézetek kikerültek a routingból (→ `/`), így #1–8 sehol nem áll fenn; screenshot 1440/390 minden route-ról (`/`, `/evaluation`, `/settings`, `/arbitrage`, `/odds`→`/`): scrollWidth ≤ viewport, 0 konzolhiba; `npm run verify` zöld                                                                                                       |

## Polish backlog

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
- Arbitrázs (S23): a pillanatkép CSV-ből, nem a DB `odds_snapshot`-ból (8.1/8.3); a beállított ligák/irodák nem szűrnek; odds-kor
  figyelmeztetés nincs; a „most” utáni 10 nap oddsa kezdés − 48 h; csak 1X2 és Gól 2,5 (AH nincs); a régi `/legacy/arbitrage`
  (oldalsáv, modál – ui-audit #3/#7/#8 ott maradt) a 8.3-mal törlendő.
- Headless Edge 500 px alatt nem szűkíti a viewportot: 390-es screenshot iframe-burkolóval (`<iframe width=390>`) készül.
- Régi Tailwind színnevek (bg, surface, accent…) aliasként élnek a `tailwind.config.cjs`-ben; A3 után törölni.
- `components.css` Google Fonts `@import`-ot húz (külső hálózat); később self-host.
- `/api/fixtures` a teljes szűrt listát olvassa, a lapozás JS-ben (TODO(polish): LIMIT/OFFSET SQL-ben).
- `SqlRepository.upsert` és a quote-insert soronként ír (TODO(polish)): a teljes legacy import ~26 s; S11-nél köteges INSERT, ha
  zavar.
- Fixture-mód: `/fixtures/statistics` és `/odds?bet=` szűrés nincs mentve (üres válasz); az `/odds/mapping` csak 1 mentett oldal.

## Jegyzet a következő sessionnek (max. 10 sor)

- **M1 lezárva (2026-11-13, S24).** Kész: fixture-mód, DB-séma + repo + import, api-client budgettel, olvasó API, core (format,
  odds-matek, szelvény, feature-ök, elo-poisson v0, kiértékelés, backtest), UI (`/`, `/evaluation`, `/settings`, `/arbitrage`).
  Blokkolt: Supabase/`DATABASE_URL` és Vercel `api/` (BLOCKERS.md). Tulajdonosi döntés: Supabase-projekt + Vercel-bekötés; a v0
  modell rosszabb a piacnál (backtest-v0.md) → M2 fókusz a modell-illesztés és az élő adat. A régi oldalak kódja
  (`LegacyArbitragePage`, `OddsPage`, `FixturePage`, régi store-ok) route nélkül él, 8.3-ban törlendő.

- Arbitrázs (S23): `/arbitrage` = `pages/ArbitragePage/ArbitragePage.tsx` (komponens-state szűrő), `ArbitrageCard`,
  `arbitrageView.ts` (tiszta, teszt mellette); adat `reviveArbitrageSnapshot(json)` (JSON `Infinity` → `null`). Régi oldal:
  `LegacyArbitragePage.tsx` a `/legacy/arbitrage`-on. ui-audit #1–3/#7/#8 az új oldalon nem áll fenn (gombok + aria, stabil
  kulcsok, nincs oldalsáv/modál). S24: minden route screenshot (`%TEMP%/s23/shot.mjs <url> <out>`), GOAL-M1 lista → `ALL_DONE M1`.

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
