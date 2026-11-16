import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ApiFootballClient, fixtureKey, type MockFixtures } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore, type SqlExecutor, type StoredTask } from '@football/db';
import type { ApiFixtureItem } from './fixturesWindow';
import { createDbIngestWorker } from './ingestWorker';
import { createOddsHandler, toOddsSnapshots, type ApiOddsItem } from './odds';
import { loadIngestMocks, oddsEnvelope, withOdds } from './referenceMocks';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOUR = 3_600_000;
const DAY = '2024-11-02'; // 7 PL-meccs egy UTC-napon (mentett 2024-es szezon)

const asItems = <T>(json: unknown) =>
	(Array.isArray(json) ? json : (json as { response?: T[]; odds?: T[] }).response ?? (json as { odds: T[] }).odds) as T[];
const savedSeason = async () =>
	asItems<ApiFixtureItem>(JSON.parse(await readFile(`${ROOT}data/history/api-football/fixtures-39-2024.json`, 'utf8')));
const savedOdds = async () => asItems<ApiOddsItem>(JSON.parse(await readFile(`${ROOT}backend/stores/england-odds.json`, 'utf8')));

const scope = { leagueId: 39, followed: true, marketIds: [1, 5], bookmakerIds: [16] };
const item = (id: number, bookmakers: ApiOddsItem['bookmakers'], update = '2024-11-01T10:00:00+00:00'): ApiOddsItem => ({
	fixture: { id },
	update,
	bookmakers
});

describe('odds leképezés', () => {
	it('csak a feladat meccsei és a kör piac × irodája; vonal, odd > 1, dedupe; üres snapshot kimarad', () => {
		const bets = [
			{
				id: 1,
				values: [
					{ value: 'Home', odd: '2.10' },
					{ value: 'Draw', odd: '3.30' },
					{ value: 'Home', odd: '9.00' }
				]
			},
			{
				id: 5,
				values: [
					{ value: 'Over 2.5', odd: '1.90' },
					{ value: 'Under 2.5', odd: '1.00' }
				]
			},
			{ id: 8, values: [{ value: 'Yes', odd: '1.70' }] }
		];
		const response = [
			item(1, [
				{ id: 16, bets },
				{ id: 99, bets }
			]),
			item(1, [{ id: 16, bets }]),
			item(2, [{ id: 99, bets }]),
			item(3, [{ id: 16, bets }])
		];
		const capturedAt = new Date('2024-11-01T12:00:00Z');
		const out = toOddsSnapshots(response, { fixtureIds: [1, 2], scope, capturedAt, kind: 'early' });
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			fixtureId: 1,
			capturedAt: capturedAt.toISOString(),
			providerUpdatedAt: '2024-11-01T10:00:00.000Z',
			source: 'api-football',
			kind: 'early'
		});
		expect(out[0].quotes).toEqual([
			{ bookmakerId: 16, marketId: 1, selection: 'Home', line: null, odd: 2.1 },
			{ bookmakerId: 16, marketId: 1, selection: 'Draw', line: null, odd: 3.3 },
			{ bookmakerId: 16, marketId: 5, selection: 'Over', line: 2.5, odd: 1.9 }
		]);
		expect(
			toOddsSnapshots(response, { fixtureIds: [1], scope: { ...scope, followed: false }, capturedAt, kind: 'late' })
		).toEqual([]);
	});
});

describe('odds mock (mentett irodablokkok a nap meccseire)', () => {
	it('a nap meccsei, lapozva; az update a kezdés előtt; ismeretlen liga×szezon → undefined', async () => {
		const [items, odds] = [await savedSeason(), await savedOdds()];
		const ids = items.filter((i) => i.fixture!.date!.startsWith(DAY)).map((i) => i.fixture!.id!);
		const p1 = oddsEnvelope(39, 2024, DAY, 1, items, odds, 3);
		const p3 = oddsEnvelope(39, 2024, DAY, 3, items, odds, 3);
		expect(p1.paging).toEqual({ current: 1, total: 3 });
		expect(p3.response).toHaveLength(1);
		const all = [1, 2, 3].flatMap((p) => oddsEnvelope(39, 2024, DAY, p, items, odds, 3).response);
		expect(all.map((o) => o.fixture!.id).sort()).toEqual([...ids].sort());
		for (const o of all) expect(Date.parse(o.update!)).toBeLessThanOrEqual(Date.parse(o.fixture!.date!));

		const map = withOdds({}, [{ league: 39, season: 2024, items }], odds);
		expect(map[fixtureKey('/odds', { league: 39, season: 2024, date: DAY })]?.results).toBe(ids.length);
		expect(map[fixtureKey('/odds', { league: 61, season: 2024, date: DAY })]).toBeUndefined();
		const real = await loadIngestMocks(ROOT, new Date('2026-11-16T00:00:00Z'));
		expect(real[fixtureKey('/odds', { league: 39, season: 2024, date: DAY })]?.results).toBe(ids.length);
	});
});

