import { utcDay, type BudgetStore } from '@football/api-client';
import { settlePlacedBet, summarizeEvaluations, type EvaluationRecord } from '@football/core';
import {
	PlacedBetRefError,
	type Fixture,
	type FixtureFilter,
	type PlacedBetRepository,
	type Repository,
	type SettingsRepository
} from '@football/db';
import { authorize, type AuthConfig } from './auth';
import type {
	ApiErrorBody,
	ApiErrorCode,
	BudgetResponse,
	EvaluationSummaryResponse,
	FixtureDto,
	FixtureResponse,
	FixturesResponse,
	LeagueDto,
	LeaguesResponse,
	LeagueTeamsResponse,
	OddsHistoryResponse,
	OddsResponse,
	PlacedBetDto,
	PlacedBetsResponse,
	SettingsResponse
} from '@football/contract';
import type { SnapshotSource } from './snapshots';
import { applySettingsUpdate, readSettings, SettingsValidationError } from './settings';
import { EMPTY_BUDGET_DETAILS, type BudgetDetails } from './budget';
import { parsePlacedBetInput, PlacedBetValidationError, readPlacedBets } from './placedBets';

/**
 * Az olvasó API (ROADMAP 1.5): keretrendszer-független Web `Request → Response` kezelő, így ugyanaz fut a lokális
 * Node-szerveren (`scripts/dev.ts`) és később Vercel-függvényként. 0 külső hívás: minden a DB-ből jön.
 * Az API-Football kulcs csak szerveroldali env-ben él; ez a réteg nem is látja.
 */
export interface ApiDeps {
	repo: Pick<Repository, 'listFixtures' | 'getFixture' | 'getLatestOdds' | 'listOdds' | 'listTeams'>;
	budget: Pick<BudgetStore, 'usage'>;
	now?: () => Date;
	/** Hozzáférés-védelem (ADR-0005). Hiányában nincs ellenőrzés – a belépési pontok `authConfigFromEnv`-vel adják át. */
	auth?: AuthConfig;
	/** Pillanatkép-végpontok forrása (`/api/recommendations|backtest|arbitrage`). Hiányában ezek 404-et adnak. */
	snapshots?: SnapshotSource;
	/** Ütemező (`/api/cron/*`, `createCronHandler`): saját `CRON_SECRET`-védelme van, az app-auth nem vonatkozik rá. */
	cron?: (req: Request) => Promise<Response>;
	/** Beállítás-API (`GET/PUT /api/settings`, I3). Hiányában a végpont 404-et ad. */
	settings?: SettingsRepository;
	/** Kiértékelő dashboard (`GET /api/evaluation?model=`, I17): a kiértékelt predikciók forrása. Hiányában 404. */
	evaluations?: () => Promise<EvaluationRecord[]>;
	/** Liga-katalógus (`GET /api/leagues`, I18b): `loadLeagueCatalog(db)`. Hiányában 404. */
	leagues?: () => Promise<LeagueDto[]>;
	/** Egy liga csapatai (`GET /api/leagues/:id/teams`, I18c): `loadLeagueTeams(db, id)`. Hiányában 404. */
	leagueTeams?: (leagueId: number) => Promise<LeagueTeamsResponse>;
	/** Budget-panel (`GET /api/budget`, I19): `loadBudgetDetails(db, day)`. Hiányában üres bontás. */
	budgetDetails?: (day: string) => Promise<BudgetDetails>;
	/** Fogadás-rögzítés (`GET/POST /api/bets`, I23): `SqlPlacedBetRepository`. Hiányában 404. A modell-oldal az `evaluations`-ből. */
	placedBets?: PlacedBetRepository;
}

export type ApiHandler = (req: Request) => Promise<Response>;

export const DEFAULT_LIMIT = 200;
export const MAX_LIMIT = 1000;

const json = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
	});

const fail = (status: number, error: ApiErrorCode, message: string, headers: Record<string, string> = {}) => {
	const res = json(status, { error, message } satisfies ApiErrorBody);
	for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
	return res;
};

class BadRequest extends Error {}

function intParam(q: URLSearchParams, name: string, opts: { min?: number; max?: number } = {}): number | undefined {
	const raw = q.get(name);
	if (raw === null || raw === '') return undefined;
	if (!/^-?\d+$/.test(raw)) throw new BadRequest(`'${name}' egész szám legyen`);
	const n = Number(raw);
	if ((opts.min !== undefined && n < opts.min) || (opts.max !== undefined && n > opts.max))
		throw new BadRequest(`'${name}' a [${opts.min ?? '-∞'}, ${opts.max ?? '∞'}] tartományon kívül esik`);
	return n;
}

