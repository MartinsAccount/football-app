# STATE – autonóm fejlesztés állapota

> Minden session ezt olvassa el ELSŐKÉNT, és minden szelet végén frissíti. Ha minden szelet kész, írd ide külön sorba: ALL_DONE

## Aktuális fázis

M1 (docs/GOAL-M1.md): S01–S04 kész, következik S05 (app shell).

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

1. **S05 – B App shell:** AppHeader + AppShell, route-ok (`/` Ma, `/evaluation`, `/settings`, `/arbitrage`), `/odds` és
   `/fixtures` átirányítva, üres oldalak PageIntro-val; ui-audit #4, #12; screenshot 1440/390.
2. **S06 – 1.3 DB-séma:** `db/migrations/*.sql` (liga, csapat, meccs, tabella-snapshot, odds-snapshot + quote, prediction
   append-only, evaluation, api_call_log, api_budget_day, setting), idempotens (`IF NOT EXISTS`). A Supabase-bekötés → BLOCKERS.
3. **S07 – packages/db repository:** repository-interfész + in-memory/fixture adapter, tesztekkel (prediction append-only,
   upsert-idempotencia).
4. **S08 – 1.4 Import script:** régi JSON-ok (`frontend/src/data/allMatch*`, `backend/stores/*-odds.json`) → adapter; idempotens
   (2. futás 0 új sor); teszt.
5. **S09 – 1.2 packages/api-client + budget-őr:** host/kulcs env-ből (csak szerver), napi számláló (soha > 100), `errors`-kezelés,
   lapozás, hívásnapló, mock mód; tesztek fixture-rel.
6. **S10 – Backend-proxy:** `api/` olvasó végpontok (`/api/fixtures`, `/api/odds/:id`, `/api/budget`) az adapterből, lokálisan; a
   kulcs csak szerveroldalon.
7. **S11 – Történeti adat 2022–2024 (élő, ≤ 15 hívás, naplózva):** `fixtures?league&season` 5 liga × 3 szezon → fixture-fájlok; +
   football-data.co.uk CSV záró-oddsok (ingyenes) → import. Ha nem megy: backtest a 2020–21 adaton, DECISIONS-be.
8. **S12 – Core: feature-ök:** forma, hazai/vendég, H2H, pont-idejű tabellahely, szezonszakasz, motiváció/tét; tesztek.
9. **S13 – Core: modell v0 `elo-poisson@0.1.0`:** Elo + Poisson → 1X2, O/U 2.5, indoklás (tényező-hozzájárulás); tesztek.
10. **S14 – Core: kiértékelés + budget-becslés:** találat, flat profit, Brier, log-loss, CLV, kalibrációs vödrök; budget-becslés
    ligánként; tesztek.
11. **S15 – Backtest-futtató:** walk-forward 2022–2023 → 2024, piaci baseline vs. v0; riport `docs/analysis/backtest-v0.md` + JSON
    az `/evaluation`-hoz.
12. **S16 – A2a TipCard:** TipCard, TeamForm, ProbabilityBars, TipActions, Disclosure, EngineBanner (DESIGN §7.3–7.4).
13. **S17 – A2b MatchDetails:** LeagueStrip, H2HList, RecentList (DESIGN §7.5).
14. **S18 – `/` Ajánlások oldal:** predikciók fixture-adatból, PRD 6. mezők, adatkor, figyelmeztetések, min. odds; screenshot.
15. **S19 – SlipStore + SlipPanel:** SlipLegs, SlipTotals, RiskMeter, StakeSelector, TippmixTransfer (beírt odds + tét mentése,
    leadás nincs).
