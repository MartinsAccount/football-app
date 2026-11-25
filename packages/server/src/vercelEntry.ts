// Vercel-függvény belépési pontja (I30, docs/deploy/vercel.md). A `scripts/vercel-build.mjs` esbuild-del egy fájlba
// csomagolja (`.vercel/output/functions/api.func/index.mjs`); a pillanatkép-JSON-ok a csomag mellé, `data/` alá kerülnek.
// Node-stílusú `(req, res)` export: a Build Output API `launcherType: "Nodejs"` ezt dokumentálja.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPg, readDatabaseUrl } from '@football/db';
import { toNodeListener } from './node';
import { createVercelHandler } from './vercel';

const here = dirname(fileURLToPath(import.meta.url));

export default toNodeListener(
	createVercelHandler({
		env: process.env,
		openDb: () => openPg(readDatabaseUrl()),
		dataDir: join(here, 'data')
	})
);
