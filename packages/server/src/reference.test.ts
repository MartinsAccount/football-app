import { fileURLToPath } from 'node:url';
import { fixtureKey } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore } from '@football/db';
import { createDbIngestWorker } from './ingestWorker';
import { toLeagueRows, toMarketRows, type ApiLeagueItem } from './reference';
import { buildReferenceMocks, loadReferenceMocks } from './referenceMocks';

const AT = new Date('2026-11-16T10:00:00Z');
const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const team = (id: number, name: string) => ({ id, name, logo: `https://x/${id}.png` });
const mocks = buildReferenceMocks({
	fixtures: [
		{
			league: 39,
			season: 2024,
			items: [
				{
					league: { id: 39, name: 'Premier League', country: 'England', logo: 'https://x/l39.png' },
					teams: { home: team(33, 'Manchester United'), away: team(40, 'Liverpool') }
				},
				{ teams: { home: team(40, 'Liverpool'), away: team(50, 'Manchester City') } },
				{ teams: { home: team(50, 'Manchester City'), away: team(33, 'Manchester United') } }
			]
		}
	],
	odds: [
		{
			bookmakers: [
				{
					id: 8,
					name: 'Bet365',
					bets: [
						{ id: 1, name: 'Match Winner' },
						{ id: 8, name: 'Both Teams Score' }
					]
				},
				{ id: 16, name: 'Unibet', bets: [{ id: 999, name: 'Some Exotic Market' }] }
			]
		}
	]
});

async function setup() {
	const { db } = await openMemoryRepository();
	await db.exec(`
		INSERT INTO league (id, name, type) VALUES (39, 'Premier League', 'league');
		INSERT INTO season (league_id, year, is_current, coverage, coverage_checked_at)
			VALUES (39, 2024, true, '{"odds": true}', '2026-11-01T00:00:00Z');
		INSERT INTO followed_league (league_id) VALUES (39);
		INSERT INTO bookmaker (id, name, stored) VALUES (8, 'Bet 365 (régi)', true);
		INSERT INTO market (id, name, code, stored) VALUES (1, 'Match Winner', 'Vegeredmeny', true);
	`);
	return { db, tasks: new SqlTaskStore(db) };
}

describe('reference mapping', () => {
	it('API bet-név → BETS_TYPES kód + analyzed', () => {
		expect(
			toMarketRows([
				{ id: 1, name: 'Match Winner' },
				{ id: 999, name: 'Exotic' }
			])
		).toEqual([
			{ id: 1, name: 'Match Winner', code: 'Vegeredmeny', analyzed: true },
			{ id: 999, name: 'Exotic', code: null, analyzed: false }
		]);
	});

	it('mock-térkép a mentett adatból: /teams liga×szezon, /odds/bookmakers, /odds/bets', () => {
		expect(mocks[fixtureKey('/teams', { league: 39, season: 2024 })].response).toHaveLength(3);
		expect(mocks['/odds/bookmakers'].response).toEqual([
			{ id: 8, name: 'Bet365' },
			{ id: 16, name: 'Unibet' }
		]);
		expect(mocks['/odds/bets'].results).toBe(3);
	});

	it('a repó mentett adataiból is felépül (data/history + backend/stores)', async () => {
		const real = await loadReferenceMocks(ROOT);
		expect(real[fixtureKey('/teams', { league: 39, season: 2024 })]?.results).toBeGreaterThanOrEqual(20);
		expect(real['/odds/bookmakers'].results).toBeGreaterThan(0);
		expect(real['/odds/bets'].results).toBeGreaterThan(0);
		// mentett /leagues nincs → a meccslistákból: 5 liga, coverage nélkül
		const leagues = real['/leagues'].response as ApiLeagueItem[];
		expect(leagues.map((l) => l.league?.id)).toEqual([39, 61, 78, 135, 140]);
		expect(leagues.every((l) => l.seasons?.every((s) => s.coverage === undefined))).toBe(true);
	});
});

