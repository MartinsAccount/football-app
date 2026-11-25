# Terv: fixture-mód (ROADMAP 0.5, STATE S01)

## Cél

Fejlesztés és tesztek közben **0 élő API-Football-hívás**. Egy kapcsoló: `VITE_DATA_MODE=fixture|live`, alapértelmezés `fixture`
(ha a változó hiányzik, nem megy élő hívás).

## Megoldás

- `frontend/src/services/dataMode.ts`: `getDataMode()` / `isFixtureMode()` az `import.meta.env`-ből.
- `frontend/src/services/fixtures/fixtureResolver.ts`: URL → mentett API-válasz
  (`{ get, parameters, errors, results, paging, response }` alak), a JSON-okat lustán (`import()`) tölti, így nem kerülnek a fő
  bundle-be.
  - `/fixtures?season&league` → `frontend/src/data/allMatch<Liga>_<szezon>.json` (2020/2021; más szezonnál a 2021-es);
  - `/fixtures?id`, `?date`, `?round` → szűrés a mentett meccsekből; `/fixtures/rounds` → az utolsó forduló;
  - `/leagues` → `test.json`; `/odds/mapping` → `test2.json` 1 oldalra vágva (a lapozó ciklus ne fusson tovább);
  - `/odds?league|fixture` → `backend/stores/<ország>-odds.json`; `/odds/bookmakers` → az odds-fájlokból;
  - minden más → üres válasz + `console.warn`.
- `FetchService` és `FetchService3` `get()`: fixture módban a resolverből válaszol, **nem** hívja a `fetch`-et és **nem** növeli a
  `MainStore.fetchNumber`-t. A backend `post()` (saját Express) változatlan.

## Ellenőrzés

- `fixtureMode.test.ts`: fetch-spy 0 hívás, `fetchNumber` 0 marad; a resolver a fő végpontokra nem üres választ ad.
- `npm run verify` zöld.
