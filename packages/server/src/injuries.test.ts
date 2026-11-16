import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fixtureKey, type MockFixtures } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore, type SqlExecutor } from '@football/db';
import type { ApiFixtureItem } from './fixturesWindow';
import { insertInjuries, toInjuryRows, type ApiInjuryItem } from './injuries';
import { createDbIngestWorker } from './ingestWorker';
import { injuriesByIdsEnvelope, loadIngestMocks, withInjuries } from './referenceMocks';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOUR = 3_600_000;
const K = Date.parse('2024-05-19T15:00:00Z'); // a 2023/24-es PL utolsó fordulója: 10 meccs egyszerre

/** A mentett 2023-as PL-szezon utolsó fordulója (10 meccs, közös kezdés). */
async function lastRound(): Promise<ApiFixtureItem[]> {
	const json = JSON.parse(await readFile(`${ROOT}data/history/api-football/fixtures-39-2023.json`, 'utf8'));
	const items = (Array.isArray(json) ? json : json.response) as ApiFixtureItem[];
	return items.filter((i) => Date.parse(i.fixture!.date!) === K);
}

/**
 * SZINTETIKUS, kézi tesztadat – NEM valós sérültlista (mentett `/injuries` válasz nincs a repóban, DECISIONS 3.6). Csak a
 * tárolás útját ellenőrzi (meccshez kötés, FK, idempotencia); modell/elemzés nem használhatja.
 */
function syntheticInjuries(items: readonly ApiFixtureItem[]): ApiInjuryItem[] {
	const [a, b] = items;
	const fake = (fx: ApiFixtureItem, side: 'home' | 'away', id: number, type: string): ApiInjuryItem => ({
		player: { id, name: `SYNTHETIC player ${id}`, type, reason: 'SYNTHETIC – test fixture' },
		team: { id: fx.teams![side]!.id, name: fx.teams![side]!.name },
		fixture: { id: fx.fixture!.id }
	});
	return [
		fake(a, 'home', 990001, 'Missing Fixture'),
		fake(a, 'away', 990002, 'Questionable'),
		fake(b, 'home', 990003, 'Missing Fixture')
	];
}