function dateParam(q: URLSearchParams, name: string): string | undefined {
	const raw = q.get(name);
	if (raw === null || raw === '') return undefined;
	if (Number.isNaN(Date.parse(raw))) throw new BadRequest(`'${name}' nem értelmezhető dátum`);
	return raw;
}

/** `?league&season&status=FT,NS&from&to&limit&offset` → szűrt, kezdési idő szerint rendezett meccslista. */
export function parseFixtureQuery(q: URLSearchParams): { filter: FixtureFilter; limit: number; offset: number } {
	const status = q
		.get('status')
		?.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	const filter: FixtureFilter = {
		leagueId: intParam(q, 'league', { min: 1 }),
		season: intParam(q, 'season', { min: 1900, max: 2100 }),
		status: status?.length ? status : undefined,
		from: dateParam(q, 'from'),
		to: dateParam(q, 'to')
	};
	return {
		filter,
		limit: intParam(q, 'limit', { min: 1, max: MAX_LIMIT }) ?? DEFAULT_LIMIT,
		offset: intParam(q, 'offset', { min: 0 }) ?? 0
	};
}

/** Meccsek → DTO a csapatnevekkel (egy `listTeams` hívás a teljes lapra; ismeretlen csapat → `null`). */
async function withTeamNames(repo: Pick<Repository, 'listTeams'>, fixtures: Fixture[]): Promise<FixtureDto[]> {
	if (!fixtures.length) return [];
	const ids = [...new Set(fixtures.flatMap((f) => [f.homeTeamId, f.awayTeamId]))];
	const names = new Map((await repo.listTeams(ids)).map((t) => [t.id, t.name]));
	return fixtures.map((f) => ({
		...f,
		homeTeamName: names.get(f.homeTeamId) ?? null,
		awayTeamName: names.get(f.awayTeamId) ?? null
	}));
}

const fixtureIdParam = (raw: string): number => {
	if (!/^\d+$/.test(raw)) throw new BadRequest('a fixtureId pozitív egész szám legyen');
	return Number(raw);
};

/** Ma még elkölthető hívás: ugyanaz a szabály, mint az `api_budget_reserve()`-ben (limit − tartalék − used, és a `/status` szerinti maradék). */
export function remainingCalls(u: { used: number; limit: number; reserve: number; syncedRemaining: number | null }): number {
	const local = u.limit - u.reserve - u.used;
	return Math.max(0, u.syncedRemaining === null ? local : Math.min(local, u.syncedRemaining));
}

