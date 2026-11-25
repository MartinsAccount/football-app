# I1 – Ütemező váz lokálisan (ROADMAP 1.7, deploy nélkül)

Cél: a `/api/cron/tick` végpont és a tick-futtató, amely a Vercel-schedule nélkül is (lokálisan, kézzel vagy `--every` ciklussal)
fut. A Vercel-bekötés (`vercel.json` schedules, `CRON_SECRET` a hosting env-ben) BLOCKERS (1.6).

## Elemek

1. **DB `0006_cron_run.sql`** (csak új tábla): `cron_run` (`started_at`, `finished_at`, `status` running/ok/locked/error,
   `planned`, `executed`, `calls`, `error`, `duration_ms`). Ebből látszik a „~96 tick / 24 óra, nincs átfedés”.
2. **`@football/db` `SqlCronStore`**: `tryLock()`/`unlock()` = `pg_try_advisory_lock`/`pg_advisory_unlock` (fix kulcs),
   `startRun`, `finishRun`, `logLocked`, `listRuns(limit)`.
3. **`@football/server` `cron.ts`**:
   - `createTickRunner({ store, worker, now })`: folyamaton belüli őr + advisory lock → futás-sor → worker → lezárás → unlock
     (`finally`). Foglalt lock → `locked` sor, worker nem fut.
   - `noopWorker` (planner/worker a 3.1-ben jön).
   - `cronAuthorize(req, { secret, production })`: `Authorization: Bearer <CRON_SECRET>`, időzítés-biztos; titok nélkül dev
     nyitott, production 401 (ugyanaz a minta, mint az `auth.ts`).
   - `createCronHandler` → `GET|POST /api/cron/tick`; a router a `/api/cron/*`-ot az app-auth ELŐTT ide adja.
4. **Scriptek**: `dev.ts` beköti (env `CRON_SECRET`); `scripts/tick.ts`
   (`npm run tick -w @football/server [-- --pg] [--every <perc>]`) – a Schedules helyett lokálisan.

## Ellenőrzés

- db: PGlite-teszt (futás-sor életciklusa, lock vissza-adható).
- server: unit (titok, metódus, átfedés lassú workerrel → második `locked`, worker-hiba → `error` sor + unlock).
- `typecheck` + `vitest run` a db és server workspace-ben; prettier az érintett fájlokra.

## Nem része

Vercel-függvény (`api/cron/tick.ts`) és schedule (1.6 BLOCKERS); 202-es azonnali válasz külső pingerhez (TODO(polish));
planner/worker (3.1).
