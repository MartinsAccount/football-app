import type { CronRunResult, CronStore } from '@football/db';

/**
 * Ütemező váz (ROADMAP 1.7, architecture.md §7): `GET|POST /api/cron/tick`, `Authorization: Bearer <CRON_SECRET>`.
 * Egy tick: folyamaton belüli őr + Postgres advisory lock → `cron_run` sor → worker → lezárás → unlock.
 * A worker ma no-op; a planner + prioritásos worker a 3.1-ben jön. A Vercel-schedule bekötése az 1.6-tal (BLOCKERS);
 * lokálisan `npm run tick -w @football/server` futtatja.
 */

/** Egy tick munkája. A `deadline` a futás időkerete (architecture.md §7.1: 240 s). */
export type TickWorker = (ctx: { now: Date; deadline: Date }) => Promise<CronRunResult>;

export const noopWorker: TickWorker = async () => ({ planned: 0, executed: 0, calls: 0 });

/** Egy futás időkerete (a Vercel Hobby függvény-limit alatt marad). */
export const TICK_BUDGET_MS = 240_000;

export type TickOutcome =
	| ({ status: 'ok'; runId: number } & CronRunResult)
	| { status: 'locked'; runId: number }
	| { status: 'error'; runId: number; error: string };

export interface TickDeps {
	store: CronStore;
	worker?: TickWorker;
	now?: () => Date;
}

export interface CronConfig {
	/** A `CRON_SECRET`; hiányában csak nem-production környezetben nyitott. */
	secret?: string | null;
	production: boolean;
}

export function cronConfigFromEnv(env: Record<string, string | undefined>): CronConfig {
	return { secret: env.CRON_SECRET?.trim() || null, production: env.NODE_ENV === 'production' };
}

/** Időzítés-biztos összevetés (a hossz kiszivároghat, a tartalom nem). */
function secretsEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

export function cronAuthorize(req: Request, config: CronConfig): { ok: true } | { ok: false; message: string } {
	if (!config.secret) return config.production ? { ok: false, message: 'A szerveren nincs beállítva CRON_SECRET' } : { ok: true };
	const m = /^Bearer\s+(\S+)\s*$/i.exec(req.headers.get('authorization')?.trim() ?? '');
	if (!m) return { ok: false, message: 'Hiányzó Bearer token' };
	return secretsEqual(m[1], config.secret) ? { ok: true } : { ok: false, message: 'Érvénytelen token' };
}

/**
 * Tick-futtató. A session-szintű advisory lock egy kapcsolaton belül újra-belépő, ezért a hosszan futó dev-szerveren
 * (egy kapcsolat) a folyamaton belüli `inFlight` őr zárja ki az átfedést; külön folyamatok/függvénypéldányok közt a lock.
 */
export function createTickRunner(deps: TickDeps): () => Promise<TickOutcome> {
	const now = deps.now ?? (() => new Date());
	const worker = deps.worker ?? noopWorker;
	let inFlight = false;

	return async () => {
		if (inFlight) return { status: 'locked', runId: await deps.store.logLocked(now()) };
		inFlight = true;
		try {
			if (!(await deps.store.tryLock())) return { status: 'locked', runId: await deps.store.logLocked(now()) };
			try {
				const started = now();
				const runId = await deps.store.startRun(started);
				try {
					const result = await worker({ now: started, deadline: new Date(started.getTime() + TICK_BUDGET_MS) });
					await deps.store.finishRun(runId, now(), { status: 'ok', ...result });
					return { status: 'ok', runId, ...result };
				} catch (e) {
					const error = e instanceof Error ? e.message : String(e);
					await deps.store.finishRun(runId, now(), { status: 'error', error });
					return { status: 'error', runId, error };
				}
			} finally {
				await deps.store.unlock();
			}
		} finally {
			inFlight = false;
		}
	};
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
	});

/**
 * `/api/cron/*` kezelő. A Vercel-cron GET-et küld, a külső pinger POST-ot is küldhet: mindkettő elfogadott.
 * Válasz: 200 `{ status: 'ok'|'locked', runId, ... }`, worker-hibánál 500 `{ status: 'error', ... }`.
 * TODO(polish): külső pingerhez (30 s timeout) azonnali 202 + háttérfutás (architecture.md §5).
 */
export function createCronHandler(deps: TickDeps & { config: CronConfig }): (req: Request) => Promise<Response> {
	const tick = createTickRunner(deps);
	return async (req) => {
		const path = new URL(req.url).pathname.replace(/\/+$/, '');
		const auth = cronAuthorize(req, deps.config);
		if (!auth.ok) return json(401, { error: 'unauthorized', message: auth.message }, { 'www-authenticate': 'Bearer' });
		if (path !== '/api/cron/tick') return json(404, { error: 'not-found', message: `Ismeretlen végpont: ${path}` });
		if (req.method !== 'GET' && req.method !== 'POST')
			return json(405, { error: 'method', message: 'Csak GET vagy POST engedélyezett' });
		try {
			const outcome = await tick();
			return json(outcome.status === 'error' ? 500 : 200, outcome);
		} catch (e) {
			console.error('[cron]', e);
			return json(500, { error: 'internal', message: 'Szerverhiba' });
		}
	};
}
