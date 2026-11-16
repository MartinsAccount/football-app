import { ApiError, buildFixtureQuery, createApiClient, type FetchLike } from './index';

type Call = { url: string; headers: Record<string, string> };

function mockFetch(status: number, body: unknown, calls: Call[] = []): FetchLike {
	return async (url, init) => {
		calls.push({ url, headers: init.headers });
		const text = typeof body === 'string' ? body : JSON.stringify(body);
		return { ok: status >= 200 && status < 300, status, text: async () => text };
	};
}

describe('buildFixtureQuery', () => {
	it('uses the server parameter names and joins status with commas', () => {
		expect(buildFixtureQuery({ league: 39, season: 2024, status: ['FT', 'NS'], from: '2024-01-01', limit: 5, offset: 10 })).toBe(
			'?league=39&season=2024&status=FT%2CNS&from=2024-01-01&limit=5&offset=10'
		);
	});

	it('drops empty values', () => {
		expect(buildFixtureQuery()).toBe('');
		expect(buildFixtureQuery({ status: [], from: '' })).toBe('');
	});
});

describe('createApiClient', () => {
	it('builds URLs from baseUrl (trailing slash trimmed)', async () => {
		const calls: Call[] = [];
		const api = createApiClient({ baseUrl: 'https://x.test/', fetch: mockFetch(200, {}, calls) });
		await api.listFixtures({ league: 39 });
		await api.getOdds(100);
		await api.getFixture(100);
		await api.getOddsHistory(100);
		await api.getBudget();
		await api.getRecommendations();
		await api.getBacktest();
		await api.getArbitrage();
		await api.getEvaluation();
		await api.getEvaluation('elo@1 b');
		await api.listLeagues();
		expect(calls.map((c) => c.url)).toEqual([
			'https://x.test/api/fixtures?league=39',
			'https://x.test/api/odds/100',
			'https://x.test/api/fixtures/100',
			'https://x.test/api/odds/100/history',
			'https://x.test/api/budget',
			'https://x.test/api/recommendations',
			'https://x.test/api/backtest',
			'https://x.test/api/arbitrage',
			'https://x.test/api/evaluation',
			'https://x.test/api/evaluation?model=elo%401%20b',
			'https://x.test/api/leagues'
		]);
	});

	it('sends a Bearer token only when given', async () => {
		const calls: Call[] = [];
		await createApiClient({ baseUrl: '', token: 'secret', fetch: mockFetch(200, {}, calls) }).getBudget();
		await createApiClient({ baseUrl: '', fetch: mockFetch(200, {}, calls) }).getBudget();
		expect(calls[0].headers.authorization).toBe('Bearer secret');
		expect(calls[1].headers.authorization).toBeUndefined();
		expect(calls[1].headers.accept).toBe('application/json');
	});

	it('returns the parsed body', async () => {
		const body = { total: 0, limit: 200, offset: 0, fixtures: [] };
		expect(await createApiClient({ baseUrl: '', fetch: mockFetch(200, body) }).listFixtures()).toEqual(body);
	});

	it('throws a typed ApiError from the { error, message } body', async () => {
		const api = createApiClient({ baseUrl: '', fetch: mockFetch(404, { error: 'not-found', message: 'Nincs ilyen meccs: 9' }) });
		const err = await api.getOdds(9).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err).toMatchObject({ status: 404, error: 'not-found', message: 'Nincs ilyen meccs: 9' });
	});

	it('maps non-JSON errors, invalid bodies and network failures', async () => {
		const html = createApiClient({ baseUrl: '', fetch: mockFetch(502, '<html>Bad gateway</html>') });
		await expect(html.getBudget()).rejects.toMatchObject({ status: 502, error: 'http' });

		const bad = createApiClient({ baseUrl: '', fetch: mockFetch(200, 'not json') });
		await expect(bad.getBudget()).rejects.toMatchObject({ status: 200, error: 'invalid-response' });

		const down = createApiClient({
			baseUrl: '',
			fetch: async () => {
				throw new Error('ECONNREFUSED');
			}
		});
		await expect(down.getBudget()).rejects.toMatchObject({ status: 0, error: 'network', message: 'ECONNREFUSED' });
	});
});
