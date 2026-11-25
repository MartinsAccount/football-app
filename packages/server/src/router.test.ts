import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { SqlBudgetStore } from '@football/api-client';
import type { EvaluationRecord } from '@football/core';
import { openMemoryRepository, type Fixture } from '@football/db';
import { createApiHandler, remainingCalls, type ApiHandler } from './router';
import { toNodeListener } from './node';

const FIXTURES: Fixture[] = [
	{ id: 100, leagueId: 39, season: 2024, kickoffAt: '2024-08-17T14:00:00Z', status: 'FT', homeTeamId: 1, awayTeamId: 2 },
	{ id: 101, leagueId: 39, season: 2024, kickoffAt: '2024-08-24T14:00:00Z', status: 'NS', homeTeamId: 2, awayTeamId: 1 },
	{ id: 102, leagueId: 39, season: 2023, kickoffAt: '2023-08-12T14:00:00Z', status: 'FT', homeTeamId: 1, awayTeamId: 2 }
];

let handler: ApiHandler;
let budget: SqlBudgetStore;

beforeAll(async () => {
	const { db, repo } = await openMemoryRepository();
	await repo.upsertLeagues([{ id: 39, name: 'Premier League', country: 'England', type: 'league' }]);
	await repo.upsertSeasons([
		{ leagueId: 39, year: 2023 },
		{ leagueId: 39, year: 2024, isCurrent: true }
	]);
	await repo.upsertTeams([
		{ id: 1, name: 'Home FC' },
		{ id: 2, name: 'Away FC' }
	]);
	await repo.upsertBookmakers([{ id: 8, name: 'Bet365', stored: true }]);
	await repo.upsertMarkets([{ id: 1, name: 'Match Winner', code: 'Vegeredmeny' }]);
	await repo.upsertFixtures(FIXTURES);
	await repo.insertOddsSnapshot({
		fixtureId: 100,
		capturedAt: '2024-08-17T08:00:00Z',
		source: 'legacy-json',
		kind: 'legacy',
		quotes: [{ bookmakerId: 8, marketId: 1, selection: 'Home', odd: 2.1 }]
	});
	budget = new SqlBudgetStore(db);
	handler = createApiHandler({ repo, budget, now: () => new Date('2026-11-12T10:00:00Z') });
});

const get = async (path: string, method = 'GET') => {
	const res = await handler(new Request(`http://localhost${path}`, { method }));
	return { status: res.status, body: (await res.json()) as any };
};

describe('/api/fixtures', () => {
	it('lists all fixtures ordered by kickoff', async () => {
		const { status, body } = await get('/api/fixtures');
		expect(status).toBe(200);
		expect(body.total).toBe(3);
		expect(body.fixtures.map((f: Fixture) => f.id)).toEqual([102, 100, 101]);
	});

	it('filters by league, season, status and date range', async () => {
		expect((await get('/api/fixtures?league=39&season=2024')).body.total).toBe(2);
		expect((await get('/api/fixtures?status=NS')).body.fixtures.map((f: Fixture) => f.id)).toEqual([101]);
		expect((await get('/api/fixtures?status=FT,NS&from=2024-01-01&to=2024-08-20')).body.total).toBe(1);
	});

	it('pages with limit/offset', async () => {
		const { body } = await get('/api/fixtures?limit=1&offset=1');
		expect(body).toMatchObject({ total: 3, limit: 1, offset: 1 });
		expect(body.fixtures.map((f: Fixture) => f.id)).toEqual([100]);
	});

	it('rejects bad params with 400', async () => {
		for (const q of ['league=abc', 'limit=0', 'limit=5000', 'from=nem-datum', 'season=99']) {
			expect((await get(`/api/fixtures?${q}`)).status).toBe(400);
		}
	});
});

describe('/api/odds/:fixtureId', () => {
	it('returns the latest snapshot', async () => {
		const { status, body } = await get('/api/odds/100');
		expect(status).toBe(200);
		expect(body.snapshot).toMatchObject({ fixtureId: 100, source: 'legacy-json' });
		expect(body.snapshot.quotes).toHaveLength(1);
	});

	it('returns null snapshot for a fixture without odds, 404 for unknown, 400 for non-numeric', async () => {
		expect((await get('/api/odds/101')).body).toEqual({ fixtureId: 101, snapshot: null });
		expect((await get('/api/odds/999')).status).toBe(404);
		expect((await get('/api/odds/abc')).status).toBe(400);
	});
});

describe('/api/budget', () => {
	it('reports the UTC day usage and remaining calls', async () => {
		expect((await get('/api/budget')).body).toMatchObject({ day: '2026-11-12', used: 0, limit: 100, remaining: 100 });
		await budget.reserve('2026-11-12');
		await budget.reserve('2026-11-12');
		expect((await get('/api/budget')).body).toMatchObject({ used: 2, remaining: 98 });
		await budget.sync('2026-11-12', 10);
		expect((await get('/api/budget')).body).toMatchObject({ syncedRemaining: 10, remaining: 10 });
	});

	it('remainingCalls never goes negative and respects the reserve', () => {
		expect(remainingCalls({ used: 95, limit: 100, reserve: 10, syncedRemaining: null })).toBe(0);
		expect(remainingCalls({ used: 50, limit: 100, reserve: 10, syncedRemaining: 80 })).toBe(40);
	});
});

describe('/api/evaluation', () => {
	const r = (modelVersion: string, brier: number): EvaluationRecord => ({
		runId: 1,
		fixtureId: 100,
		marketId: 1,
		selection: 'Home',
		line: null,
		modelVersion,
		isRecommendation: true,
		pModel: 0.5,
		odd: 2,
		outcome: 'win',
		brier,
		logLoss: 0.7,
		closingOdd: null
	});

	it('összesít, ?model= szűr; bekötés nélkül 404', async () => {
		const h = createApiHandler({ repo: {} as never, budget: {} as never, evaluations: async () => [r('v1', 0.2), r('v2', 0.4)] });
		const call = async (p: string) => (await h(new Request(`http://localhost${p}`))).json() as Promise<any>;
		const all = await call('/api/evaluation');
		expect(all.modelVersions).toEqual(['v1', 'v2']);
		expect(all.modelVersion).toBeNull();
		expect(all.bets.n).toBe(2);
		const v2 = await call('/api/evaluation?model=v2');
		expect([v2.records, v2.predictions.meanBrier]).toEqual([1, 0.4]);
		expect((await get('/api/evaluation')).status).toBe(404);
	});
});

describe('routing', () => {
	it('404 for unknown path, 405 for non-GET', async () => {
		expect((await get('/api/nope')).status).toBe(404);
		expect((await get('/api/fixtures', 'POST')).status).toBe(405);
	});

	it('serves over node:http via toNodeListener (integration)', async () => {
		const server: Server = createServer(toNodeListener(handler));
		await new Promise<void>((r) => server.listen(0, r));
		try {
			const { port } = server.address() as AddressInfo;
			const res = await fetch(`http://127.0.0.1:${port}/api/fixtures?season=2023`);
			expect(res.status).toBe(200);
			expect(res.headers.get('content-type')).toContain('application/json');
			expect(((await res.json()) as any).fixtures[0].id).toBe(102);
		} finally {
			server.close();
		}
	});
});
