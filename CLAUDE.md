# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A personal, single-user football (soccer) betting-analysis app that automates the owner's pre-match analysis. The app is being reshaped around its new **main feature: match analysis + bet recommendations**. For the owner's configured leagues it collects fixtures, standings, injuries and pre-match odds snapshots on a schedule. It estimates per-market probabilities (form, home/away, H2H, table position, motivation/stakes, injuries, season phase) against a market baseline and recommends value bets with an explanation. It logs every prediction with its model version and feature snapshot, and evaluates them automatically after each match (hit rate, ROI, Brier/calibration, CLV), so the strategy can improve over time. **Arbitrage detection** (best odd per outcome across bookmakers, `Σ 1/odd < 1`) remains as a separate, secondary module.

**Today vs. target:** today it is a localhost CRA + MobX v5 SPA that calls API-Football directly from the browser, caches in localStorage, and has a small Express backend that stores JSON files. The target is a hosted app on Vercel (Hobby, decided) with a Supabase Postgres database (decided). Behind it, a backend API proxy with a daily call budget (free tier: 100 calls/day) and scheduled ingestion jobs. The architecture sections below describe the **current** code. The target is in `docs/architecture.md`.

The repo is a two-package monorepo with **no root tooling** — `frontend/` and `backend/` are installed and run independently. Note: the code, comments, and many identifiers are in **Hungarian** (e.g. `Vegeredmeny` = Match Winner, `MindketCsapatGol` = Both Teams Score). Preserve this when editing.

## Start here (agentic workflow)