export function createApiHandler(deps: ApiDeps): ApiHandler {
	const now = deps.now ?? (() => new Date());

	return async (req) => {
		const url = new URL(req.url);
		const path = url.pathname.replace(/\/+$/, '');
		if (deps.cron && path.startsWith('/api/cron/')) return deps.cron(req);
		if (deps.auth) {
			const auth = await authorize(req, deps.auth);
			if (!auth.ok) return fail(401, 'unauthorized', auth.message, { 'www-authenticate': 'Bearer' });
		}
		const isSettings = path === '/api/settings';
		const isBets = path === '/api/bets';
		if (req.method !== 'GET' && !(isSettings && req.method === 'PUT') && !(isBets && req.method === 'POST'))
			return fail(
				405,
				'method',
				isSettings ? 'Csak GET vagy PUT engedélyezett' : isBets ? 'Csak GET vagy POST engedélyezett' : 'Csak GET engedélyezett'
			);
		const readJson = async (): Promise<unknown> => {
			try {
				return JSON.parse(await req.text());
			} catch {
				throw new BadRequest('A törzs nem érvényes JSON');
			}
		};
		try {
			if (isSettings) {
				if (!deps.settings) return fail(404, 'not-found', 'A beállítás-API nincs bekötve');
				if (req.method === 'GET') return json(200, (await readSettings(deps.settings)) satisfies SettingsResponse);
				return json(200, (await applySettingsUpdate(deps.settings, await readJson())) satisfies SettingsResponse);
			}

			if (isBets) {
				if (!deps.placedBets) return fail(404, 'not-found', 'A fogadás-rögzítés nincs bekötve');
				if (req.method === 'GET')
					return json(
						200,
						(await readPlacedBets(deps.placedBets, deps.evaluations ?? (async () => []))) satisfies PlacedBetsResponse
					);
				const created = await deps.placedBets.insert(parsePlacedBetInput(await readJson()));
				return json(201, settlePlacedBet(created) satisfies PlacedBetDto);
			}

			if (path === '/api/fixtures') {
				const { filter, limit, offset } = parseFixtureQuery(url.searchParams);
				// TODO(polish): LIMIT/OFFSET SQL-ben, ha a lista nagy lesz (most a repo a teljes szűrt listát adja).
				const all = await deps.repo.listFixtures(filter);
				return json(200, {
					total: all.length,
					limit,
					offset,
					fixtures: await withTeamNames(deps.repo, all.slice(offset, offset + limit))
				} satisfies FixturesResponse);
			}

			const one = /^\/api\/fixtures\/([^/]+)$/.exec(path);
			if (one) {
				const fixtureId = fixtureIdParam(one[1]);
				const fixture = await deps.repo.getFixture(fixtureId);
				if (!fixture) return fail(404, 'not-found', `Nincs ilyen meccs: ${fixtureId}`);
				const [dto] = await withTeamNames(deps.repo, [fixture]);
				return json(200, dto satisfies FixtureResponse);
			}

			const odds = /^\/api\/odds\/([^/]+)(\/history)?$/.exec(path);
			if (odds) {
				const fixtureId = fixtureIdParam(odds[1]);
				const fixture = await deps.repo.getFixture(fixtureId);
				if (!fixture) return fail(404, 'not-found', `Nincs ilyen meccs: ${fixtureId}`);
				if (odds[2])
					return json(200, { fixtureId, snapshots: await deps.repo.listOdds(fixtureId) } satisfies OddsHistoryResponse);
				return json(200, { fixtureId, snapshot: await deps.repo.getLatestOdds(fixtureId) } satisfies OddsResponse);
			}

			if (path === '/api/budget') {
				const day = utcDay(now());
				const u = await deps.budget.usage(day);
				const details = deps.budgetDetails ? await deps.budgetDetails(day) : EMPTY_BUDGET_DETAILS;
				return json(200, { day, ...u, remaining: remainingCalls(u), ...details } satisfies BudgetResponse);
			}

			if (path === '/api/evaluation') {
				if (!deps.evaluations) return fail(404, 'not-found', 'A kiértékelő API nincs bekötve');
				// TODO(polish): SQL-aggregálás, ha sok a sor (most a teljes lista a core-ban összesül).
				const modelVersion = url.searchParams.get('model')?.trim() || null;
				return json(200, summarizeEvaluations(await deps.evaluations(), { modelVersion }) satisfies EvaluationSummaryResponse);
			}

			if (path === '/api/leagues') {
				if (!deps.leagues) return fail(404, 'not-found', 'A liga-katalógus nincs bekötve');
				return json(200, { leagues: await deps.leagues() } satisfies LeaguesResponse);
			}

			const leagueTeams = /^\/api\/leagues\/([^/]+)\/teams$/.exec(path);
			if (leagueTeams) {
				if (!deps.leagueTeams) return fail(404, 'not-found', 'A csapatlista nincs bekötve');
				if (!/^\d+$/.test(leagueTeams[1]) || Number(leagueTeams[1]) < 1)
					throw new BadRequest('a liga-id pozitív egész szám legyen');
				return json(200, (await deps.leagueTeams(Number(leagueTeams[1]))) satisfies LeagueTeamsResponse);
			}

			const snapshot = /^\/api\/(recommendations|backtest|arbitrage)$/.exec(path);
			if (snapshot) {
				const kind = snapshot[1] as keyof SnapshotSource;
				const body = deps.snapshots ? await deps.snapshots[kind]() : null;
				if (body === null) return fail(404, 'not-found', `Még nincs pillanatkép: ${kind}`);
				return json(200, body);
			}

			return fail(404, 'not-found', `Ismeretlen végpont: ${path}`);
		} catch (e) {
			if (
				e instanceof BadRequest ||
				e instanceof SettingsValidationError ||
				e instanceof PlacedBetValidationError ||
				e instanceof PlacedBetRefError
			)
				return fail(400, 'bad-request', e.message);
			console.error('[api]', e);
			return fail(500, 'internal', 'Szerverhiba');
		}
	};
}
