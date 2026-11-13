import { SqlBudgetStore } from '@football/api-client';
import { ApiError, createApiClient, type ApiClient, type FetchLike } from '@football/contract';
import { openMemoryRepository } from '@football/db';
import { createApiHandler } from './router';

/** Szerződés-teszt: a `@football/contract` kliense a valódi handlert hívja (in-memory repo), hálózat nélkül. */
let api: ApiClient;
const seen: string[] = [];

beforeAll(async () => {
	const { db, repo } = await openMemoryRepository();
	await repo.upsertLeagues([{ id: 39, name: 'Premier League', country: 'England', type: 'league' }]);
	await repo.upsertSeasons([{ leagueId: 39, year: 2024, isCurrent: true }]);
	await repo.upsertTeams([
		{ id: 1, name: 'Home FC' },
		{ id: 2, name: 'Away FC' }
	]);
	await repo.upsertBookmakers([{ id: 8, name: 'Bet365', stored: true }]);
	await repo.upsertMarkets([{ id: 1, name: 'Match Winner', code: 'Vegeredmeny' }]);
	await repo.upsertFixtures([
		{ id: 100, leagueId: 39, season: 2024, kickoffAt: '2024-08-17T14:00:00Z', status: 'FT', homeTeamId: 1, awayTeamId: 2 },
		{ id: 101, leagueId: 39, season: 2024, kickoffAt: '2024-08-24T14:00:00Z', status: 'NS', homeTeamId: 2, awayTeamId: 1 }
	]);
	await repo.insertOddsSnapshot({
		fixtureId: 100,
		capturedAt: '2024-08-17T08:00:00Z',
		source: 'legacy-json',
		kind: 'legacy',
		quotes: [{ bookmakerId: 8, marketId: 1, selection: 'Home', odd: 2.1 }]
	});
	const handler = createApiHandler({ repo, budget: new SqlBudgetStore(db), now: () => new Date('2026-11-12T10:00:00Z') });
	const fetch: FetchLike = (url, init) => {
		seen.push(init.headers.authorization ?? '');
		return handler(new Request(url, init));
	};
	api = createApiClient({ baseUrl: 'http://localhost/', token: 't0k3n', fetch });
});

describe('contract ↔ server', () => {
	it('listFixtures sends the same query parameters parseFixtureQuery reads', async () => {
		const page = await api.listFixtures({ league: 39, season: 2024, status: ['FT', 'NS'], limit: 1, offset: 1 });
		expect(page).toMatchObject({ total: 2, limit: 1, offset: 1 });
		expect(page.fixtures.map((f) => f.id)).toEqual([101]);
		expect((await api.listFixtures({ status: ['NS'] })).fixtures[0].kickoffAt).toBe('2024-08-24T14:00:00Z');
	});

	it('getOdds returns the latest snapshot or null', async () => {
		const odds = await api.getOdds(100);
		expect(odds.fixtureId).toBe(100);
		expect(odds.snapshot?.quotes[0]).toMatchObject({ bookmakerId: 8, selection: 'Home', odd: 2.1 });
		expect((await api.getOdds(101)).snapshot).toBeNull();
	});

	it('getBudget returns the day usage', async () => {
		expect(await api.getBudget()).toMatchObject({ day: '2026-11-12', used: 0, remaining: expect.any(Number) });
	});

	it('server errors arrive as typed ApiError', async () => {
		await expect(api.getOdds(999)).rejects.toMatchObject({ status: 404, error: 'not-found' });
		const err = await api.listFixtures({ limit: 0 }).catch((e) => e);
		expect(err).toBeInstanceOf(ApiError);
		expect(err).toMatchObject({ status: 400, error: 'bad-request' });
	});

	it('sends the bearer token', () => {
		expect(seen.every((h) => h === 'Bearer t0k3n')).toBe(true);
	});
});
