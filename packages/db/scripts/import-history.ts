// Történeti meccsek importja (S11): `data/history/api-football/fixtures-<liga>-<szezon>.json` (API-Football `/fixtures`
// válasz, a `fetch:history` mentette) → `.data/pglite`. 0 élő hívás. Idempotens (a 2. futás 0 írás).
// Futtatás: `npm run import:history -w @football/db [-- <dataDir>]`. A CSV-oddsok importja külön szelet (S11b).
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importLegacy, type LegacyFixturesFile } from '../src/import/legacy';
import { openMemoryRepository } from '../src/memory';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const DIR = join(ROOT, 'data', 'history', 'api-football');
const dataDir = process.argv[2] ?? join(ROOT, '.data', 'pglite');
mkdirSync(join(dataDir, '..'), { recursive: true });

const files = readdirSync(DIR)
	.filter((f) => /^fixtures-\d+-\d{4}\.json$/.test(f))
	.sort();
const fixtureFiles = files.map((f) => JSON.parse(readFileSync(join(DIR, f), 'utf8')) as LegacyFixturesFile);

const started = Date.now();
const { db, repo } = await openMemoryRepository(dataDir);
const report = await importLegacy(repo, { fixtureFiles, oddsFiles: [] });
const { rows } = await db.query<{ season: number; n: number; finished: number }>(
	`SELECT season, count(*)::int AS n, count(*) FILTER (WHERE status IN ('FT','AET','PEN'))::int AS finished
	 FROM fixture WHERE season BETWEEN 2022 AND 2024 GROUP BY season ORDER BY season`
);
await db.close();

console.log(`history import → ${dataDir} (${files.length} fájl, ${Date.now() - started} ms)`);
console.table({ leagues: report.leagues, seasons: report.seasons, teams: report.teams, fixtures: report.fixtures });
console.table(rows);
