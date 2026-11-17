// Lokális olvasó API (ROADMAP 1.5): `npm run dev -w @football/server [-- <dataDir> | --pg]`, alap port 5100 (env `API_PORT`).
// Alapból a `.data/pglite` (az `npm run import:legacy -w @football/db` tölti fel). `DATABASE_URL` env vagy `--pg` (a gyökér
// `.env`-ből) → valódi Postgres/Supabase (`openTarget`, idempotens migrate). 0 külső API-Football-hívás.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqlBudgetStore } from '@football/api-client';
import { openTarget, parseTargetArgs, SqlCronStore, SqlPlacedBetRepository, SqlSettingsRepository } from '@football/db';
import { createApiHandler } from '../src/router';
import { toNodeListener } from '../src/node';
import { authConfigFromEnv } from '../src/auth';
import { createCronHandler, cronConfigFromEnv } from '../src/cron';
import { createDbIngestWorker } from '../src/ingestWorker';
import { loadIngestMocks } from '../src/referenceMocks';
import { fileSnapshotSource, withDbArbitrage } from '../src/snapshots';
import { loadArbitrageSnapshot } from '../src/arbitrage';
import { loadEvaluationRecords } from '../src/evaluation';
import { createQuizService } from '../src/quiz';
import { loadDrawWatch } from '../src/draws';
import { loadLeagueCatalog, loadLeagueTeams } from '../src/leagues';
import { loadBudgetDetails } from '../src/budget';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const args = parseTargetArgs(process.argv.slice(2));
const dataDir = args.dataDir ?? join(ROOT, '.data', 'pglite');
if (!args.pg && !process.env.DATABASE_URL && !existsSync(dataDir))
	console.warn(`[api] ${dataDir} nem létezik – üres DB; futtasd: npm run import:legacy -w @football/db`);

const { db, repo, label } = await openTarget({ pg: args.pg, dataDir, envFile: join(ROOT, '.env') });
const port = Number(process.env.API_PORT ?? 5100);
// Védelem: `APP_API_TOKEN_HASH` env (token: `npm run token -w @football/server`); hiányában lokálisan nyitott.
const auth = authConfigFromEnv(process.env);
console.log(
	`[api] auth: ${
		auth.tokenHash
			? 'Bearer token kötelező'
			: auth.production
			? 'nincs hash → minden kérés 401'
			: 'nyitott (nincs APP_API_TOKEN_HASH)'
	}`
);
createServer(
	toNodeListener(
		createApiHandler({
			repo,
			budget: new SqlBudgetStore(db),
			settings: new SqlSettingsRepository(db),
			placedBets: new SqlPlacedBetRepository(db),
			quiz: createQuizService(db),
			draws: (q) => loadDrawWatch(db, q),
			evaluations: () => loadEvaluationRecords(db),
			leagues: () => loadLeagueCatalog(db),
			leagueTeams: (id) => loadLeagueTeams(db, id),
			budgetDetails: (day) => loadBudgetDetails(db, day),
			auth,
			// Arbitrázs (I22): a DB odds-snapshotjaiból, közelgő meccs hiányában a mentett JSON.
			snapshots: withDbArbitrage(fileSnapshotSource(join(ROOT, 'data')), () => loadArbitrageSnapshot(db, { now: new Date() })),
			// Ütemező (1.7): `CRON_SECRET` env; hiányában lokálisan nyitott. Lokális ütemezés: `npm run tick -- --every 15`.
			cron: createCronHandler({
				store: new SqlCronStore(db),
				worker: createDbIngestWorker(db, { fixtures: await loadIngestMocks(ROOT) }),
				config: cronConfigFromEnv(process.env)
			})
		})
	)
).listen(port, () =>
	console.log(
		`[api] http://localhost:${port}/api/{fixtures,odds/:fixtureId,budget,settings,leagues[/:id/teams],evaluation,bets,draws,recommendations,backtest,arbitrage,cron/tick} ← ${label}`
	)
);
