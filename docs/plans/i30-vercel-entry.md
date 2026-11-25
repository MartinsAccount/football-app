# I30 – 1.6a Vercel-belépési pont

Cél: az `autodev` preview-deployja egy lépésben induljon (a runbook B2), a kockázatokat helyben amennyire lehet, igazoljuk.

## Döntések (DECISIONS 2026-11-25)

- **Build Output API v3 + saját esbuild-csomag** a zero-config `api/*.ts` helyett. A workspace-csomagok TS-forrásként mennek,
  kiterjesztés nélküli ESM-importokkal; azt a `@vercel/node` nem garantáltan futtatja, a `vercel build` pedig Windows-on
  (symlink-jog) nem fut le. A saját csomag sima `node` alatt helyben füsttesztelhető.
- **Kérésenkénti, lusta DB-kapcsolat** (`lazyExecutor`): a 401 nem nyit kapcsolatot; Fluid-párhuzamosság mellett nincs közös,
  sorba fűzött `pg.Client`.
- **Fail-closed:** a Vercel-handler a `NODE_ENV`-től függetlenül `production`.
- **Tick worker nélkül** (no-op); élő ingestion = 3.7 💸.
- **Session pooler (5432)**: a tick advisory lockja session-szintű; a Transaction pooler más backendre vihetné az unlockot.
- **Schedule path targettel** (`/api/cron/tick`, `CRON_SECRET`), a `config.json`-ban; a function target + `@vercel/schedules`
  később (polish), a külső pinger-tartalék ugyanazt az utat használja.

## Fájlok

- `packages/server/src/vercel.ts` (+ teszt): `createVercelHandler`, `lazyExecutor`.
- `packages/server/src/vercelEntry.ts`: `openPg(DATABASE_URL)` + `toNodeListener` → a bundle belépési pontja.
- `scripts/vercel-build.mjs`: `.vercel/output` (static, `functions/api.func`, `config.json`); `--serve` füstteszt.
- `vercel.json`: csak `buildCommand`. `packages/db/src/pg.ts`: `client.on('error')`.

## Ellenőrzés

`npm run verify`; `npm run build && node scripts/vercel-build.mjs`; `--serve` mellett: token nélkül 401, elérhetetlen DB → 503,
a `pg` a csomagban eléri a poolert. Ami csak a preview-n dől el: runbook C.
