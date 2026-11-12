import { ApiFootballError, classifyErrors, hasErrors } from './errors';
import { MemoryBudgetStore, MemoryCallLogger, utcDay } from './stores';
import type { ApiEnvelope, ApiParams, BudgetStore, CallLogger, ClientMode, FetchLike, MockFixtures } from './types';

export const DEFAULT_HOST = 'v3.football.api-sports.io';
/** Két élő hívás közti minimális szünet (≤ ~9/perc, docs/api/api-football.md §5). */
export const DEFAULT_MIN_INTERVAL_MS = 7000;

export interface ApiFootballClientOptions {
	mode: ClientMode;
	/** Csak élő módban kötelező; soha nem kerül naplóba. */
	apiKey?: string;
	host?: string;
	budget?: BudgetStore;
	logger?: CallLogger;
	fetch?: FetchLike;
	fixtures?: MockFixtures;
	minIntervalMs?: number;
	now?: () => number;
	sleep?: (ms: number) => Promise<void>;
}

export interface CallOptions {
	/** Alacsonyabb napi plafon (pl. backfill: 70). */
	cap?: number;
	taskId?: number | null;
}

/** A paraméterek normalizálása: `undefined` kimarad, kulcs szerint rendezve, minden érték string. */
export function normalizeParams(params: ApiParams = {}): Record<string, string> {
	return Object.fromEntries(
		Object.entries(params)
			.filter(([, v]) => v !== undefined)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([k, v]) => [k, String(v)])
	);
}

/** Mock-fixture kulcs: `/odds?league=39&page=2&season=2024` (rendezett paraméterek). */
export function fixtureKey(endpoint: string, params: ApiParams = {}): string {
	const qs = new URLSearchParams(normalizeParams(params)).toString();
	return qs ? `${endpoint}?${qs}` : endpoint;
}

const intHeader = (h: { get(n: string): string | null }, name: string): number | null => {
	const v = h.get(name);
	const n = v == null ? NaN : Number(v);
	return Number.isFinite(n) ? n : null;
};

/**
 * Az egyetlen API-Football kliens (csak szerveroldalon). Élő módban minden hívás: sorba áll (szerializált, ≥ minIntervalMs),
 * előtte atomikus budget-foglalás (nincs keret → `budget` hiba, nincs fetch), utána naplózás. Az `errors` nem üres → hiba.
 * Mock módban a válasz a fixture-térképből jön: nincs fetch, foglalás és várakozás.
 */
export class ApiFootballClient {
	readonly mode: ClientMode;
	readonly budget: BudgetStore;
	readonly logger: CallLogger;
	private readonly host: string;
	private readonly fetchImpl?: FetchLike;
	private readonly minIntervalMs: number;
	private readonly now: () => number;
	private readonly sleep: (ms: number) => Promise<void>;
	private queue: Promise<unknown> = Promise.resolve();
	private lastCallAt: number | null = null;

	constructor(private readonly opts: ApiFootballClientOptions) {
		this.mode = opts.mode;
		this.host = opts.host ?? DEFAULT_HOST;
		this.budget = opts.budget ?? new MemoryBudgetStore();
		this.logger = opts.logger ?? new MemoryCallLogger();
		this.minIntervalMs = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
		this.now = opts.now ?? Date.now;
		this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
		if (opts.mode === 'live') {
			if (!opts.apiKey) throw new Error('API_FOOTBALL_KEY is required in live mode');
			this.fetchImpl = opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
		}
	}

	/** Egy oldal lekérése. */
	get<T = unknown>(endpoint: string, params: ApiParams = {}, call: CallOptions = {}): Promise<ApiEnvelope<T>> {
		const run = () => (this.mode === 'mock' ? this.fromFixture<T>(endpoint, params, call) : this.live<T>(endpoint, params, call));
		const result = this.queue.then(run, run);
		this.queue = result.catch(() => undefined);
		return result;
	}

