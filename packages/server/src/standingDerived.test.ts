import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { openMemoryRepository, type SqlExecutor } from '@football/db';
import { toFixtureRows, upsertFixtureRows, type ApiFixtureItem } from './fixturesWindow';
import { createDbIngestWorker } from './ingestWorker';
import { upsertTeams } from './reference';
import { withFixturesByIds } from './referenceMocks';
import { matchdayAsOfs, refreshStandingDerived } from './standingDerived';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

async function savedSeason(season: number): Promise<ApiFixtureItem[]> {
	const json = JSON.parse(await readFile(`${ROOT}data/history/api-football/fixtures-39-${season}.json`, 'utf8'));
	return (Array.isArray(json) ? json : json.response) as ApiFixtureItem[];
}

/** A Premier League 2024/25 hivatalos végeredménye (helyezés, pont, gólkülönbség) – ismert tabella a ROADMAP 4.3 ellenőrzéséhez. */
const PL_2024_FINAL: [string, number, number][] = [
	['Liverpool', 84, 45],
	['Arsenal', 74, 35],
	['Manchester City', 71, 28],
	['Chelsea', 69, 21],
	['Newcastle', 66, 21],
	['Aston Villa', 66, 7],
	['Nottingham Forest', 65, 12],
	['Brighton', 61, 7],
	['Bournemouth', 56, 12],
	['Brentford', 56, 9],
	['Fulham', 54, 0],
	['Crystal Palace', 53, 0],
	['Everton', 48, -2],
	['West Ham', 43, -16],
	['Manchester United', 42, -10],
	['Wolves', 42, -15],
	['Tottenham', 38, -1],
	['Leicester', 25, -47],
	['Ipswich', 22, -46],
	['Southampton', 12, -60]
];

/** Liga + szezon + a mentett meccsek (opcionálisan NS-ként, eredmény nélkül). */
async function seed(db: SqlExecutor, season: number, items: readonly ApiFixtureItem[], asNs = false) {
	await db.exec(
		`INSERT INTO league (id, name) VALUES (39, 'Premier League'); INSERT INTO season (league_id, year) VALUES (39, ${season});`
	);
	const src = asNs
		? items.map((i) => ({
				...i,
				fixture: { ...i.fixture, status: { short: 'NS' } },
				goals: { home: null, away: null },
				score: {}
		  }))
		: items;
	const { fixtures, teams } = toFixtureRows(src as ApiFixtureItem[]);
	await upsertTeams(db, teams);
	await upsertFixtureRows(db, fixtures);
}

/** A mentett meccsek meccsnap-`as_of`-jai. */
const asOfsOf = (items: readonly ApiFixtureItem[]) =>
	matchdayAsOfs(
		items.map((i, k) => ({ id: k, kickoff: i.fixture!.date!, homeTeamId: 1, awayTeamId: 2, homeGoals: 0, awayGoals: 0 }))
	);

const tableAt = async (db: SqlExecutor, asOf: string) =>
	(
		await db.query<{ name: string; rank: number; points: number; played: number; gf: number; ga: number }>(
			`SELECT t.name, d.rank, d.points, d.played, d.gf, d.ga FROM standing_derived d JOIN team t ON t.id = d.team_id
			 WHERE d.league_id = 39 AND d.season = 2024 AND d.as_of = $1::timestamptz ORDER BY d.rank`,
			[asOf]
		)
	).rows;

describe('standing_derived (friss memória-PGlite, mentett PL 2024)', () => {
	it('a szezonvégi derived tabella = a PL 2024/25 ismert végeredménye', async () => {
		const items = await savedSeason(2024);
		const { db } = await openMemoryRepository();
		await seed(db, 2024, items);
		expect(await refreshStandingDerived(db, 39, 2024)).toBeGreaterThan(0);

		const last = Math.max(...items.map((i) => Date.parse(i.fixture!.date!)));
		const end = new Date(Math.floor(last / 86_400_000 + 1) * 86_400_000).toISOString();
		const final = await tableAt(db, end);
		expect(final.map((r) => [r.name, r.points, r.gf - r.ga])).toEqual(PL_2024_FINAL);
		expect(final.every((r) => r.played === 38)).toBe(true);
	});

	it('pont-idejű: a meccsnap tabellája csak az előtte kezdett meccseket tartalmazza; újraszámolás nem duplikál', async () => {
		const items = await savedSeason(2024);
		const { db } = await openMemoryRepository();
		await seed(db, 2024, items);
		await refreshStandingDerived(db, 39, 2024);
		const count = async () =>
			Number((await db.query<{ n: number }>('SELECT count(*)::int AS n FROM standing_derived')).rows[0].n);
		const n = await count();

		const asOfs = asOfsOf(items);
		expect(n).toBe(asOfs.length * 20);

		const first = await tableAt(db, asOfs[0]);
		expect(first).toHaveLength(20);
		expect(first.every((r) => r.played === 0 && r.points === 0)).toBe(true);

		const mid = asOfs[Math.floor(asOfs.length / 2)];
		const before = items.filter((i) => Date.parse(i.fixture!.date!) < Date.parse(mid)).length;
		expect((await tableAt(db, mid)).reduce((s, r) => s + r.played, 0)).toBe(2 * before);

		await refreshStandingDerived(db, 39, 2024);
		expect(await count()).toBe(n);
	});

	it('season sor nélkül nem ír (FK), hiba nélkül', async () => {
		const items = (await savedSeason(2024)).slice(0, 10);
		const { db } = await openMemoryRepository();
		await db.exec(`INSERT INTO league (id, name) VALUES (39, 'Premier League');`);
		const { fixtures, teams } = toFixtureRows(items);
		await upsertTeams(db, teams);
		await upsertFixtureRows(db, fixtures);
		expect(await refreshStandingDerived(db, 39, 2024)).toBe(0);
	});

	it('a results job a befejezett meccsek után frissíti a derived tabellát (mock, 0 élő hívás)', async () => {
		const items = (await savedSeason(2024)).slice(0, 10); // az 1. forduló
		const { db } = await openMemoryRepository();
		await seed(db, 2024, items, true);
		await db.exec('INSERT INTO followed_league (league_id) VALUES (39);');
		const kickoff = Math.max(...items.map((i) => Date.parse(i.fixture!.date!)));
		const now = kickoff + 4 * 3_600_000;
		await createDbIngestWorker(db, { fixtures: withFixturesByIds({}, items) })({
			now: new Date(now),
			deadline: new Date(now + 60_000)
		});
		const asOfs = asOfsOf(items);
		const after = asOfs[asOfs.length - 1];
		const table = await tableAt(db, after);
		expect(table).toHaveLength(20);
		const ft = (await db.query<{ n: number }>("SELECT count(*)::int AS n FROM fixture WHERE status = 'FT'")).rows[0].n;
		expect(ft).toBeGreaterThan(0);
		expect(table.reduce((s, r) => s + r.played, 0)).toBe(2 * ft);
	});
});
