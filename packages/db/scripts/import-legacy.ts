// Régi JSON-ok importja a DB-be (ROADMAP 1.4). 0 élő hívás.
// Futtatás: `npm run import:legacy -w @football/db [-- <dataDir> | --pg]` (alap: `.data/pglite`, git-ignored PGlite-fájl;
// `--pg` vagy környezeti `DATABASE_URL` → Supabase, lásd `openTarget`).
// Idempotens: a 2. futás minden táblára 0 inserted/updated, az odds `existing`.
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importLegacy, type LegacyFixturesFile, type LegacyOddsFile } from '../src/import/legacy';
import { openTarget, parseTargetArgs } from '../src/target';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const readDir = <T>(dir: string, match: RegExp): T[] =>
	readdirSync(join(ROOT, dir))
		.filter((f) => match.test(f))
		.sort()
		.map((f) => JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8')) as T);

const args = parseTargetArgs(process.argv.slice(2));
const dataDir = args.dataDir ?? join(ROOT, '.data', 'pglite');
if (!args.pg) mkdirSync(join(dataDir, '..'), { recursive: true });
const fixtureFiles = readDir<LegacyFixturesFile>('frontend/src/data', /^allMatch.*_\d{4}\.json$/);
const oddsFiles = readDir<LegacyOddsFile>('backend/stores', /-odds\.json$/);

const started = Date.now();
const { db, repo, label } = await openTarget({ pg: args.pg, dataDir, envFile: join(ROOT, '.env') });
const report = await importLegacy(repo, { fixtureFiles, oddsFiles });
await db.close();

console.log(
	`legacy import → ${label} (${fixtureFiles.length} fixture- és ${oddsFiles.length} odds-fájl, ${Date.now() - started} ms)`
);
console.table({
	leagues: report.leagues,
	seasons: report.seasons,
	teams: report.teams,
	fixtures: report.fixtures,
	bookmakers: report.bookmakers,
	markets: report.markets
});
console.log('odds:', report.odds);
