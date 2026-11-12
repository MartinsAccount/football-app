import { ApiFootballClient, fixtureKey } from './client';
import { createClientFromEnv } from './env';
import { ApiFootballError, classifyErrors } from './errors';
import { oddsPage, planError, statusOk } from './fixtures/envelopes';
import { MemoryBudgetStore, MemoryCallLogger } from './stores';
import type { ApiEnvelope, FetchLike } from './types';

/** Hamis óra + sleep: a sleep előre tekeri az órát, így a szerializálás mérhető valódi várakozás nélkül. */
function fakeClock(start = Date.UTC(2026, 10, 12, 10)) {
	let t = start;
	const sleeps: number[] = [];
	return {
		now: () => t,
		sleep: async (ms: number) => {
			sleeps.push(ms);
			t += ms;
		},
		advance: (ms: number) => (t += ms),
		sleeps
	};
}

/** Hamis fetch: URL (host nélkül) → burok; a hívások listája ellenőrizhető. */
function fakeFetch(routes: Record<string, ApiEnvelope | { status: number }>, clock?: { advance(ms: number): void }) {
	const calls: { url: string; headers: Record<string, string> }[] = [];
	const fetch: FetchLike = async (url, init) => {
		calls.push({ url, headers: init.headers });
		clock?.advance(100);
		const path = url.replace(/^https:\/\/[^/]+/, '');
		const r = routes[path];
		if (!r) throw new Error(`unexpected ${path}`);
		const status = 'status' in r && !('get' in r) ? r.status : 200;
		return {
			status,
			ok: status >= 200 && status < 300,
			headers: { get: (n: string) => (n === 'x-ratelimit-requests-remaining' ? '42' : null) },
			json: async () => r
		};
	};
	return { fetch, calls };
}

const live = (extra: Partial<ConstructorParameters<typeof ApiFootballClient>[0]> = {}) =>
	new ApiFootballClient({ mode: 'live', apiKey: 'test-key', ...extra });

describe('ApiFootballClient – budget guard', () => {
	it('never calls fetch when the daily budget is exhausted', async () => {
		const clock = fakeClock();
		const { fetch, calls } = fakeFetch({ '/leagues?id=39': oddsPage(1, 1, [1]) }, clock);
		const budget = new MemoryBudgetStore(2);
		const client = live({ fetch, budget, ...clock });

		await client.get('/leagues', { id: 39 });
		await client.get('/leagues', { id: 39 });
		await expect(client.get('/leagues', { id: 39 })).rejects.toMatchObject({ kind: 'budget' });
		expect(calls).toHaveLength(2);
		expect((await budget.usage('2026-11-12')).used).toBe(2);
	});

	it('respects a lower per-call cap and the reserve', async () => {
		const clock = fakeClock();
		const { fetch, calls } = fakeFetch({ '/leagues': oddsPage(1, 1, []) }, clock);
		const client = live({ fetch, budget: new MemoryBudgetStore(100, 98), ...clock });
		await client.get('/leagues', {}, { cap: 1 });
		await expect(client.get('/leagues', {}, { cap: 1 })).rejects.toMatchObject({ kind: 'budget' });
		await client.get('/leagues');
		await expect(client.get('/leagues')).rejects.toMatchObject({ kind: 'budget' });
		expect(calls).toHaveLength(2);
	});

	it('refuses a limit above 100', () => {
		expect(() => new MemoryBudgetStore(101)).toThrow(RangeError);
	});
});

describe('ApiFootballClient – errors', () => {
	it('treats HTTP 200 + errors.plan as a non-retryable failure and logs it', async () => {
		const clock = fakeClock();
		const { fetch } = fakeFetch({ '/fixtures?league=39&season=2026': planError }, clock);
		const logger = new MemoryCallLogger();
		const client = live({ fetch, logger, ...clock });

		const err = await client.get('/fixtures', { league: 39, season: 2026 }).catch((e) => e);
		expect(err).toBeInstanceOf(ApiFootballError);
		expect(err.kind).toBe('plan');
		expect(err.retryable).toBe(false);
		expect(err.message).toContain('try from 2022 to 2024');
		expect(logger.entries[0]).toMatchObject({ httpStatus: 200, results: 0, quotaRemainingDay: 42, mock: false });
		expect(logger.entries[0].errors).toEqual(planError.errors);
	});

	it('maps HTTP 5xx to a retryable error, 4xx to non-retryable', async () => {
		const clock = fakeClock();
		const { fetch } = fakeFetch({ '/a': { status: 503 }, '/b': { status: 403 } }, clock);
		const client = live({ fetch, ...clock });
		await expect(client.get('/a')).rejects.toMatchObject({ kind: 'http', retryable: true });
		await expect(client.get('/b')).rejects.toMatchObject({ kind: 'http', retryable: false });
	});

	it('classifies array and object errors', () => {
		expect(classifyErrors(['The Season field is required.'])).toEqual({ kind: 'api', message: 'The Season field is required.' });
		expect(classifyErrors({ requests: 'limit reached' }).kind).toBe('quota');
		expect(classifyErrors({ token: 'bad' }).kind).toBe('token');
	});
});

