# I7 – `fixtures_window` job mock módban (ROADMAP 3.3a)

**Cél:** a planner napi `fixtures_window` feladata (`league`, `season`, `from` = mai UTC-nap, `to` = +7 nap) valódi handlert kap a
`createIngestWorker` `handlers` térképén, és a `fixture` táblába upsertel – 0 élő hívással.

**Fájlok**

- `packages/server/src/fixturesWindow.ts` – `toFixtureRows` (API `/fixtures` elem → `fixture` sor + csapat), `upsertFixtureRows`
  (kezdés/státusz/csapatok mindig a forrásból; eredmény, forduló, játékvezető, helyszín: a null nem írja felül), handler: hiányzó
  `team` + `season_team` (I6 upsertjei), majd `fixture`.
- `packages/server/src/referenceMocks.ts` – `replayDay` (a kért nap a mentett szezonba vetítve), `fixturesWindowEnvelope`,
  `buildFixturesWindowMocks(fixtures, days)`, `loadIngestMocks(root, now)` = reference + ablak-mockok (now −1 … +30 nap).
- `ingestWorker.ts` (`createDbIngestWorker` alapból köti), `index.ts` export, `scripts/tick.ts` + `dev.ts` → `loadIngestMocks`.
- `fixturesWindow.test.ts` – friss memória-PGlite: beszúrás, hiányzó csapat, meglévő eredmény/játékvezető megmarad, 0 hívás.

**Visszajátszás:** a free tier csak 2022–2024 (ADR-0002); a 2026-os ablak a mentett szezon azonos naptári napjaira vetül, a
meccsek az eredeti (2024-es) dátumukkal kerülnek a DB-be – adatot nem találunk ki.

**Nem cél:** `results` / `NS` → `FT` (I8), élő hívás (💸), törlés, a helyi `.data/pglite` újranyitása.
