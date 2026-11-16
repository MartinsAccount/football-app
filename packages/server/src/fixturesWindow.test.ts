import { fileURLToPath } from 'node:url';
import { fixtureKey } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore } from '@football/db';
import { toFixtureRows } from './fixturesWindow';
import { createDbIngestWorker } from './ingestWorker';
import { buildFixturesWindowMocks, fixturesWindowEnvelope, loadIngestMocks, replayDay } from './referenceMocks';

const AT = new Date('2026-11-16T10:00:00Z');
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const KEY = fixtureKey('/fixtures', { league: 39, season: 2024, from: '2026-11-16', to: '2026-11-23' });

const team = (id: number, name: string) => ({ id, name, logo: `https://x/${id}.png` });
const item = (id: number, date: string, home: number, away: number, status = 'NS', goals: [number, number] | null = null) => ({
	fixture: { id, referee: null, date, venue: { id: 555 }, status: { short: status } },
	league: { id: 39, season: 2024, round: 'Regular Season - 12' },
	teams: { home: team(home, `T${home}`), away: team(away, `T${away}`) },
	goals: { home: goals?.[0] ?? null, away: goals?.[1] ?? null },
	score: { halftime: { home: null, away: null }, fulltime: { home: goals?.[0] ?? null, away: goals?.[1] ?? null } }
});
const ITEMS = [
	item(1, '2024-11-23T15:00:00+00:00', 40, 50),
	item(2, '2024-11-24T16:30:00+00:00', 33, 40),
	item(3, '2024-11-10T14:00:00+00:00', 50, 33, 'FT', [1, 2]) // ablakon kívül
];

describe('fixtures_window mock', () => {
	it('a kért nap a mentett szezonba vetül (júl. S – jún. S+1)', () => {
		expect(replayDay('2026-11-16', 2024)).toBe('2024-11-16');
		expect(replayDay('2027-02-03', 2024)).toBe('2025-02-03');
	});

	it('az envelope csak a visszajátszott [from, to] napok meccseit adja, eredeti dátummal', () => {
		const env = fixturesWindowEnvelope(39, 2024, '2026-11-16', '2026-11-23', ITEMS);
		expect(env.response.map((i) => i.fixture?.date)).toEqual(['2024-11-23T15:00:00+00:00']);
		expect(env.parameters).toEqual({ league: '39', season: '2024', from: '2026-11-16', to: '2026-11-23' });
	});

	it('API-elem → fixture-sor; hiányos elem kimarad', () => {
		const { fixtures, teams } = toFixtureRows([ITEMS[2], { fixture: { id: 9 } }]);
		expect(fixtures).toEqual([
			expect.objectContaining({
				id: 3,
				kickoffAt: '2024-11-10T14:00:00.000Z',
				status: 'FT',
				goalsHome: 1,
				ftAway: 2,
				venueId: 555
			})
		]);
		expect(teams.map((t) => t.id)).toEqual([50, 33]);
	});

	it('a repó mentett adataiból is felépül (planner-kulcs a mai napra)', async () => {
		const real = await loadIngestMocks(ROOT, AT);
		expect(real[KEY]?.results).toBeGreaterThan(0);
		expect(real['/odds/bets']).toBeDefined();
	});
});

describe('fixtures_window a workerben (mock, friss memória-PGlite)', () => {
	it('upserteli a meccseket és a hiányzó csapatokat, a meglévő adatot üres mező nem írja felül, 0 hívás', async () => {
		const { db } = await openMemoryRepository();
		const tasks = new SqlTaskStore(db);
		await db.exec(`
			INSERT INTO league (id, name) VALUES (39, 'Premier League');
			INSERT INTO followed_league (league_id) VALUES (39);
			INSERT INTO team (id, name, code, country) VALUES (40, 'Liverpool', 'LIV', 'England'), (50, 'Man City', 'MCI', 'England');
			INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id, goals_home, goals_away, referee)
				VALUES (1, 39, 2024, '2024-11-22T15:00:00Z', 'PST', 40, 50, 0, 0, 'M. Oliver');
		`);
		const mocks = buildFixturesWindowMocks([{ league: 39, season: 2024, items: ITEMS }], ['2026-11-16']);
		const res = await createDbIngestWorker(db, { fixtures: mocks })({ now: AT, deadline: new Date(AT.getTime() + 60_000) });
		expect(res.calls).toBe(0);
		expect((await tasks.list()).find((t) => t.kind === 'fixtures_window')?.status).toBe('done');

		const q = async <T>(sql: string) => (await db.query<T>(sql)).rows;
		expect(
			await q(`SELECT id, status, kickoff_at::text AS k, goals_home, referee, venue_id, round FROM fixture ORDER BY id`)
		).toEqual([
			{
				id: 1,
				status: 'NS',
				k: '2024-11-23 15:00:00+00',
				goals_home: 0,
				referee: 'M. Oliver',
				venue_id: 555,
				round: 'Regular Season - 12'
			}
		]);
		expect(await q('SELECT id, name, code FROM team ORDER BY id')).toEqual([
			{ id: 40, name: 'T40', code: 'LIV' },
			{ id: 50, name: 'T50', code: 'MCI' }
		]);
	});
});
