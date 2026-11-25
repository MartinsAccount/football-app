# I8 – `results` job mock módban (ROADMAP 3.3b)

**Cél:** a planner `results` feladata (`ids` ≤ 20; 1. kör kezdés +3 h, 2. kör +26 h, ha még nem végleges – a core-ban kész) valódi
handlert kap: `/fixtures?ids=<a-b-c>` → `fixture` upsert (`NS` → `FT`, eredmény). 1 hívás/feladat → ≤ ⌈n/20⌉.

**Fájlok**

- `packages/server/src/results.ts` – `createResultsHandler(db)`: `ids` ellenőrzés (1–20 egész), rendezett `ids` (stabil
  mock-kulcs), `toFixtureRows` + `upsertTeams` + `upsertFixtureRows` (I7: státusz mindig a forrásból, null nem írja felül az
  eredményt). A válaszból hiányzó id nem hiba (a 2. kör / a 72 órás planner-ablak kezeli).
- `packages/server/src/referenceMocks.ts` – `fixturesByIdsEnvelope` + `withFixturesByIds(map, items)`: a statikus mock-térkép
  mellé `ids` szerinti feloldás a mentett meccsekből (Proxy; a köteg-összetétel előre nem ismert). > 20 id → API-szerű `errors`.
  `loadIngestMocks` ezt adja vissza.
- `ingestWorker.ts` (`results` bekötése), `index.ts` export.
- `results.test.ts` – friss memória-PGlite, a mentett 2023-as PL FT-meccsei `NS` sorként beszúrva: 25 meccs → 2 hívás, mind `FT`
  eredménnyel; 2. kör: az 1. körben még `NS` (felülírt mock), +26 h után `FT`, utána nincs több `results`.

**Nem cél:** statisztika/esemény (`fixture_team_stats`, `fixture_event`) – a mentett adatban nincs; élő hívás (💸).