describe('reference jobok a workerben (mock, friss memória-PGlite)', () => {
	it('kitölti a team/season_team/bookmaker/market táblát, a stored-ot nem írja felül, 0 hívás', async () => {
		const { db, tasks } = await setup();
		const worker = createDbIngestWorker(db, { fixtures: mocks });
		const res = await worker({ now: AT, deadline: new Date(AT.getTime() + 60_000) });
		expect(res.calls).toBe(0);

		const ref = (await tasks.list()).filter((t) => t.kind === 'reference');
		expect(ref.map((t) => t.status)).toEqual(['done', 'done', 'done', 'done']);

		const q = async <T>(sql: string) => (await db.query<T>(sql)).rows;
		// /leagues mock (meccsekből, coverage nélkül): a meglévő type/is_current/coverage marad.
		expect(await q('SELECT id, name, country, type, logo_url FROM league')).toEqual([
			{ id: 39, name: 'Premier League', country: 'England', type: 'league', logo_url: 'https://x/l39.png' }
		]);
		expect(await q('SELECT year, is_current, coverage, coverage_checked_at FROM season')).toEqual([
			{ year: 2024, is_current: true, coverage: { odds: true }, coverage_checked_at: new Date('2026-11-01T00:00:00Z') }
		]);
		expect(await q('SELECT id, name, logo_url FROM team ORDER BY id')).toEqual([
			{ id: 33, name: 'Manchester United', logo_url: 'https://x/33.png' },
			{ id: 40, name: 'Liverpool', logo_url: 'https://x/40.png' },
			{ id: 50, name: 'Manchester City', logo_url: 'https://x/50.png' }
		]);
		expect(await q('SELECT team_id FROM season_team WHERE league_id = 39 AND year = 2024 ORDER BY team_id')).toEqual([
			{ team_id: 33 },
			{ team_id: 40 },
			{ team_id: 50 }
		]);
		expect(await q('SELECT id, name, stored FROM bookmaker ORDER BY id')).toEqual([
			{ id: 8, name: 'Bet365', stored: true },
			{ id: 16, name: 'Unibet', stored: false }
		]);
		expect(await q('SELECT id, code, analyzed, stored FROM market ORDER BY id')).toEqual([
			{ id: 1, code: 'Vegeredmeny', analyzed: true, stored: true },
			{ id: 8, code: 'MindketCsapatGol', analyzed: true, stored: false },
			{ id: 999, code: null, analyzed: false, stored: false }
		]);
	});

	it('/leagues valódi alakú válasz: liga + szezonok + coverage, checked_at = now; üres mező nem ír felül', async () => {
		const { db } = await setup();
		// Kézi, egyértelműen szintetikus elem (nem mentett API-válasz).
		const synthetic: ApiLeagueItem[] = [
			{
				league: { id: 39, name: 'Premier League', type: 'League', logo: null },
				country: { name: 'England' },
				seasons: [
					{ year: 2023, start: '2023-08-11', end: '2024-05-19', current: false, coverage: { odds: false } },
					{ year: 2024, start: '2024-08-16', end: '2025-05-25', current: true, coverage: { odds: true, injuries: true } }
				]
			},
			{ league: { id: 2, name: 'UEFA Champions League', type: 'Cup' }, country: { name: 'World' }, seasons: [{ year: 2024 }] },
			{ league: { name: 'id nélkül' } }
		];
		const fx = { ...mocks, '/leagues': { ...mocks['/leagues'], results: 3, response: synthetic } };
		await createDbIngestWorker(db, { fixtures: fx })({ now: AT, deadline: new Date(AT.getTime() + 60_000) });
		const q = async <T>(sql: string) => (await db.query<T>(sql)).rows;
		expect(await q('SELECT id, country, type FROM league ORDER BY id')).toEqual([
			{ id: 2, country: 'World', type: 'cup' },
			{ id: 39, country: 'England', type: 'league' }
		]);
		expect(
			await q(
				'SELECT league_id, year, is_current, coverage, coverage_checked_at, start_date::text AS start FROM season ORDER BY 1, 2'
			)
		).toEqual([
			{ league_id: 2, year: 2024, is_current: false, coverage: null, coverage_checked_at: null, start: null },
			{ league_id: 39, year: 2023, is_current: false, coverage: { odds: false }, coverage_checked_at: AT, start: '2023-08-11' },
			{
				league_id: 39,
				year: 2024,
				is_current: true,
				coverage: { odds: true, injuries: true },
				coverage_checked_at: AT,
				start: '2024-08-16'
			}
		]);
		expect(toLeagueRows(synthetic).leagues).toHaveLength(2);
	});

	it('hiányzó mock → mock-missing → végleges hiba (failed), a többi lefut', async () => {
		const { db, tasks } = await setup();
		const partial = { ...mocks };
		delete partial['/odds/bets'];
		await createDbIngestWorker(db, { fixtures: partial })({ now: AT, deadline: new Date(AT.getTime() + 60_000) });
		const ref = (await tasks.list()).filter((t) => t.kind === 'reference');
		const byKey = Object.fromEntries(ref.map((t) => [t.dedupeKey.split(':')[1], t.status]));
		expect(byKey).toMatchObject({ bets: 'failed', bookmakers: 'done', leagues: 'done', teams: 'done' });
	});
});