async function seedNs(db: SqlExecutor, items: readonly ApiFixtureItem[]) {
	await db.exec(
		`INSERT INTO league (id, name) VALUES (39, 'Premier League'); INSERT INTO followed_league (league_id) VALUES (39);`
	);
	for (const i of items)
		for (const t of [i.teams!.home!, i.teams!.away!])
			await db.query('INSERT INTO team (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [t.id, t.name]);
	for (const i of items)
		await db.query(
			`INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id)
			 VALUES ($1, 39, 2023, $2::timestamptz, 'NS', $3, $4)`,
			[i.fixture!.id, i.fixture!.date, i.teams!.home!.id, i.teams!.away!.id]
		);
}

function counting(map: MockFixtures) {
	const calls: string[] = [];
	const proxy = new Proxy(map, {
		get(t, k, r) {
			if (typeof k === 'string' && k.startsWith('/injuries?')) calls.push(k);
			return Reflect.get(t, k, r);
		}
	});
	return { proxy, calls };
}

const run = (db: SqlExecutor, fixtures: MockFixtures, now: number) =>
	createDbIngestWorker(db, { fixtures })({ now: new Date(now), deadline: new Date(now + 60_000) });

const reports = async (db: SqlExecutor) =>
	(
		await db.query<{ fixture_id: number; player_id: number; team_id: number; type: string; c: string }>(
			`SELECT fixture_id, player_id, team_id, type, captured_at AS c FROM injury_report ORDER BY player_id`
		)
	).rows;

describe('injuries mock', () => {
	it('toInjuryRows: csak a kért meccsek, hiányos id kimarad, (meccs, játékos) egyedi', async () => {
		const items = await lastRound();
		const inj = syntheticInjuries(items);
		const wanted = new Set([items[0].fixture!.id!]);
		const { injuries, teams } = toInjuryRows([...inj, inj[0], { player: { id: 1 }, fixture: { id: 1 } }], wanted);
		expect(injuries.map((r) => r.playerId)).toEqual([990001, 990002]);
		expect(teams).toHaveLength(2);
	});

	it('envelope: a kért meccsek elemei; > 20 id → errors; ismeretlen köteg → mock-missing (nincs üres lista)', async () => {
		const items = await lastRound();
		const inj = syntheticInjuries(items);
		const [a, b] = items.map((i) => i.fixture!.id!);
		expect(injuriesByIdsEnvelope(`${b}-${a}`, inj).response.map((i) => i.player?.id)).toEqual([990003, 990001, 990002]);
		expect(injuriesByIdsEnvelope(Array.from({ length: 21 }, (_, i) => i + 1).join('-'), inj).errors).toEqual({
			ids: expect.any(String)
		});
		expect(withInjuries({}, inj)[fixtureKey('/injuries', { ids: '1-2' })]).toBeUndefined();
		const real = await loadIngestMocks(ROOT, new Date(K));
		expect(real[fixtureKey('/injuries', { ids: `${a}-${b}` })]).toBeUndefined(); // mentett /injuries nincs
	});
});

describe('injuries a workerben (mock, friss memória-PGlite)', () => {
	it('T−24 h után 1 hívás a 10 meccsre; a sérültlista a meccshez kötve, captured_at = now', async () => {
		const items = await lastRound();
		expect(items).toHaveLength(10);
		const { db } = await openMemoryRepository();
		await seedNs(db, items);
		const { proxy, calls } = counting(withInjuries({}, syntheticInjuries(items)));

		const early = await run(db, proxy, K - 25 * HOUR);
		expect(early.calls).toBe(0);
		expect(calls).toHaveLength(0); // T−24 h előtt nem fut

		const now = K - 23 * HOUR;
		await run(db, proxy, now);
		expect(calls).toHaveLength(1);
		expect(calls[0].split('ids=')[1].split('-')).toHaveLength(10);
		const tasks = (await new SqlTaskStore(db).list()).filter((t) => t.kind === 'injuries');
		expect(tasks.map((t) => [t.dedupeKey, t.status])).toEqual([['injuries:39:2024-05-19:0', 'done']]);

		const [a, b] = items;
		const rows = await reports(db);
		expect(rows.map((r) => [r.fixture_id, r.player_id, r.team_id, r.type])).toEqual([
			[a.fixture!.id, 990001, a.teams!.home!.id, 'Missing Fixture'],
			[a.fixture!.id, 990002, a.teams!.away!.id, 'Questionable'],
			[b.fixture!.id, 990003, b.teams!.home!.id, 'Missing Fixture']
		]);
		expect(rows.every((r) => new Date(r.c).getTime() === now)).toBe(true);
	});

	it('insert: ugyanaz a pillanat 0 új sor; ismeretlen meccs kimarad; mentett adat nélkül a feladat hibával zár', async () => {
		const items = await lastRound();
		const { db } = await openMemoryRepository();
		await seedNs(db, items);
		const { injuries } = toInjuryRows(syntheticInjuries(items), new Set(items.map((i) => i.fixture!.id!)));
		const at = new Date(K - 23 * HOUR);
		expect(await insertInjuries(db, injuries, at)).toBe(3);
		expect(await insertInjuries(db, injuries, at)).toBe(0);
		expect(await insertInjuries(db, [{ ...injuries[0], fixtureId: 1 }], at)).toBe(0);

		const { db: db2 } = await openMemoryRepository();
		await seedNs(db2, items);
		await run(db2, await loadIngestMocks(ROOT, new Date(K), () => new Date(K)), K - 23 * HOUR);
		const [task] = (await new SqlTaskStore(db2).list()).filter((t) => t.kind === 'injuries');
		expect(task.status).not.toBe('done');
		expect(await reports(db2)).toEqual([]);
	});
});
