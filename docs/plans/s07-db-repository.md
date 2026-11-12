# S07 – packages/db repository

**Cél:** egy repository-interfész a `@football/db`-ben, amin keresztül az import (S08), a proxy (S10) és a backtest (S15)
írja/olvassa az adatot, és egy adapter, ami lokálisan, Supabase nélkül is fut.

## Döntés

- **Egy adapter, `SqlRepository`**, bármely `SqlExecutor` fölött (a `migrate()`-tel azonos szerződés). Lokálisan és a tesztekben
  PGlite memóriában (= „in-memory adapter”), később ugyanez `pg`-vel a Supabase-en. Külön kézi Map-alapú adapter nincs: kétszer
  kellene a CHECK/trigger-szabályokat megírni, és eltérnének. → DECISIONS.
- `openMemoryRepository()`: új PGlite + `migrate()` + repository – a tesztek és a scriptek belépési pontja.

## Interfész (`src/repository.ts`, típusok: `src/types.ts`)

- Törzsadat upsert: `upsertLeagues/Seasons/Teams/Bookmakers/Markets` → `UpsertResult { inserted, updated, unchanged }`.
  Változatlan sor nem íródik (`ON CONFLICT … DO UPDATE … WHERE … IS DISTINCT FROM`), így a 2. import-futás 0 írás.
- Meccs: `upsertFixtures`, `getFixture(id)`, `listFixtures({ leagueId, season, from, to, status })`.
- Odds: `insertOddsSnapshot(snapshot + quotes)` → `{ id, created }`; ugyanaz a `(fixture, captured_at, source)` kulcs második
  beszúrása no-op. Tranzakcióban (BEGIN/COMMIT az executoron). `getLatestOdds(fixtureId)`.
- Modell: `ensureModelVersion`, `createPredictionRun`, `appendPredictions` (csak INSERT; a DB-trigger tiltja a módosítást),
  `listPredictions({ fixtureId?, runId? })`, `upsertEvaluation`.
- `countRows(table)` az import-ellenőrzéshez (whitelistelt táblanevek).

## Tesztek (`src/repository.test.ts`)

- upsert idempotencia (2. futás: 0 inserted / 0 updated), módosult sor → updated;
- snapshot dupla beszúrás → `created: false`, a quote-ok száma nem nő; hibás quote → rollback (snapshot sem marad);
- prediction append, duplikátum → hiba, nincs update/delete API; evaluation upsert;
- `listFixtures` szűrők; numerikus mezők `number`-ként jönnek vissza.
