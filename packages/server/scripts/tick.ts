// Lokális ütemező (ROADMAP 1.7, a Vercel-schedule helyett): `npm run tick -w @football/server [-- <dataDir> | --pg]
// [--every <perc>]`. Egy tick (planner + worker; `reference` + `fixtures_window` + `results` + `standings` handler mock-adatból, ROADMAP 3.2–3.4) a `cron_run` naplóval és az advisory lockkal; `--every 15` → 15 percenként,
// Ctrl+C-ig. A végén kiírja a legutóbbi futásokat. 0 külső API-Football-hívás.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openTarget, parseTargetArgs, SqlCronStore } from '@football/db';
import { createTickRunner } from '../src/cron';
import { createDbIngestWorker } from '../src/ingestWorker';
import { loadIngestMocks } from '../src/referenceMocks';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const argv = process.argv.slice(2);
const everyIdx = argv.indexOf('--every');
const everyMin = everyIdx >= 0 ? Number(argv.splice(everyIdx, 2)[1]) : null;
if (everyMin !== null && !(everyMin > 0)) throw new Error('--every <perc>: pozitív szám kell');

const args = parseTargetArgs(argv);
const { db, label } = await openTarget({
	pg: args.pg,
	dataDir: args.dataDir ?? join(ROOT, '.data', 'pglite'),
	envFile: join(ROOT, '.env')
});
const store = new SqlCronStore(db);
const tick = createTickRunner({ store, worker: createDbIngestWorker(db, { fixtures: await loadIngestMocks(ROOT) }) });

const once = async () => console.log(`[tick] ${new Date().toISOString()}`, JSON.stringify(await tick()));

await once();
if (everyMin === null) {
	for (const r of await store.listRuns(5))
		console.log(`  #${r.id} ${r.startedAt} ${r.status} ${r.durationMs ?? '-'} ms planned=${r.planned} executed=${r.executed}`);
	console.log(`[tick] ← ${label}`);
	await db.close();
} else {
	console.log(`[tick] ${everyMin} percenként (Ctrl+C) ← ${label}`);
	setInterval(() => void once().catch((e) => console.error('[tick]', e)), everyMin * 60_000);
}
