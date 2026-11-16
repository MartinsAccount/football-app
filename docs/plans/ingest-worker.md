# I5 – 3.1b Worker a tickben (terv)

Cél: a core planner + sor-szabályok (`packages/core/src/ingest/`) DB-tárral a tick workerébe kötve; 0 élő hívás.

## Fájlok

1. `packages/db/src/ingestTasks.ts` – `SqlTaskStore`: `enqueue` (`ON CONFLICT (dedupe_key) DO NOTHING`, beszúrt db),
   `skipExpired`, `resetStale` (beragadt `running` → `pending`), `listRunnable`, `claim` (feltételes UPDATE), `complete`, `fail`
   (a core `onTaskFailure` eredményével), `list`; `loadPlannerInput(db, now)` (követett ligák + ablakbeli meccsek).
2. `packages/db/src/ingestTasks.test.ts` – PGlite.
3. `packages/server/src/ingestWorker.ts` – `createIngestWorker(deps): TickWorker`: lejárt → skipped, stale-reset, planner →
   enqueue, majd ciklus: `selectNextTask(maradék keret)` → claim → handler → complete/fail. Handlerek: alapból no-op (0 hívás),
   kindonként felülírhatók; `toFailureKind` az api-client `ApiErrorKind` → core `TaskFailureKind`.
4. `packages/server/src/ingestWorker.test.ts` – integráció: két tick nem duplikál; a budget-plafont tartja; hibaleképezés.
5. Bekötés: `index.ts` exportok, `scripts/tick.ts`, `scripts/dev.ts` (mock kliens, üres fixture-térkép).

## Döntések (DECISIONS.md)

- `est_calls` a `params` jsonb `_estCalls` kulcsában (nincs migráció).
- Szezon a liga-tervhez: `season.is_current` → legnagyobb meccs-szezon → 2024 (ADR-0002).
- Hibaleképezés: budget→budget, quota→quota, plan→plan, token→token, http 429/5xx→transient, egyéb http/api/mock-missing
  →permanent, nem-API hiba→transient.
