import { SqlBudgetStore } from '@football/api-client';
import { SqlCronStore, SqlPlacedBetRepository, SqlRepository, SqlSettingsRepository, type SqlExecutor } from '@football/db';
import { loadArbitrageSnapshot } from './arbitrage';
import { authConfigFromEnv } from './auth';
import { loadBudgetDetails } from './budget';
import { createCronHandler, cronConfigFromEnv, type TickWorker } from './cron';
import { loadDrawWatch } from './draws';
import { loadEvaluationRecords } from './evaluation';
import { loadLeagueCatalog, loadLeagueTeams } from './leagues';
import { createQuizService } from './quiz';
import { createApiHandler, type ApiHandler } from './router';
import { createLoginHandler, createSessionAuthorizer, sessionConfigFromEnv, sessionEnabled } from './session';
import { fileSnapshotSource, withDbArbitrage } from './snapshots';

/**
 * Vercel-belépési pont (I30, ROADMAP 1.6a; docs/deploy/vercel.md). Az `api/index.ts` csak ezt hívja.
 *
 * - **Fail-closed:** a `production` jelző mindig `true` (a `NODE_ENV`-től függetlenül), így hash/titok nélkül minden
 *   `/api/*` és a tick is 401.
 * - **DB kérésenként, lustán:** az első lekérdezés nyitja, a válasz után zárjuk. A 401-es kérés nem nyit kapcsolatot.
 *   A Fluid Compute egy példányon párhuzamos kéréseket futtat; egy közös `pg.Client` mindet sorba fűzné, és egy
 *   befagyasztott példány elhalt kapcsolata is gond lenne. TODO(polish): kapcsolat-újrahasznosítás, ha a késleltetés zavar.
 * - **Web-login (I31):** `APP_PASSWORD_HASH` + `SESSION_SECRET` esetén a session-süti is engedélyez; a login-kezelő
 *   (és a hibás próbálkozások számlálója) példányonként egyszer jön létre.
 * - **Tick worker nélkül** (no-op): az éles ingestion a 3.7 💸 szelet. A `dev.ts` mock-workerét szándékosan NEM vesszük át,
 *   különben mock adat kerülne a Supabase-be.
 * - Az advisory lock session-szintű → `DATABASE_URL` = Supabase **Session pooler** (5432), nem a Transaction pooler.
 */

export type ClosableExecutor = SqlExecutor & { close(): Promise<void> };

export interface VercelHandlerDeps {
	env: Record<string, string | undefined>;
	/** Kapcsolat nyitása (Vercelen `openPg(DATABASE_URL)`, tesztben PGlite). */
	openDb: () => Promise<ClosableExecutor>;
	/** A mentett pillanatképek (`data/`) helye; a függvénybe a `vercel.json` `includeFiles`-a teszi. */
	dataDir: string;
	/** Csak teszthez: a tick munkája. Élesben no-op. */
	worker?: TickWorker;
	now?: () => Date;
}

/** Lusta executor: az első `exec`/`query` nyit kapcsolatot; a `close` csak a ténylegesen megnyitottat zárja. */
export function lazyExecutor(open: () => Promise<ClosableExecutor>): ClosableExecutor & { opened(): boolean } {
	let conn: Promise<ClosableExecutor> | null = null;
	const get = () => (conn ??= open());
	return {
		exec: async (sql) => (await get()).exec(sql),
		query: async <T>(sql: string, params?: unknown[]) => (await get()).query<T>(sql, params),
		close: async () => {
			if (!conn) return;
			const c = conn;
			conn = null;
			const opened = await c.catch(() => null); // sikertelen nyitásnál nincs mit zárni
			if (opened) await opened.close();
		},
		opened: () => conn !== null
	};
}

const dbUnavailable = (): Response =>
	new Response(JSON.stringify({ error: 'internal', message: 'Az adatbázis nem érhető el' }), {
		status: 503,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});

export function createVercelHandler(deps: VercelHandlerDeps): ApiHandler {
	const env = { ...deps.env, NODE_ENV: 'production' };
	const now = deps.now ?? (() => new Date());
	const session = sessionConfigFromEnv(env);
	const loginEnabled = sessionEnabled(session);
	const auth = { ...authConfigFromEnv(env), authorizers: loginEnabled ? [createSessionAuthorizer(session, now)] : [] };
	const login = createLoginHandler(session, { now });
	const cronConfig = cronConfigFromEnv(env);
	const files = fileSnapshotSource(deps.dataDir);

	return async (req) => {
		let connectFailed = false;
		// Async burok: a szinkron dobó nyitás (pl. hiányzó `DATABASE_URL`) is 503 legyen, ne 500.
		const db = lazyExecutor(async () => {
			try {
				return await deps.openDb();
			} catch (e) {
				connectFailed = true;
				throw e;
			}
		});
		try {
			const handler = createApiHandler({
				repo: new SqlRepository(db),
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
				login,
				loginEnabled,
				now,
				snapshots: withDbArbitrage(files, () => loadArbitrageSnapshot(db, { now: now() })),
				cron: createCronHandler({ store: new SqlCronStore(db), worker: deps.worker, config: cronConfig, now })
			});
			const res = await handler(req);
			// A kapcsolódási hibát a router 500-ként adja vissza; kifelé 503 + log (a cím nélkül).
			if (connectFailed) return dbUnavailable();
			return res;
		} catch (e) {
			console.error('[api]', e instanceof Error ? e.message : e);
			return connectFailed ? dbUnavailable() : new Response(null, { status: 500 });
		} finally {
			await db.close().catch((e) => console.error('[api] close', e instanceof Error ? e.message : e));
		}
	};
}
