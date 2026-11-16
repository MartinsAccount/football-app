import { fileURLToPath } from 'node:url';
import { fixtureKey } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore } from '@football/db';
import { createDbIngestWorker } from './ingestWorker';
import { toMarketRows } from './reference';
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
		INSERT INTO league (id, name) VALUES (39, 'Premier League');
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
	});
});

describe('reference jobok a workerben (mock, friss memória-PGlite)', () => {
	it('kitölti a team/season_team/bookmaker/market táblát, a stored-ot nem írja felül, 0 hívás', async () => {
		const { db, tasks } = await setup();
		const worker = createDbIngestWorker(db, { fixtures: mocks });
		const res = await worker({ now: AT, deadline: new Date(AT.getTime() + 60_000) });
		expect(res.calls).toBe(0);

		const ref = (await tasks.list()).filter((t) => t.kind === 'reference');
		expect(ref.map((t) => t.status)).toEqual(['done', 'done', 'done']);

		const q = async <T>(sql: string) => (await db.query<T>(sql)).rows;
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

	it('hiányzó mock → mock-missing → végleges hiba (failed), a többi lefut', async () => {
		const { db, tasks } = await setup();
		const partial = { ...mocks };
		delete partial['/odds/bets'];
		await createDbIngestWorker(db, { fixtures: partial })({ now: AT, deadline: new Date(AT.getTime() + 60_000) });
		const ref = (await tasks.list()).filter((t) => t.kind === 'reference');
		const byKey = Object.fromEntries(ref.map((t) => [t.dedupeKey.split(':')[1], t.status]));
		expect(byKey).toMatchObject({ bets: 'failed', bookmakers: 'done', teams: 'done' });
	});
});