/** Követett liga, Unibet (16) tárolt, piacok: 1 és 5 tárolt, 8 nem. */
async function seedScope(db: SqlExecutor) {
	await db.exec(`INSERT INTO league (id, name) VALUES (39, 'Premier League'); INSERT INTO followed_league (league_id) VALUES (39);
		INSERT INTO bookmaker (id, name, stored) VALUES (16, 'Unibet', true), (8, 'Bet365', true);
		INSERT INTO market (id, name, stored) VALUES (1, 'Match Winner', true), (5, 'Goals Over/Under', true), (8, 'Both Teams Score', false);`);
}

async function seedFixtures(db: SqlExecutor, list: readonly { id: number; date: string; home: number; away: number }[]) {
	for (const f of list) {
		for (const t of [f.home, f.away])
			await db.query('INSERT INTO team (id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING', [t, `T${t}`]);
		await db.query(
			`INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id)
			 VALUES ($1, 39, 2024, $2::timestamptz, 'NS', $3, $4)`,
			[f.id, f.date, f.home, f.away]
		);
	}
}

const snapshotRows = async (db: SqlExecutor) =>
	(
		await db.query<{ fixture_id: number; kind: string; provider_updated_at: unknown; quotes: number; markets: number[] }>(
			`SELECT s.fixture_id::float8 AS fixture_id, s.kind, s.provider_updated_at, count(q.id)::int AS quotes,
				array_agg(DISTINCT q.market_id::int ORDER BY q.market_id::int) AS markets
			 FROM odds_snapshot s JOIN odds_quote q ON q.snapshot_id = s.id GROUP BY s.id ORDER BY s.kind, s.fixture_id`
		)
	).rows;

describe('odds a workerben (mock, friss memória-PGlite)', () => {
	it('lapozás: 12 meccs = 2 oldal, mind a 12 snapshot elkészül', async () => {
		const { db } = await openMemoryRepository();
		await seedScope(db);
		const date = '2024-11-30T15:00:00Z';
		const list = Array.from({ length: 12 }, (_, i) => ({ id: 100 + i, date, home: 1000 + 2 * i, away: 1001 + 2 * i }));
		await seedFixtures(db, list);
		const bets = [{ id: 1, values: [{ value: 'Home', odd: '2.00' }] }];
		const page = (n: number, ids: number[]) => ({
			get: 'odds',
			parameters: {},
			errors: [],
			results: ids.length,
			paging: { current: n, total: 2 },
			response: ids.map((id) => item(id, [{ id: 16, bets }]))
		});
		const params = { league: 39, season: 2024, date: '2024-11-30' };
		const fixtures: MockFixtures = {
			[fixtureKey('/odds', params)]: page(
				1,
				list.slice(0, 10).map((f) => f.id)
			),
			[fixtureKey('/odds', { ...params, page: 2 })]: page(
				2,
				list.slice(10).map((f) => f.id)
			)
		};
		const task = { id: 1, kind: 'odds_early', params: { ...params, fixtures: list.map((f) => f.id) } } as unknown as StoredTask;
		const now = new Date('2024-11-29T10:00:00Z');
		await createOddsHandler(db, 'early')(task, { now, client: new ApiFootballClient({ mode: 'mock', fixtures }) });
		const rows = await snapshotRows(db);
		expect(rows.map((r) => r.fixture_id)).toEqual(list.map((f) => f.id));
		expect(rows.every((r) => r.kind === 'early' && r.quotes === 1)).toBe(true);
	});

	it('early (−30 h), majd late (−2 h) snapshot csak a tárolt piac × irodával; ismételt tick nem duplikál', async () => {
		const items = await savedSeason();
		const day = items.filter((i) => i.fixture!.date!.startsWith(DAY));
		const { db } = await openMemoryRepository();
		await seedScope(db);
		await seedFixtures(
			db,
			day.map((i) => ({ id: i.fixture!.id!, date: i.fixture!.date!, home: i.teams!.home!.id!, away: i.teams!.away!.id! }))
		);
		const t0 = Math.min(...day.map((i) => Date.parse(i.fixture!.date!)));
		const fixtures = withOdds({}, [{ league: 39, season: 2024, items }], await savedOdds());
		let now = t0 - 30 * HOUR;
		const run = () => createDbIngestWorker(db, { fixtures })({ now: new Date(now), deadline: new Date(now + 60_000) });

		await run();
		let rows = await snapshotRows(db);
		expect(rows).toHaveLength(day.length);
		expect(rows.every((r) => r.kind === 'early' && r.provider_updated_at !== null)).toBe(true);
		expect(rows.every((r) => r.markets.every((m) => m === 1 || m === 5))).toBe(true);

		now = t0 - 2 * HOUR;
		await run();
		await run();
		rows = await snapshotRows(db);
		expect(rows.filter((r) => r.kind === 'late')).toHaveLength(day.length);
		expect(rows).toHaveLength(2 * day.length);
		const tasks = (await new SqlTaskStore(db).list()).filter((t) => t.kind.startsWith('odds_'));
		expect(tasks.map((t) => [t.kind, t.status, t.dedupeKey]).sort()).toEqual([
			['odds_early', 'done', `odds_early:39:${DAY}`],
			['odds_late', 'done', `odds_late:39:${DAY}`]
		]);
	});
});
