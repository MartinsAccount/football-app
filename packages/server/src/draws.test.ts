import { SqlBudgetStore } from '@football/api-client';
import { ApiError, createApiClient, type ApiClient } from '@football/contract';
import { openMemoryRepository } from '@football/db';
import { DrawsValidationError, loadDrawWatch, parseDrawsQuery } from './draws';
import { createApiHandler } from './router';

let client: ApiClient;
let bare: ApiClient;

// 4 csapat, 3 forduló lejátszva januárban; febr. 3-án két közelgő meccs (az egyiknek nincs oddsa), febr. 10-én egy kívül eső.
beforeAll(async () => {
	const mem = await openMemoryRepository();
	await mem.db.exec(`
		INSERT INTO league (id, name) VALUES (39, 'Premier League');
		INSERT INTO team (id, name) VALUES (1, 'Arsenal'), (2, 'Brighton'), (3, 'Chelsea'), (4, 'Everton');
		INSERT INTO market (id, name) VALUES (1, 'Match Winner');
		INSERT INTO bookmaker (id, name) VALUES (8, 'Bet365'), (4, 'Pinnacle'), (900001, 'CSV átlag'), (900002, 'CSV max');
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id, goals_home, goals_away) VALUES
			(1, 39, 2023, '2024-01-06T15:00:00Z', 'FT', 1, 2, 1, 1),
			(2, 39, 2023, '2024-01-06T15:00:00Z', 'FT', 3, 4, 2, 0),
			(3, 39, 2023, '2024-01-13T15:00:00Z', 'FT', 2, 3, 0, 0),
			(4, 39, 2023, '2024-01-13T15:00:00Z', 'FT', 4, 1, 1, 3),
			(5, 39, 2023, '2024-01-20T15:00:00Z', 'FT', 1, 3, 2, 2),
			(6, 39, 2023, '2024-01-20T15:00:00Z', 'FT', 2, 4, 1, 0),
			(10, 39, 2023, '2024-02-03T15:00:00Z', 'NS', 2, 1, NULL, NULL),
			(11, 39, 2023, '2024-02-03T17:30:00Z', 'NS', 4, 3, NULL, NULL),
			(12, 39, 2023, '2024-02-03T20:00:00Z', 'NS', 3, 2, NULL, NULL),
			(13, 39, 2023, '2024-02-10T15:00:00Z', 'NS', 1, 4, NULL, NULL);
		INSERT INTO odds_snapshot (id, fixture_id, captured_at, source, kind) VALUES
			(1, 10, '2024-01-30T00:00:00Z', 'football-data-csv', 'opening_csv'),
			(2, 11, '2024-02-01T00:00:00Z', 'api-football', 'adhoc'),
			(3, 11, '2024-02-04T00:00:00Z', 'api-football', 'adhoc'),
			(4, 13, '2024-02-05T00:00:00Z', 'api-football', 'adhoc');
		INSERT INTO odds_quote (snapshot_id, bookmaker_id, market_id, selection, line, odd) VALUES
			(1, 900001, 1, 'Home', NULL, 2.9), (1, 900001, 1, 'Draw', NULL, 3.2), (1, 900001, 1, 'Away', NULL, 2.5),
			(1, 900002, 1, 'Home', NULL, 3.1), (1, 900002, 1, 'Draw', NULL, 3.5), (1, 900002, 1, 'Away', NULL, 2.7),
			(2, 8, 1, 'Home', NULL, 3.4), (2, 8, 1, 'Draw', NULL, 3.6), (2, 8, 1, 'Away', NULL, 2.1),
			(2, 4, 1, 'Home', NULL, 3.5), (2, 4, 1, 'Draw', NULL, 3.7), (2, 4, 1, 'Away', NULL, 2.15),
			(3, 8, 1, 'Home', NULL, 9.0), (3, 8, 1, 'Draw', NULL, 9.0), (3, 8, 1, 'Away', NULL, 1.1),
			(4, 8, 1, 'Home', NULL, 1.5), (4, 8, 1, 'Draw', NULL, 4.0), (4, 8, 1, 'Away', NULL, 6.0);
	`);
	const now = () => new Date('2024-02-01T00:00:00Z');
	const h = createApiHandler({
		repo: mem.repo,
		budget: new SqlBudgetStore(mem.db),
		now,
		draws: (q) => loadDrawWatch(mem.db, q)
	});
	client = createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => h(new Request(url, init)) });
	const hb = createApiHandler({ repo: mem.repo, budget: new SqlBudgetStore(mem.db), now });
	bare = createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => hb(new Request(url, init)) });
});

describe('parseDrawsQuery', () => {
	const now = new Date('2024-02-01T00:00:00Z');
	it('alap: most → +3 nap, 10 elem', () => {
		expect(parseDrawsQuery(new URLSearchParams(), now)).toEqual({
			from: '2024-02-01T00:00:00.000Z',
			to: '2024-02-04T00:00:00.000Z',
			limit: 10
		});
	});
	it('hibás paraméterek', () => {
		for (const q of ['from=x', 'from=2024-02-02&to=2024-02-01', 'limit=0', 'limit=51', 'limit=a', 'to=2024-04-01'])
			expect(() => parseDrawsQuery(new URLSearchParams(q), now)).toThrow(DrawsValidationError);
	});
});

describe('GET /api/draws', () => {
	it('az ablak oddsos meccsei p(X) szerint, a kezdés előtti odds-szal és top 3 tényezővel', async () => {
		const res = await client.getDraws();
		expect(res.modelVersion).toBe('draw-logreg@1.0.0');
		expect(res.analyzed).toBe(2); // a 12-nek nincs oddsa, a 13 kívül esik
		expect(res.items.map((i) => i.fixtureId).sort()).toEqual([10, 11]);
		expect(res.items[0].pDraw).toBeGreaterThanOrEqual(res.items[1].pDraw);
		const m10 = res.items.find((i) => i.fixtureId === 10)!;
		// CSV-átlag fair p(X); X-odds a snapshot maximuma.
		const inv = [1 / 2.9, 1 / 3.2, 1 / 2.5];
		expect(m10.pMarket).toBeCloseTo(inv[1] / (inv[0] + inv[1] + inv[2]), 9);
		expect(m10.drawOdds).toBe(3.5);
		expect(m10).toMatchObject({ home: { id: 2, name: 'Brighton' }, away: { id: 1, name: 'Arsenal' }, league: { id: 39 } });
		const m11 = res.items.find((i) => i.fixtureId === 11)!;
		expect(m11.drawOdds).toBe(3.7); // a kezdés utáni (3-as) snapshot nem számít
		for (const i of res.items) {
			expect(i.factors.length).toBeGreaterThan(0);
			expect(i.factors.length).toBeLessThanOrEqual(3);
			expect(Math.abs(i.pDraw - i.pMarket)).toBeLessThan(0.1);
		}
	});

	it('limit és üres ablak', async () => {
		expect((await client.getDraws({ limit: 1 })).items).toHaveLength(1);
		const empty = await client.getDraws({ from: '2023-01-01T00:00:00Z', to: '2023-01-05T00:00:00Z' });
		expect(empty).toMatchObject({ analyzed: 0, items: [] });
	});

	it('hibás paraméter → 400, bekötés nélkül 404', async () => {
		await expect(client.getDraws({ limit: 99 })).rejects.toMatchObject({ status: 400 });
		await expect(bare.getDraws()).rejects.toBeInstanceOf(ApiError);
		await expect(bare.getDraws()).rejects.toMatchObject({ status: 404 });
	});
});
