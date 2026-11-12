# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A personal, single-user football (soccer) betting-analysis app that automates the owner's pre-match analysis. The app is being reshaped around its new **main feature: match analysis + bet recommendations**. For the owner's configured leagues it collects fixtures, standings, injuries and pre-match odds snapshots on a schedule. It estimates per-market probabilities (form, home/away, H2H, table position, motivation/stakes, injuries, season phase) against a market baseline and recommends value bets with an explanation. It logs every prediction with its model version and feature snapshot, and evaluates them automatically after each match (hit rate, ROI, Brier/calibration, CLV), so the strategy can improve over time. **Arbitrage detection** (best odd per outcome across bookmakers, `Σ 1/odd < 1`) remains as a separate, secondary module.

**Today vs. target:** today it is a localhost Vite + React 17 + MobX v5 SPA that calls API-Football directly from the browser, caches in localStorage, and has a small Express backend that stores JSON files. The target is a hosted app on Vercel (Hobby, decided) with a Supabase Postgres database (decided). Behind it, a backend API proxy with a daily call budget (free tier: 100 calls/day) and scheduled ingestion jobs. The architecture sections below describe the **current** code. The target is in `docs/architecture.md`.

**Repo layout** (npm workspaces, one `npm install` at the root — ADR-0008):

```
packages/core/   @football/core — pure domain logic, no I/O (odds & bet types, arbitrage; later: features, models, evaluation). Strict TS. Unit-tested.
packages/db/     @football/db — Postgres migrations (migrations/*.sql) + runner, PGlite-tested; later repositories/adapters.
packages/api-client/ @football/api-client — the single API-Football client (server-only): budget guard, serialized calls, errors, paging, call log, mock mode.
packages/server/ @football/server — read API (/api/fixtures, /api/odds/:id, /api/budget) as Web Request→Response handlers over @football/db; local: npm run dev -w @football/server (:5100).
frontend/        Vite + React 17 + MobX v5 SPA (football-app-web). Imports domain logic from @football/core.
backend/         legacy Express JSON store (football-app-legacy-api) — replaced by Vercel api/ + Supabase in ROADMAP §1
docs/            PRD, ROADMAP, architecture, api/, analysis/, adr/, plans/, fe/
```

Planned next to these (ROADMAP §1): `api/` (Vercel functions), `packages/db`, `packages/api-client`, `scripts/`. **Where new code goes:** anything that computes (probabilities, EV, arbitrage, evaluation, feature extraction, budget estimates) → `packages/core` with tests; UI/state → `frontend`; I/O (HTTP, DB) → `api/` / `packages/*-client`, never in core.

Note: the code, comments, and many identifiers are in **Hungarian** (e.g. `Vegeredmeny` = Match Winner, `MindketCsapatGol` = Both Teams Score). Preserve this when editing.

## Start here (agentic workflow)