- **`docs/PRD.md`**: what the app is for. Covers the problem, the modules and their priorities (recommendation engine = core, arbitrage = secondary), what a recommendation must contain, success metrics, **non-goals**, and the open decisions (D1–D10). If a request falls under a non-goal, flag it instead of building it.
- **`docs/ROADMAP.md`**: ordered work slices in phases, each one committable and verifiable. Pick the next unchecked slice unless told otherwise, and tick it (`[x]` + commit hash) when done. 🔶 marks a decision point (the owner decides, ADR first). 💸 marks a slice that makes live API calls (ask first).
- **`docs/architecture.md`**: current → target architecture. Covers hosting, DB and auth proposals, the ingestion/scheduler design with quota accounting, the **data model**, the migration path from JSON/localStorage, and ADR candidates. Everything there is a *proposal* until an ADR accepts it.
- **`docs/api/api-football.md`**: the API-Football v3 reference for this app. Covers endpoints, params, pagination, update frequencies, error/quota behaviour, the **call budget**, and an audit of the current `ApiURLs.ts`. Read it before adding or changing any API call. Key caveats: the free plan may not cover the current season (verify, ROADMAP 0.0). Odds are kept only 7 days. `/odds` is paginated at 10 fixtures per page.
- **`docs/analysis/strategy.md`**: the prediction/recommendation methodology. Covers factors, baseline models (market, API `/predictions`, Elo, Poisson/Dixon–Coles), EV and staking rules, and the learning loop (logging, evaluation, backtesting, model lifecycle).
- **Work loop for non-trivial changes:** plan in `docs/plans/<topic>.md` → user approval → implement → verify (tests, typecheck, screenshot of the running app for UI) → ADR if a decision was made. ADRs live in `docs/fe/adr/` until ROADMAP 0.6 moves them to `docs/adr/`.
- **API budget & data (ADR `docs/fe/adr/0002-adatforras.md`):** free plan, **only seasons 2022–2024** are accessible (`CURRENT_SEASON = 2024`). Live calls are **allowed within the 100/day quota** to test fetching/saving — check `/status` (free, doesn't count) before and after a batch, and never run unbounded loops (full arbitrage run, all-league scans) without asking. UI and business-logic work uses saved data (fixtures/DB) by default. Never print the API keys. On Windows, `curl` needs `--ssl-no-revoke`.
- **Database:** Supabase Postgres (owner's choice, ADR-0004 pending formal write-up); keep SQL standard Postgres.
- **Docs language:** project docs (PRD, plans, ADRs) are Hungarian; commit messages are English.

## Commands

Run each package from its own directory.

```bash
# Backend (Express API, port 5000)
cd backend && npm install && npm start      # nodemon server.js

# Frontend (CRA + TypeScript, port 3000, proxies /api to :5000)
cd frontend && npm install && npm start     # react-scripts start
cd frontend && npm run build                # production build
cd frontend && npm test                     # react-scripts test (Jest) — run a single file: npm test -- App.test.tsx
```

There is no linter wired up and the backend `test` script is a placeholder. Both packages use Prettier (`.prettierrc`) with tabs.

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
3. `analyzeBookmaker(bookmakers, betType, expectGoals?)` — scans all bookmakers, keeps the highest odd per outcome, sums `1/odd`. Bet types are bucketed into **twoParams** (2 outcomes, e.g. Home/Away), **threeParams** (1X2 results), and **specialTwoParams** (Over/Under goal lines, parameterized by `expectGoals` 2.5/3.5). `arbitrage < 1` = profitable.
4. Results (`Arbitrages: IAnalyzedFixture[]`) feed `@computed` getters that power the UI's filtering/grouping (`getArbitragesByBetType`, `getArbitrageRanges`, `getBookmakers`, `getBetTypes`, `getInformations`) and the bet-type vs. original list views.

Bet-type enum (API string ↔ Hungarian name) is in `src/core/constants/BetTypes.ts`. `CALCULATE_ARBITRAGE` / `CALCULATE_GOAL_NUMBER_ARBITRAGE` arrays in the store select which bet types are analyzed.

### External API access & rate limits

- The football API is the **free API-Football tier: 100 requests/day** (limited season window, `CURRENT_SEASON = 2025`). The code still carries older per-minute throttling (~61s pause every 10 requests, `timeoutAllLeaguesId`) which does not protect the daily cap; `MainStore.fetchNumber` counts calls. See `docs/plans/api-optimization.md`. Planned: route all calls through the backend as proxy + cache + daily counter (ROADMAP §1).
- **API keys live in `frontend/.env`** (git-ignored; template `frontend/.env.example`): `REACT_APP_RAPIDAPI_KEY` for `FetchService`, `REACT_APP_APISPORTS_KEY` for `FetchService3`. Never write a key into source. CRA bakes env vars in at dev-server start, so restart `npm start` after changing `.env`; until the backend proxy (ROADMAP §1) takes over, the keys still ship in the browser bundle. The two services target different API hosts: `FetchService` → `api-football-v1.p.rapidapi.com` (RapidAPI), `FetchService3` → `v3.football.api-sports.io` (direct API-Sports). `ArbitrageStore` uses `MainStore.FetchService` (the former); `OddsService` uses `FetchService3`.- All API URLs are centralized in `src/services/ApiURLs.ts`. Season and bookmaker ids are in `src/core/constants/constants.ts` (`CURRENT_SEASON`, `UNIBET`).

### Caching

Computed arbitrage results and league ids are cached in **localStorage** via `src/shared/utils/LocalStorageUtil.ts` (TTL-based, keys prefixed `ls_`). `searchAllLeagueIds(_, dataFromCache=true)` short-circuits to the cached results to avoid re-fetching.

### Backend (`backend/`)

Minimal Express server. Single route group `/api/odds` (`backend/routes/odds.js`):
- `GET /api/odds` — returns the five committed per-country odds files (`stores/{england,france,germany,italy,spain}-odds.json`) merged into one response.
- `POST /api/odds?country=<x>` — appends new fixtures (deduped by `fixture.id`) into `stores/<country>-odds.json` on disk.

The `stores/*.json` files are the persisted dataset and are committed to the repo. No database.

## Conventions

- **Match the surrounding style**: tabs, Hungarian identifiers/comments, MobX v5 decorator patterns, class components. Large blocks of commented-out alternative implementations are intentional scratch history — don't assume they're dead code to delete unless asked.
- **Styling is Tailwind** (ADR `docs/fe/adr/0001-tailwind-as-styling-base.md`, tokens in `tailwind.config.js`, documented in `docs/fe/design-system.md`). Preflight is on; the legacy SCSS layer was removed. New UI uses Tailwind utilities with named tokens, no hardcoded hex.
