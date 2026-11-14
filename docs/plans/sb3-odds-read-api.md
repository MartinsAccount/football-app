# SB3 – /odds → olvasó API (ROADMAP 1.8)

Cél: a régi Odds-statisztika (esélyes nyert / döntetlen / odds-sávok) ne a legacy Express `GET /api/odds`-ból és a
`data/allMatch*_2021.json`-ből, hanem az olvasó API-ból (`@football/contract` `createApiClient`) töltsön; külső API-Football-hívás
a frontendből az /odds oldalon ne maradjon.

## Lépések

1. `frontend/src/services/readApi.ts` – egy `createApiClient({ baseUrl: '' })` példány (azonos origin, Vite-proxy).
2. `vite.config.ts` proxy: `^/api/(fixtures|odds/|budget)` → :5100 (`@football/server`), a többi `/api` → :5000 (legacy,
   arbitrázs).
3. `OddsPage/services/oddsMatch.ts` (tiszta, tesztelt): `FixtureDto` + `OddsSnapshotDto` → `OddsMatch` (gólok + 1X2 odds, market
   1, Home/Draw/Away, az első teljes fogadóiroda).
4. `OddsService`: ligánként `listFixtures({ league, season: 2021, status: ['FT'] })` + `getOdds` korlátozott párhuzamossággal.
5. `OddsStore`: `Matches` az `Odds`/`Fixtures` helyett; `saveOdds` (külső hívás) és a mentés-gomb kikerül; az `Init` lusta (az
   OddsPage mountjakor), nem az app indulásakor.

A `FixturePage`/`ArbitragePage` FetchService-útja marad (8. fázis). TODO(polish): tömeges odds-végpont a fixture-enkénti `getOdds`
helyett.