- **`docs/PRD.md`**: what the app is for. Covers the problem, the modules and their priorities (recommendation engine = core, arbitrage = secondary), what a recommendation must contain, success metrics, **non-goals**, and the open decisions (D1–D10). If a request falls under a non-goal, flag it instead of building it.
- **`docs/ROADMAP.md`**: ordered work slices in phases, each one committable and verifiable. Pick the next unchecked slice unless told otherwise, and tick it (`[x]` + commit hash) when done. 🔶 marks a decision point (the owner decides, ADR first). 💸 marks a slice that makes live API calls (ask first).
- **`docs/architecture.md`**: current → target architecture. Covers hosting, DB and auth proposals, the ingestion/scheduler design with quota accounting, the **data model**, the migration path from JSON/localStorage, and ADR candidates. Everything there is a *proposal* until an ADR accepts it.
- **`docs/api/api-football.md`**: the API-Football v3 reference for this app. Covers endpoints, params, pagination, update frequencies, error/quota behaviour, the **call budget**, and an audit of the current `ApiURLs.ts`. Read it before adding or changing any API call. Key caveats: the free plan covers only seasons 2022–2024 (measured, ADR-0002). Odds are kept only 7 days. `/odds` is paginated at 10 fixtures per page.
- **`docs/analysis/strategy.md`**: the prediction/recommendation methodology. Covers factors, baseline models (market, API `/predictions`, Elo, Poisson/Dixon–Coles), EV and staking rules, and the learning loop (logging, evaluation, backtesting, model lifecycle).
- **Work loop for non-trivial changes:** plan in `docs/plans/<topic>.md` → user approval → implement → verify (tests, typecheck, screenshot of the running app for UI) → ADR if a decision was made. ADRs live in `docs/adr/` (template: `docs/adr/_template.md`), numbered `NNNN-slug.md`.
- **API budget & data (ADR `docs/adr/0002-adatforras.md`):** free plan, **only seasons 2022–2024** are accessible (`CURRENT_SEASON = 2024`). Live calls are **allowed within the 100/day quota** to test fetching/saving — check `/status` (free, doesn't count) before and after a batch, and never run unbounded loops (full arbitrage run, all-league scans) without asking. UI and business-logic work uses saved data (fixtures/DB) by default. Never print the API keys. On Windows, `curl` needs `--ssl-no-revoke`.
- **Decided:** hosting Vercel Hobby (ADR-0003), database Supabase Postgres (ADR-0004; keep SQL standard Postgres), frontend Vite + Vitest (ADR-0007), workspaces + `packages/core` (ADR-0008). The owner lets the agent shape repo structure and tooling; product decisions (🔶) still go to the owner.
- **Docs language:** project docs (PRD, plans, ADRs) are Hungarian; commit messages are English.

## Commands

Run from the repo root.

```bash
npm install                      # all workspaces (see network note below)
npm run dev                      # backend :5000 + frontend :3000 (Vite proxies /api → :5000)
npm run verify                   # prettier check + per-workspace verify (core: typecheck+tests; frontend: typecheck+tests+build)
npm test                         # all workspace tests once
npm run format                   # prettier --write
npm run test -w @football/core   # vitest watch in one workspace; single file: npx vitest run src/arbitrage -w ... or cd into it
npm run build                    # frontend production build → frontend/build
```

- **Definition of done for a change:** `npm run verify` is green; for UI changes also render the route and look at it (see "Visual check" below).
- No ESLint (CRA's was dropped with the Vite migration). The backend has no tests. One root `.prettierrc` (tabs, single quotes, width 130); `.gitattributes` keeps LF.
- Root `.npmrc` pins `legacy-peer-deps` (mobx-react 5 peer range) — don't remove it. `packages/core` is consumed as TS source (`exports: ./src/index.ts`), no build step.
- **Network on this machine:** TLS is intercepted (Check Point Harmony SASE). `npm install` needs `NODE_OPTIONS=--use-system-ca` (and running outside the sandbox); `curl` needs `--ssl-no-revoke`.
- **Visual check without Playwright:** headless Edge works — `msedge --headless=new --virtual-time-budget=30000 --window-size=1440,900 --screenshot=<scratchpad>/x.png http://localhost:3000/<route>` (use `--dump-dom` + `--enable-logging=stderr` to read console errors).
- **MobX v5 decorators under Vite:** `tsconfig` has `experimentalDecorators: true` + `useDefineForClassFields: false`, and `vite.config.ts` gives plugin-react's Babel the `decorators-legacy` parser plugin. Breaking either one silently stops the app from rendering in dev.

## Architecture

### Frontend (MobX + React class components)

- **State lives in MobX stores**, not component state. `MainStore` (`src/stores/MainStore.ts`) is the root, provided via `mobx-react` `<Provider>` in `App.tsx`. It owns one store per page: `OddsStore`, `ArbitrageStore`, `FixtureStore`. Components are class components decorated with `@inject('MainStore') @observer`.
- **Stores use `flow(function* ...)`** for async actions (MobX generator-based async) rather than async/await. `@observable`/`@action`/`@computed` decorators throughout. This is MobX **v5** (legacy decorator semantics) — keep that in mind, the API differs from MobX 6.
- **Page module pattern**: each page under `src/pages/<Page>/` is self-contained with its own `components/`, `models/`, `services/`, `stores/`. Shared models/constants live in `src/core/`. Styling: see Conventions (Tailwind).
- **Routing**: `react-router-dom` v5 (`Switch`/`Route`) in `components/Main/Main.tsx`. Three routes: `/odds`, `/fixtures`, `/arbitrage`.

### The arbitrage pipeline (`src/pages/ArbitragePage/stores/ArbitrageStore.ts`)

This is the heart of the app. Flow:
1. `searchAllLeagueIds` — pages through the API's odds-mapping endpoint to collect every league id that has an upcoming (not-yet-played) fixture.
2. `helperHighestOdds` → `getHighestOdds(leagueId)` — for each league, fetch all fixtures-with-bookmakers and compute arbitrage per bet type.
3. `analyzeBookmaker(bookmakers, betType, expectGoals?)` — delegates to the pure, tested `src/core/arbitrage/analyzeBookmakers.ts`; scans all bookmakers, keeps the highest odd per outcome, sums `1/odd`. Bet types are bucketed into **twoParams** (2 outcomes, e.g. Home/Away), **threeParams** (1X2 results), and **specialTwoParams** (Over/Under goal lines, parameterized by `expectGoals` 2.5/3.5). `arbitrage < 1` = profitable.
4. Results (`Arbitrages: IAnalyzedFixture[]`) feed `@computed` getters that power the UI's filtering/grouping (`getArbitragesByBetType`, `getArbitrageRanges`, `getBookmakers`, `getBetTypes`, `getInformations`) and the bet-type vs. original list views.

Bet-type enum (API string ↔ Hungarian name) is in `src/core/constants/BetTypes.ts`. `CALCULATE_ARBITRAGE` / `CALCULATE_GOAL_NUMBER_ARBITRAGE` arrays in the store select which bet types are analyzed.

### External API access & rate limits

- The football API is the **free API-Football tier: 100 requests/day** (seasons 2022–2024 only, `CURRENT_SEASON = 2024`). The code still carries older per-minute throttling (~61s pause every 10 requests, `timeoutAllLeaguesId`) which does not protect the daily cap; `MainStore.fetchNumber` counts calls. See `docs/plans/api-optimization.md`. Planned: route all calls through the backend as proxy + cache + daily counter (ROADMAP §1).
- **API keys live in `frontend/.env`** (git-ignored; template `frontend/.env.example`): `VITE_RAPIDAPI_KEY` for `FetchService`, `VITE_APISPORTS_KEY` for `FetchService3` (read via `import.meta.env`, typed in `src/vite-env.d.ts`). Never write a key into source. Restart the dev server after changing `.env`; until the backend proxy (ROADMAP §1) takes over, the keys still ship in the browser bundle. The two services target different API hosts: `FetchService` → `api-football-v1.p.rapidapi.com` (RapidAPI), `FetchService3` → `v3.football.api-sports.io` (direct API-Sports). `ArbitrageStore` uses `MainStore.FetchService` (the former); `OddsService` uses `FetchService3`.
- All API URLs are centralized in `src/services/ApiURLs.ts`. Season and bookmaker ids are in `src/core/constants/constants.ts` (`CURRENT_SEASON`, `UNIBET`).

### Caching

Computed arbitrage results and league ids are cached in **localStorage** via `src/shared/utils/LocalStorageUtil.ts` (TTL-based, keys prefixed `ls_`). `searchAllLeagueIds(_, dataFromCache=true)` short-circuits to the cached results to avoid re-fetching.

### Backend (`backend/`)

Minimal Express server. Single route group `/api/odds` (`backend/routes/odds.js`):
- `GET /api/odds` — returns the five committed per-country odds files (`stores/{england,france,germany,italy,spain}-odds.json`) merged into one response.
- `POST /api/odds?country=<x>` — appends new fixtures (deduped by `fixture.id`) into `stores/<country>-odds.json` on disk.

The `stores/*.json` files are the persisted dataset and are committed to the repo. No database.

## Conventions

- **Match the surrounding style**: tabs, Hungarian identifiers/comments, MobX v5 decorator patterns, class components. Large blocks of commented-out alternative implementations are intentional scratch history — don't assume they're dead code to delete unless asked.
- **Styling is Tailwind** (ADR `docs/adr/0001-tailwind-as-styling-base.md`, config in `frontend/tailwind.config.cjs`). Preflight is on; the legacy SCSS layer was removed. Design rules and tokens: see "5. Design" under "Autonóm munkamód".


## Autonóm munkamód

Ez a szakasz **felülírja a PRD 12. fejezetének jóváhagyási pontjait** („javaslatot csak a
tulajdonos fogad el”, „élő hívás csak jóváhagyással”). A tulajdonos nincs jelen, és nem akar
kérdéseket kapni. Haladj magadtól, szeletről szeletre.

### 1. Ne kérdezz, dönts
- Ha kérdés merül fel, a PRD, a ROADMAP, az `architecture.md` és a `strategy.md` alapján
  válaszold meg. Ha ezekből nem derül ki, válaszd a **legegyszerűbb, később könnyen
  visszafordítható** megoldást.
- Minden ilyen döntést írj be egy sorban a `docs/DECISIONS.md`-be:
  `dátum | kérdés | döntés | indok | felülvizsgálandó: igen/nem`.
- Nagyobb architekturális döntésnél írj ADR-t `Status: Accepted (agent) – review pending`
  státusszal, és folytasd a munkát.
- A terv (`docs/plans/<téma>.md`, legfeljebb kb. 40 sor) nem igényel jóváhagyást: megírod,
  és azonnal megvalósítod.

### 2. Csak itt állj meg
Ezekben az esetekben **ne csináld meg**:
- API-kulcs, `.env` vagy titok módosítása;
- fizetős szolgáltatás vagy csomagváltás;
- éles deploy, illetve Vercel- vagy Supabase-projekt beállítása;
- adatvesztő migráció vagy törlés;
- `git push --force`, history átírása;
- PRD 8. fejezet (nem-célok).

Ilyenkor írd be a `docs/BLOCKERS.md`-be (mi kell, miért, mit csinálnál), és
**folytasd a következő, nem blokkolt szelettel**.

### 3. Élő API
- Alapból mock- vagy fixture-adatból dolgozz.
- Élő API-Football-hívás fejlesztésre **naponta legfeljebb 20** fér bele.
- Minden élő hívást naplózz.
- A választ mentsd fixture-be, hogy ugyanazt soha ne kelljen újra lekérni.

### 4. Szelet-ciklus (egy szelet = egy commit)
1. Olvasd el a `docs/STATE.md`-t, és vedd a „Következő szeletek” lista első elemét.
2. Rövid terv kell, ha a szelet 3-nál több fájlt érint.
3. Valósítsd meg.
4. Ellenőrizd: `typecheck`, majd az **érintett** tesztek.
5. UI-változásnál: 1 screenshot (deviceScaleFactor 1).
6. Frissítsd a `docs/STATE.md`-t: kész lista, következő szeletek, polish backlog, max. 10 soros
   „jegyzet a következő sessionnek”.
7. `git commit` (conventional commit üzenet).

Szeletméret: legfeljebb kb. 10 fájl és egy jól körülhatárolt cél. Ha nagyobb, bontsd szét,
és a részeket írd be a STATE.md-be.

**Kész-definíció = működő alap.** Típusos, a tiszta mag tesztelt, a UI a tokenekre épül.
Finomhangolás nem kell: a hiányokat `TODO(polish)` komment és a STATE.md polish backlogja
jelölje, ne akadj el rajtuk.

### 5. Design
- A UI a `frontend/src/design/DESIGN.md` szerint készül (Floodlight). Új vagy módosított
  komponens előtt olvasd el az érintett fejezetet.
- Szín, térköz, betű, rádiusz csak tokenből: CSS-ben `var(--…)`, TS-ben `v('…')` a
  `design/tokens/tokens.ts`-ből. Nyers hex/px tilos a komponensekben.
- A `tokens.css` és `tokens.ts` generált fájl; a forrás a `tokens.json`.
- Kinézet-referencia: `design/components/components.html` és `components.css` (oe-* osztályok).
- Számformázás magyarul (tizedesvessző, ezres szóköz), közös `format.ts`-ből.
- UI-változás után screenshot 1440 és 390 px szélességen; vízszintes görgetés nem lehet.

### 6. Token-fegyelem
- **Ne olvasd be egészben** a PRD-t, a ROADMAP-ot vagy a design-fájlokat. A STATE.md-ből indulj,
  előbb `Grep`/`Glob`, és csak a releváns szakaszt olvasd be.
- Parancskimenet: `2>&1 | tail -n 40`. Tesztből csak a hibák kellenek, a teljes build-log nem.
- Egyszerre **1 subagent**. Legfeljebb 2 párhuzamosan, és csak független feladatra. A subagent
  legfeljebb 15 sorban válaszoljon.
- Ne írj hosszú összefoglalót. A commit üzenet és a STATE.md elég.
- Ha a kontextus megtelt, vagy egy szelet kész: írd meg a STATE.md-t úgy, hogy egy **friss
  session** (előzmények nélkül) onnan folytathassa.