	/** Minden oldal a `paging.total` alapján (minden oldal külön hívás és külön foglalás). */
	async getAllPages<T = unknown>(
		endpoint: string,
		params: ApiParams = {},
		call: CallOptions & { maxPages?: number } = {}
	): Promise<{ response: T[]; pages: number; total: number }> {
		const maxPages = call.maxPages ?? 10;
		const first = await this.get<T>(endpoint, { ...params, page: undefined }, call);
		const total = Math.max(1, first.paging?.total ?? 1);
		const response = [...first.response];
		const last = Math.min(total, maxPages);
		for (let page = 2; page <= last; page++) {
			const next = await this.get<T>(endpoint, { ...params, page }, call);
			response.push(...next.response);
		}
		return { response, pages: last, total };
	}

	/** `/status`: nem fogy a kvótából; a maradékot a budget-tárba szinkronizálja. */
	async status(): Promise<{ current: number; limitDay: number; remaining: number }> {
		const env = await this.get<never>('/status', {}, { cap: undefined });
		const req = (env.response as unknown as { requests?: { current: number; limit_day: number } }).requests;
		if (!req) throw new ApiFootballError('api', 'unexpected /status payload', { endpoint: '/status' });
		const remaining = req.limit_day - req.current;
		await this.budget.sync(utcDay(new Date(this.now())), remaining);
		return { current: req.current, limitDay: req.limit_day, remaining };
	}

	private async fromFixture<T>(endpoint: string, params: ApiParams, call: CallOptions): Promise<ApiEnvelope<T>> {
		const key = fixtureKey(endpoint, params);
		const env = this.opts.fixtures?.[key] as ApiEnvelope<T> | undefined;
		if (!env) throw new ApiFootballError('mock-missing', `no mock fixture for ${key}`, { endpoint });
		await this.logger.log({
			endpoint,
			params: normalizeParams(params),
			httpStatus: 200,
			errors: hasErrors(env.errors) ? env.errors : null,
			results: env.results,
			pagingTotal: env.paging?.total ?? null,
			quotaRemainingDay: null,
			rateRemainingMin: null,
			durationMs: 0,
			taskId: call.taskId,
			mock: true
		});
		return this.check(env, endpoint, 200);
	}

	private async live<T>(endpoint: string, params: ApiParams, call: CallOptions): Promise<ApiEnvelope<T>> {
		const day = utcDay(new Date(this.now()));
		const isStatus = endpoint === '/status';
		if (!isStatus) {
			const used = await this.budget.reserve(day, call.cap);
			if (used == null) throw new ApiFootballError('budget', `daily API budget exhausted (${day})`, { endpoint });
		}
		if (this.lastCallAt != null) {
			const wait = this.lastCallAt + this.minIntervalMs - this.now();
			if (wait > 0) await this.sleep(wait);
		}
		const norm = normalizeParams(params);
		const qs = new URLSearchParams(norm).toString();
		const url = `https://${this.host}${endpoint}${qs ? `?${qs}` : ''}`;
		const started = this.now();
		this.lastCallAt = started;
		let status: number | null = null;
		let env: ApiEnvelope<T> | null = null;
		let headers: { get(n: string): string | null } = { get: () => null };
		try {
			const res = await this.fetchImpl!(url, { method: 'GET', headers: { 'x-apisports-key': this.opts.apiKey! } });
			status = res.status;
			headers = res.headers;
			env = res.ok ? ((await res.json()) as ApiEnvelope<T>) : null;
		} finally {
			await this.logger.log({
				endpoint,
				params: norm,
				httpStatus: status,
				errors: env && hasErrors(env.errors) ? env.errors : null,
				results: env?.results ?? null,
				pagingTotal: env?.paging?.total ?? null,
				quotaRemainingDay: intHeader(headers, 'x-ratelimit-requests-remaining'),
				rateRemainingMin: intHeader(headers, 'x-ratelimit-remaining'),
				durationMs: this.now() - started,
				taskId: call.taskId,
				mock: false
			});
		}
		if (!env) throw new ApiFootballError('http', `HTTP ${status} on ${endpoint}`, { endpoint, httpStatus: status ?? undefined });
		return this.check(env, endpoint, status ?? 200);
	}

	private check<T>(env: ApiEnvelope<T>, endpoint: string, httpStatus: number): ApiEnvelope<T> {
		if (hasErrors(env.errors)) {
			const { kind, message } = classifyErrors(env.errors);
			throw new ApiFootballError(kind, message, { endpoint, httpStatus, errors: env.errors });
		}
		return env;
	}
}
