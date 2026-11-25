import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fixtureKey, type MockFixtures } from '@football/api-client';
import { openMemoryRepository, SqlTaskStore, type SqlExecutor } from '@football/db';
import type { ApiFixtureItem } from './fixturesWindow';
import { createDbIngestWorker } from './ingestWorker';
import { fixturesByIdsEnvelope, loadIngestMocks, withFixturesByIds } from './referenceMocks';
import { parseResultIds } from './results';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOUR = 3_600_000;
const K = Date.parse('2024-05-19T15:00:00Z'); // a 2023/24-es PL utolsó fordulója: 10 meccs egyszerre

/** A mentett 2023-as PL-szezon (mind `FT`). */
async function savedSeason(): Promise<ApiFixtureItem[]> {
	const json = JSON.parse(await readFile(`${ROOT}data/history/api-football/fixtures-39-2023.json`, 'utf8'));
	return (Array.isArray(json) ? json : json.response) as ApiFixtureItem[];
}

/** Liga, csapatok és a meccsek `NS` sorként (eredmény nélkül), a megadott kezdéssel. */
async function seedNs(db: SqlExecutor, items: readonly ApiFixtureItem[], kickoff: (i: ApiFixtureItem) => string) {
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
			[i.fixture!.id, kickoff(i), i.teams!.home!.id, i.teams!.away!.id]
		);
}

/** Számlálja a `/fixtures?ids=` mock-hívásokat. */
function counting(map: MockFixtures) {
	const calls: string[] = [];
	const proxy = new Proxy(map, {
		get(t, k, r) {
			if (typeof k === 'string' && k.startsWith('/fixtures?ids=')) calls.push(k);
			return Reflect.get(t, k, r);
		}
	});
	return { proxy, calls };
}

const run = (db: SqlExecutor, fixtures: MockFixtures, now: number) =>
	createDbIngestWorker(db, { fixtures })({ now: new Date(now), deadline: new Date(now + 60_000) });

const rows = async (db: SqlExecutor) =>
	(
		await db.query<{ id: number; status: string; goals_home: number | null; goals_away: number | null; k: string }>(
			`SELECT id, status, goals_home, goals_away, kickoff_at AS k FROM fixture ORDER BY id`
		)
	).rows;

describe('results mock', () => {
	it('ids: rendezett, egyedi; üres, hibás vagy > 20 → hiba', () => {
		expect(parseResultIds([3, 1, 3])).toEqual([1, 3]);
		expect(parseResultIds('5-2')).toEqual([2, 5]);
		expect(() => parseResultIds([])).toThrow();
		expect(() => parseResultIds([1.5])).toThrow();
		expect(() => parseResultIds(Array.from({ length: 21 }, (_, i) => i + 1))).toThrow();
	});

	it('az ids-envelope a mentett meccsekből jön; hiányzó id kimarad, > 20 id → errors', async () => {
		const items = await savedSeason();
		const [a, b] = items.map((i) => i.fixture!.id!);
		expect(fixturesByIdsEnvelope(`${b}-999-${a}`, items).response.map((i) => i.fixture?.id)).toEqual([b, a]);
		expect(
			fixturesByIdsEnvelope(
				items
					.slice(0, 21)
					.map((i) => i.fixture!.id)
					.join('-'),
				items
			).errors
		).toEqual({
			ids: expect.any(String)
		});
		const real = await loadIngestMocks(ROOT, new Date(K));
		expect(real[fixtureKey('/fixtures', { ids: `${a}-${b}` })]?.results).toBe(2);
		expect(real[fixtureKey('/fixtures', { ids: `${a}`, status: 'FT' })]).toBeUndefined();
	});
});

describe('results a workerben (mock, friss memória-PGlite)', () => {
	it('NS → FT eredménnyel; 25 meccs = 2 hívás (≤ ⌈n/20⌉), a kezdés a forrásból', async () => {
		const items = (await savedSeason()).slice(0, 25);
		const { db } = await openMemoryRepository();
		await seedNs(db, items, () => new Date(K).toISOString());
		const { proxy, calls } = counting(withFixturesByIds({}, items));

		const res = await run(db, proxy, K + 4 * HOUR);
		expect(res.calls).toBe(0); // mock: nincs keret-költés
		expect(calls).toHaveLength(Math.ceil(items.length / 20));
		const results = (await new SqlTaskStore(db).list()).filter((t) => t.kind === 'results');
		expect(results.map((t) => t.status)).toEqual(['done', 'done']);

		const byId = new Map(items.map((i) => [i.fixture!.id!, i]));
		for (const r of await rows(db)) {
			const src = byId.get(r.id)!;
			expect(r).toMatchObject({ status: 'FT', goals_home: src.goals!.home, goals_away: src.goals!.away });
			expect(new Date(r.k).getTime()).toBe(Date.parse(src.fixture!.date!));
		}
	});

	it('2. kör +26 h: az 1. körben még NS, utána FT; végleges meccsre nincs több results', async () => {
		const items = (await savedSeason()).filter((i) => Date.parse(i.fixture!.date!) === K);
		expect(items).toHaveLength(10);
		const { db } = await openMemoryRepository();
		await seedNs(db, items, (i) => i.fixture!.date!);
		const pending = items.map((i) => ({
			...i,
			fixture: { ...i.fixture!, status: { short: 'NS' } },
			goals: { home: null, away: null },
			score: {}
		}));

		await run(db, withFixturesByIds({}, pending), K + 4 * HOUR);
		expect(new Set((await rows(db)).map((r) => r.status))).toEqual(new Set(['NS']));

		const second = counting(withFixturesByIds({}, items));
		await run(db, second.proxy, K + 27 * HOUR);
		expect(second.calls).toHaveLength(1);
		expect((await rows(db)).every((r) => r.status === 'FT' && r.goals_home !== null)).toBe(true);
		const keys = (await new SqlTaskStore(db).list()).filter((t) => t.kind === 'results').map((t) => t.dedupeKey);
		expect(keys).toEqual(['results:39:2024-05-19T15:00:p1:0', 'results:39:2024-05-19T15:00:p2:0']);

		const third = counting(withFixturesByIds({}, items));
		await run(db, third.proxy, K + 30 * HOUR);
		expect(third.calls).toHaveLength(0);
	});
});
