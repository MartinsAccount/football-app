// Lokális olvasó API (ROADMAP 1.5): `npm run dev -w @football/server [-- <dataDir>]`, alap port 5100 (env `API_PORT`).
// A DB a `.data/pglite` (az `npm run import:legacy -w @football/db` tölti fel). 0 külső hívás.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqlBudgetStore } from '@football/api-client';
import { openMemoryRepository } from '@football/db';
import { createApiHandler } from '../src/router';
import { toNodeListener } from '../src/node';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const dataDir = process.argv[2] ?? join(ROOT, '.data', 'pglite');
if (!existsSync(dataDir)) console.warn(`[api] ${dataDir} nem létezik – üres DB; futtasd: npm run import:legacy -w @football/db`);

const { db, repo } = await openMemoryRepository(dataDir);
const port = Number(process.env.API_PORT ?? 5100);
createServer(toNodeListener(createApiHandler({ repo, budget: new SqlBudgetStore(db) }))).listen(port, () =>
	console.log(`[api] http://localhost:${port}/api/{fixtures,odds/:fixtureId,budget} ← ${dataDir}`)
);
