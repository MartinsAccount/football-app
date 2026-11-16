import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqlBudgetStore } from '@football/api-client';
import { reviveArbitrageSnapshot } from '@football/core';
import { ApiError, createApiClient, type ApiClient, type FetchLike } from '@football/contract';
import { openMemoryRepository } from '@football/db';
import { hashToken } from './auth';
import { createApiHandler, type ApiHandler } from './router';
import { fileSnapshotSource, SNAPSHOT_FILES, type SnapshotSource } from './snapshots';

/** Szerződés-teszt: a `@football/contract` kliense a valódi handlert hívja (in-memory repo), hálózat nélkül. */
let api: ApiClient;
let handler: ApiHandler;
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
	// Production-szerű védelem: csak a 't0k3n' Bearer token hash-e van beállítva.
	handler = createApiHandler({
		repo,
		budget: new SqlBudgetStore(db),
		now: () => new Date('2026-11-12T10:00:00Z'),
		auth: { tokenHash: await hashToken('t0k3n'), production: true }
	});
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

	it('listFixtures and getFixture carry the team names', async () => {
		const [f] = (await api.listFixtures({ limit: 1 })).fixtures;
		expect(f).toMatchObject({ id: 100, homeTeamName: 'Home FC', awayTeamName: 'Away FC' });
		expect(await api.getFixture(101)).toMatchObject({ id: 101, homeTeamName: 'Away FC', awayTeamName: 'Home FC' });
		await expect(api.getFixture(999)).rejects.toMatchObject({ status: 404, error: 'not-found' });
	});

	it('getOddsHistory returns every snapshot in capture order', async () => {
		const history = await api.getOddsHistory(100);
		expect(history.fixtureId).toBe(100);
		expect(history.snapshots.map((s) => s.capturedAt)).toEqual(['2024-08-17T08:00:00Z']);
		expect(history.snapshots[0].quotes[0]).toMatchObject({ bookmakerId: 8, odd: 2.1 });
		expect((await api.getOddsHistory(101)).snapshots).toEqual([]);
		await expect(api.getOddsHistory(999)).rejects.toMatchObject({ status: 404, error: 'not-found' });
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

	it('without or with a wrong token → 401 unauthorized + WWW-Authenticate', async () => {
		const fetch: FetchLike = (url, init) => handler(new Request(url, init));
		for (const token of [undefined, 'rossz']) {
			const client = createApiClient({ baseUrl: 'http://localhost', token, fetch });
			await expect(client.getBudget()).rejects.toMatchObject({ status: 401, error: 'unauthorized' });
		}
		const res = await handler(new Request('http://localhost/api/budget'));
		expect(res.headers.get('www-authenticate')).toBe('Bearer');
	});
});

describe('snapshot endpoints (SB4)', () => {
	const dataDir = fileURLToPath(new URL('../../../data/', import.meta.url));
	const clientFor = async (snapshots?: SnapshotSource) => {
		const { db, repo } = await openMemoryRepository();
		const h = createApiHandler({ repo, budget: new SqlBudgetStore(db), snapshots });
		return createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => h(new Request(url, init)) });
	};

	it('serve the saved JSON snapshots unchanged', async () => {
		const api = await clientFor(fileSnapshotSource(dataDir));
		for (const [get, file] of [
			[() => api.getRecommendations(), SNAPSHOT_FILES.recommendations],
			[() => api.getBacktest(), SNAPSHOT_FILES.backtest],
			[() => api.getArbitrage(), SNAPSHOT_FILES.arbitrage]
		] as const)
			expect(await get()).toEqual(JSON.parse(readFileSync(join(dataDir, file), 'utf8')));
	});

	it('arbitrage wire form revives to Infinity for incomplete markets', async () => {
		const api = await clientFor(fileSnapshotSource(dataDir));
		const wire = await api.getArbitrage();
		const hasNull = wire.fixtures.some((f) => f.opportunities.some((o) => o.sum === null));
		const revived = reviveArbitrageSnapshot(wire);
		expect(revived.fixtures.flatMap((f) => f.opportunities).every((o) => typeof o.sum === 'number')).toBe(true);
		if (hasNull) expect(revived.fixtures.some((f) => f.opportunities.some((o) => o.sum === Infinity))).toBe(true);
	});

	it('missing snapshot or no source → 404 not-found', async () => {
		const empty = await clientFor(fileSnapshotSource(join(dataDir, '__nincs__')));
		await expect(empty.getBacktest()).rejects.toMatchObject({ status: 404, error: 'not-found' });
		const none = await clientFor();
		await expect(none.getRecommendations()).rejects.toMatchObject({ status: 404, error: 'not-found' });
	});
});