16. **S20 – Mobil szelvény + SlipPresets:** SlipBar + BottomSheet, SlipPresets; screenshot 390.
17. **S21 – `/evaluation` dashboard:** ROI, Brier, log-loss, kalibráció, CLV a backtest-JSON-ból; szűrők.
18. **S22 – `/settings`:** ligák, piacok, irodák, becsült napi hívás és tárhely (core budget-becslés).
19. **S23 – `/arbitrage` átalakítás:** új core + design; ui-audit #1–3, #7, #8.
20. **S24 – M1 zárás:** maradék ui-audit P0/P1, minden route screenshot 1440/390, konzolhiba nincs, GOAL-M1 ellenőrzőlista →
    `ALL_DONE M1`.

## Kész

| Szelet                         | Commit                                               | Megjegyzés                                                                                                            |
| ------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| S01 – 0.5 Fixture-mód          | (lásd git log: feat(data): fixture mode)             | `VITE_DATA_MODE=fixture                                                                                               | live`, alap fixture; resolver: `frontend/src/services/fixtures/` |
| S02 – A1 Tokenek bekötése      | (lásd git log: feat(design): wire Floodlight tokens) | `npm run tokens` (predev/prebuild), tokens+components.css az `index.tsx`-ben, Tailwind theme `var(--…)`               |
| S03 – Core format + odds-matek | (lásd git log: feat(core): add Hungarian format)     | `format/format.ts`, `model/market.ts` (B0: fair p, konszenzus, legjobb odds), `odds/value.ts` (EV, edge, min. odds)   |
| S04 – Core szelvény-matek      | 2e38979                                              | `slip/slip.ts`: `summarizeSlip`, `riskLevel`, `slipTypeName`, `addLeg`/`hasFixture` (egy meccs = egy tipp), `legOdds` |

## Polish backlog

- 390 px-en a régi layout (fejléc-nav + arbitrázs sidebar) vízszintesen túlcsordul → S05 app shell / S23 arbitrázs.
- Régi Tailwind színnevek (bg, surface, accent…) aliasként élnek a `tailwind.config.cjs`-ben; A3 után törölni.
- `components.css` Google Fonts `@import`-ot húz (külső hálózat); később self-host.
- Fixture-mód: `/fixtures/statistics` és `/odds?bet=` szűrés nincs mentve (üres válasz); az `/odds/mapping` csak 1 mentett oldal.

## Jegyzet a következő sessionnek (max. 10 sor)

- Szelvény: `summarizeSlip(legs, stake)` → eredő odds, esély, EV, min. odds, nyeremény, szingli-összevetés, kockázat, `estimated`
  (van-e láb beírt Tippmix-odds nélkül). A SlipStore (S19) erre épüljön.
- Core-ból: `formatOdds/Percent/Pp/Ev/Ft/Units/Kickoff/YearMonth/Score/Pairing/Age` (NBSP ezres, `−` mínusz, Europe/Budapest),
  `fairProbabilities`, `consensusFairProbabilities`, `bestOdds`, `expectedValue`, `edgePp`, `minOdds`. S04 a szelvény-matekot
  ezekre építse (`packages/core/src/slip/`).

- Tokenek élnek: Tailwindben Floodlight nevek (`bg-canvas`, `bg-raised`, `border-border-default`, `text-text-secondary`,
  `rounded-l`, `font-display`, `text-num-m`…), TS-ben `v('…')`; az oe-\* osztályok globálisan betöltve.
- Fixture-mód él: minden `FetchService*.get` a `resolveFixture`-ből felel, hacsak nincs `VITE_DATA_MODE=live` (a `.env`-be a
  tulajdonos írja).

- Mentett adat csak 2020–2021 (`frontend/src/data/allMatch*`) és 2021-es Unibet odds (`backend/stores`); a 2022–24 adat az S11-ben
  jön (élő, max. 20 hívás/nap, naplózva, fixture-be mentve).
- A `.env`-ben nincs Supabase-adat → S06-ban a valódi bekötés a BLOCKERS-be, in-memory adapterrel megyünk tovább.
- ui-audit P0/P1 = a §5 táblázat 🔴 (#1–3) és 🟠 (#4–8) tételei, szeletekhez rendelve.
