import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fixtureKey, type MockFixtures } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore, type SqlExecutor } from '@football/db';
import type { ApiFixtureItem } from './fixturesWindow';
import { createDbIngestWorker } from './ingestWorker';
import { loadIngestMocks, replayInstant, standingsEnvelope, withStandings } from './referenceMocks';
import { toStandingRows, type ApiStandingsItem } from './standings';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOUR = 3_600_000;
const KICKOFF = Date.parse('2026-11-23T15:00:00Z'); // vasárnapi forduló → tabella-feladat 2026-11-22 00:00-tól
const ROUND = 'Regular Season - 12';

async function savedSeason(): Promise<ApiFixtureItem[]> {
	const json = JSON.parse(await readFile(`${ROOT}data/history/api-football/fixtures-39-2024.json`, 'utf8'));
	return (Array.isArray(json) ? json : json.response) as ApiFixtureItem[];
}

const finishedBefore = (items: readonly ApiFixtureItem[], asOf: string) =>
	items.filter((i) => i.fixture?.status?.short === 'FT' && Date.parse(i.fixture.date!) < Date.parse(asOf));

describe('standings leképezés', () => {
	it('API-alak → sorok: csak a kért liga×szezon, hiányos sor kimarad, csapat egyszer', () => {
		const entry = (id: number, rank: number) => ({
			rank,
			team: { id, name: `T${id}` },
			points: 10 - rank,
			group: 'G',
			all: { played: 3, win: 1, draw: 1, lose: 1, goals: { for: 4, against: 2 } }
		});
		const response: ApiStandingsItem[] = [
			{ league: { id: 39, season: 2024, standings: [[entry(2, 2), entry(1, 1), { rank: 3, team: { id: 3 } }], [entry(1, 1)]] } },
			{ league: { id: 40, season: 2024, standings: [[entry(9, 1)]] } }
		];
		const { rows, teams } = toStandingRows(response, 39, 2024);
		expect(rows.map((r) => [r.teamId, r.rank])).toEqual([
			[1, 1],
			[2, 2]
		]);
		expect(rows[0]).toMatchObject({ points: 9, played: 3, gf: 4, ga: 2, form: null, description: null, groupName: 'G' });
		expect(teams.map((t) => t.id).sort()).toEqual([1, 2]);
	});
});

describe('standings mock (mentett meccsekből, pont-idejű)', () => {
	it('csak az asOf előtt befejezett meccsek számítanak; minden csapat szerepel', async () => {
		const items = await savedSeason();
		const asOf = replayInstant(new Date('2026-11-22T06:00:00Z'), 2024);
		expect(asOf).toBe('2024-11-22T06:00:00.000Z');
		const env = standingsEnvelope(39, 2024, asOf, items);
		const table = env.response[0].league!.standings![0];
		expect(table).toHaveLength(20);
		expect(table.reduce((s, r) => s + r.all!.played!, 0)).toBe(2 * finishedBefore(items, asOf).length);
		expect(table.map((r) => r.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

		const start = standingsEnvelope(39, 2024, '2024-07-01T00:00:00Z', items).response[0].league!.standings![0];
		expect(start.every((r) => r.points === 0 && r.all!.played === 0)).toBe(true);
	});

	it('withStandings: a kulcs liga×szezon, az óra adja az időpontot; ismeretlen → undefined', async () => {
		const items = await savedSeason();
		let now = new Date('2026-08-20T00:00:00Z');
		const map = withStandings({}, [{ league: 39, season: 2024, items }], () => now);
		const played = () =>
			(
				map[fixtureKey('/standings', { league: 39, season: 2024 })] as { response: ApiStandingsItem[] }
			).response[0].league!.standings![0].reduce((s, r) => s + r.all!.played!, 0);
		const early = played();
		now = new Date('2026-12-20T00:00:00Z');
		expect(played()).toBeGreaterThan(early);
		expect(map[fixtureKey('/standings', { league: 61, season: 2024 })]).toBeUndefined();
		const real = await loadIngestMocks(ROOT, now, () => now);
		expect(real[fixtureKey('/standings', { league: 78, season: 2023 })]?.results).toBe(1);
	});
});

describe('standings a workerben (mock, friss memória-PGlite)', () => {
	/** Követett liga + egy jövő heti NS meccs (a planner ebből ütemezi a tabella-feladatot). */
	async function seed(db: SqlExecutor, items: readonly ApiFixtureItem[]) {
		const [home, away] = [items[0].teams!.home!, items[0].teams!.away!];
		await db.exec(
			`INSERT INTO league (id, name) VALUES (39, 'Premier League'); INSERT INTO followed_league (league_id) VALUES (39);`
		);
		for (const t of [home, away]) await db.query('INSERT INTO team (id, name) VALUES ($1, $2)', [t.id, t.name]);
		await db.query(
			`INSERT INTO fixture (id, league_id, season, round, kickoff_at, status, home_team_id, away_team_id)
			 VALUES (9000001, 39, 2024, $1, $2::timestamptz, 'NS', $3, $4)`,
			[ROUND, new Date(KICKOFF).toISOString(), home.id, away.id]
		);
	}

	const snapshots = async (db: SqlExecutor) =>
		(
			await db.query<{ captured_at: unknown; team_id: number; rank: number; played: number; points: number }>(
				`SELECT captured_at, team_id::float8 AS team_id, rank, played, points FROM standing_snapshot ORDER BY captured_at, rank`
			)
		).rows;

	it('a snapshot a forduló előtti UTC-napon keletkezik, előtte nem; ismételt tick nem duplikál', async () => {
		const items = await savedSeason();
		const { db } = await openMemoryRepository();
		await seed(db, items);
		let now = KICKOFF - 2 * 24 * HOUR; // 2026-11-21 15:00 – még nem esedékes
		const fixtures: MockFixtures = withStandings({}, [{ league: 39, season: 2024, items }], () => new Date(now));
		const run = () => createDbIngestWorker(db, { fixtures })({ now: new Date(now), deadline: new Date(now + 60_000) });

		await run();
		expect(await snapshots(db)).toHaveLength(0);

		now = Date.parse('2026-11-22T06:00:00Z');
		await run();
		const rows = await snapshots(db);
		expect(rows).toHaveLength(20);
		expect(new Date(rows[0].captured_at as string).getTime()).toBe(now);
		const asOf = replayInstant(new Date(now), 2024);
		expect(rows.reduce((s, r) => s + r.played, 0)).toBe(2 * finishedBefore(items, asOf).length);
		const task = (await new SqlTaskStore(db).list()).find((t) => t.kind === 'standings')!;
		expect(task).toMatchObject({ status: 'done', dedupeKey: `standings:39:2024:${ROUND}` });

		now += HOUR;
		await run();
		expect(await snapshots(db)).toHaveLength(20);
	});
});
