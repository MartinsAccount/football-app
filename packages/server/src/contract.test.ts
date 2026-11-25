import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqlBudgetStore } from '@football/api-client';
import { reviveArbitrageSnapshot } from '@football/core';
import { ApiError, createApiClient, type ApiClient, type FetchLike, type SettingsUpdate } from '@football/contract';
import { openMemoryRepository, SqlSettingsRepository } from '@football/db';
import { hashToken } from './auth';
import { createApiHandler, type ApiHandler } from './router';
import { DEFAULT_SETTING_VALUES, settingValuesFrom } from './settings';
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

describe('settings API (I3)', () => {
	let client: ApiClient;
	let h: ApiHandler;
	beforeAll(async () => {
		const { db, repo } = await openMemoryRepository();
		await repo.upsertLeagues([
			{ id: 39, name: 'Premier League', country: 'England', type: 'league' },
			{ id: 140, name: 'La Liga', country: 'Spain', type: 'league' },
			{ id: 61, name: 'Ligue 1', country: 'France', type: 'league' }
		]);
		await repo.upsertTeams([{ id: 33, name: 'Manchester United' }]);
		await repo.upsertBookmakers([
			{ id: 8, name: 'Bet365', stored: true },
			{ id: 4, name: 'Pinnacle', stored: false }
		]);
		await repo.upsertMarkets([
			{ id: 1, name: 'Match Winner', code: 'Vegeredmeny' },
			{ id: 5, name: 'Goals Over/Under' }
		]);
		h = createApiHandler({ repo, budget: new SqlBudgetStore(db), settings: new SqlSettingsRepository(db) });
		client = createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => h(new Request(url, init)) });
	});

	it('GET returns the migration-seeded values, defaults for the rest', async () => {
		const s = await client.getSettings();
		expect(s.values).toEqual({
			...DEFAULT_SETTING_VALUES,
			evThreshold: 0.05,
			minOdds: 1.3,
			maxOdds: 5,
			retention: 'opening-closing'
		});
		expect(s.followedLeagues).toEqual([]);
		expect(s.bookmakers.map((b) => [b.id, b.stored])).toEqual([
			[4, false],
			[8, true]
		]);
		expect(s.markets.find((m) => m.id === 1)).toMatchObject({ code: 'Vegeredmeny' });
	});

	it('PUT applies a partial update and returns the new state', async () => {
		const s = await client.updateSettings({
			values: { evThreshold: 0.05, retention: 'all', stakeMode: 'fractional-kelly' },
			followedLeagues: { upsert: [{ leagueId: 39, priority: 2, markets: ['Vegeredmeny', '5'] }, { leagueId: 140 }] },
			teamFilters: { upsert: [{ teamId: 33, mode: 'exclude' }] },
			markets: [{ id: 5, stored: true }],
			bookmakers: [{ id: 4, stored: true }]
		});
		expect(s.values).toMatchObject({ evThreshold: 0.05, retention: 'all', minOdds: 1.3 });
		expect(s.followedLeagues.map((l) => [l.leagueId, l.priority, l.markets])).toEqual([
			[39, 2, ['Vegeredmeny', '5']],
			[140, 0, null]
		]);
		expect(s.teamFilters).toEqual([{ teamId: 33, mode: 'exclude' }]);
		expect(s.bookmakers.every((b) => b.stored)).toBe(true);

		const again = await client.updateSettings({ followedLeagues: { remove: [140], upsert: [{ leagueId: 39, enabled: false }] } });
		expect(again.followedLeagues).toMatchObject([{ leagueId: 39, enabled: false, priority: 2, markets: ['Vegeredmeny', '5'] }]);
		expect((await client.getSettings()).values.evThreshold).toBe(0.05);
	});

	it('invalid PUT → 400 bad-request and nothing is written', async () => {
		const before = await client.getSettings();
		const bad: unknown[] = [
			{ followedLeagues: { upsert: [{ leagueId: 61, markets: ['Ismeretlen'] }] }, values: { evThreshold: 0.1 } },
			{ values: { evThreshold: 2 } },
			{ values: { minOdds: 5, maxOdds: 3 } },
			{ values: { stakeUnit: 1234 } },
			{ values: { foo: 1 } },
			{ markets: [{ id: 999, stored: true }] },
			{ teamFilters: { upsert: [{ teamId: 1, mode: 'maybe' }] } },
			{ followedLeagues: { upsert: [{ leagueId: -1 }] } },
			{ followedLeagues: { upsert: [{ leagueId: 999 }] }, values: { evThreshold: 0.1 } },
			{ teamFilters: { upsert: [{ teamId: 404, mode: 'include' }] } },
			{ values: { stakeMode: 'martingale' } },
			{ unknown: true },
			[]
		];
		for (const body of bad)
			await expect(client.updateSettings(body as SettingsUpdate)).rejects.toMatchObject({ status: 400, error: 'bad-request' });
		const res = await h(new Request('http://localhost/api/settings', { method: 'PUT', body: '{nem json' }));
		expect(res.status).toBe(400);
		expect(await client.getSettings()).toEqual(before);
	});

	it('stored invalid values fall back to defaults', () => {
		expect(settingValuesFrom({ ev_threshold: 'x', min_odds: 3, max_odds: 2, odds_retention: false, unit_ft: 7 })).toEqual({
			...DEFAULT_SETTING_VALUES,
			retention: 'all'
		});
	});

	it('PUT only on /api/settings; without a settings repo → 404', async () => {
		expect((await h(new Request('http://localhost/api/budget', { method: 'PUT', body: '{}' }))).status).toBe(405);
		expect((await h(new Request('http://localhost/api/settings', { method: 'DELETE' }))).status).toBe(405);
		const { db, repo } = await openMemoryRepository();
		const bare = createApiHandler({ repo, budget: new SqlBudgetStore(db) });
		expect((await bare(new Request('http://localhost/api/settings'))).status).toBe(404);
	});
});