describe('ApiFootballClient – paging and serialization', () => {
	it('follows paging.total, one reservation per page, ≥ 7 s apart', async () => {
		const clock = fakeClock();
		const { fetch, calls } = fakeFetch(
			{
				'/odds?league=39&season=2024': oddsPage(1, 3, [1, 2]),
				'/odds?league=39&page=2&season=2024': oddsPage(2, 3, [3, 4]),
				'/odds?league=39&page=3&season=2024': oddsPage(3, 3, [5])
			},
			clock
		);
		const budget = new MemoryBudgetStore();
		const client = live({ fetch, budget, ...clock });

		const all = await client.getAllPages<{ fixture: { id: number } }>('/odds', { league: 39, season: 2024 });
		expect(all.response.map((r) => r.fixture.id)).toEqual([1, 2, 3, 4, 5]);
		expect(all).toMatchObject({ pages: 3, total: 3 });
		expect(calls).toHaveLength(3);
		expect(calls[0].headers).toEqual({ 'x-apisports-key': 'test-key' });
		expect((await budget.usage('2026-11-12')).used).toBe(3);
		expect(clock.sleeps).toEqual([6900, 6900]); // 7000 − a fetch 100 ms-a
	});

	it('stops at maxPages', async () => {
		const clock = fakeClock();
		const { fetch, calls } = fakeFetch({ '/odds': oddsPage(1, 5, [1]), '/odds?page=2': oddsPage(2, 5, [2]) }, clock);
		const all = await live({ fetch, ...clock }).getAllPages('/odds', {}, { maxPages: 2 });
		expect(all).toMatchObject({ pages: 2, total: 5 });
		expect(calls).toHaveLength(2);
	});

	it('serializes concurrent callers', async () => {
		const clock = fakeClock();
		const { fetch, calls } = fakeFetch({ '/a': oddsPage(1, 1, []), '/b': oddsPage(1, 1, []) }, clock);
		const client = live({ fetch, ...clock });
		await Promise.all([client.get('/a'), client.get('/b'), client.get('/a')]);
		expect(calls.map((c) => c.url.split('.io')[1])).toEqual(['/a', '/b', '/a']);
		expect(clock.sleeps).toHaveLength(2);
	});
});

describe('ApiFootballClient – status and mock mode', () => {
	it('/status does not consume budget and syncs the remaining quota', async () => {
		const clock = fakeClock();
		const { fetch } = fakeFetch({ '/status': statusOk(97) }, clock);
		const budget = new MemoryBudgetStore();
		const s = await live({ fetch, budget, ...clock }).status();
		expect(s).toEqual({ current: 97, limitDay: 100, remaining: 3 });
		expect(await budget.usage('2026-11-12')).toMatchObject({ used: 0, syncedRemaining: 3 });
	});

	it('mock mode answers from fixtures without fetch or budget', async () => {
		const budget = new MemoryBudgetStore(0);
		const logger = new MemoryCallLogger();
		const fixtures = { [fixtureKey('/odds', { season: 2024, league: 39 })]: oddsPage(1, 1, [7]) };
		const client = createClientFromEnv({}, { budget, logger, fixtures });
		expect(client.mode).toBe('mock');
		const env = await client.get('/odds', { league: 39, season: 2024 });
		expect(env.response).toEqual([{ fixture: { id: 7 } }]);
		expect(logger.entries[0].mock).toBe(true);
		await expect(client.get('/odds', { league: 1 })).rejects.toMatchObject({ kind: 'mock-missing' });
	});

	it('live mode requires a key; unknown mode is rejected', () => {
		expect(() => createClientFromEnv({ API_FOOTBALL_MODE: 'live' })).toThrow(/API_FOOTBALL_KEY/);
		expect(() => createClientFromEnv({ API_FOOTBALL_MODE: 'prod' })).toThrow(/mock\|live/);
	});
});
