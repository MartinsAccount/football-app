import { PGlite } from '@electric-sql/pglite';
import { onTaskFailure, planTasks, type TaskPlan } from '@football/core';
import { loadPlannerInput, SqlTaskStore } from './ingestTasks';
import { migrate } from './migrate';

const NOW = new Date('2026-11-16T10:00:00Z');
const H = 3_600_000;

let db: PGlite;
let store: SqlTaskStore;

beforeEach(async () => {
	db = new PGlite();
	await migrate(db);
	store = new SqlTaskStore(db);
});

const plan = (key: string, over: Partial<TaskPlan> = {}): TaskPlan => ({
	kind: 'reference',
	dedupeKey: key,
	params: { endpoint: 'odds/bets' },
	priority: 4,
	notBefore: NOW,
	deadline: null,
	estCalls: 1,
	...over
});

describe('SqlTaskStore', () => {
	it('enqueue: dedupe_key ütközésnél nem duplikál; estCalls a params-ban, olvasáskor leválik', async () => {
		expect(await store.enqueue([plan('a', { estCalls: 3 }), plan('b')], NOW)).toBe(2);
		expect(await store.enqueue([plan('a'), plan('c')], NOW)).toBe(1);
		const all = await store.list();
		expect(all.map((t) => [t.dedupeKey, t.estCalls, t.status])).toEqual([
			['a', 3, 'pending'],
			['b', 1, 'pending'],
			['c', 1, 'pending']
		]);
		expect(all[0].params).toEqual({ endpoint: 'odds/bets' });
	});

	it('listRunnable / skipExpired: esedékesség és határidő', async () => {
		await store.enqueue(
			[
				plan('later', { notBefore: new Date(NOW.getTime() + H) }),
				plan('expired', { notBefore: new Date(NOW.getTime() - 2 * H), deadline: new Date(NOW.getTime() - H) }),
				plan('odds', { kind: 'odds_late', priority: 1, deadline: new Date(NOW.getTime() + H) }),
				plan('ref')
			],
			new Date(NOW.getTime() - 3 * H)
		);
		expect((await store.listRunnable(NOW)).map((t) => t.dedupeKey)).toEqual(['odds', 'ref']);
		expect(await store.skipExpired(NOW)).toBe(1);
		expect((await store.list('skipped')).map((t) => t.dedupeKey)).toEqual(['expired']);
	});

	it('claim egyszer sikerül; complete, fail és a beragadt running visszaállítása', async () => {
		await store.enqueue([plan('a'), plan('b'), plan('c')], NOW);
		const [a, b, c] = await store.list();
		expect(await store.claim(a.id, NOW)).toBe(true);
		expect(await store.claim(a.id, NOW)).toBe(false);
		await store.complete(a.id, NOW);

		await store.claim(b.id, NOW);
		await store.fail(b.id, onTaskFailure(b, { kind: 'transient', message: 'HTTP 503' }, NOW), NOW);
		const failed = (await store.list()).find((t) => t.id === b.id)!;
		expect(failed).toMatchObject({ status: 'pending', attempts: 1, lastError: 'transient: HTTP 503' });
		expect(failed.notBefore.getTime()).toBe(NOW.getTime() + 15 * 60_000);

		await store.claim(c.id, NOW);
		expect(await store.resetStale(new Date(NOW.getTime() + 5 * 60_000), 10 * 60_000)).toBe(0);
		expect(await store.resetStale(new Date(NOW.getTime() + 11 * 60_000), 10 * 60_000)).toBe(1);
		expect((await store.list()).map((t) => t.status)).toEqual(['done', 'pending', 'pending']);
	});
});

describe('loadPlannerInput', () => {
	it('engedélyezett követett ligák szezonnal és az ablakbeli meccsek → planner', async () => {
		await db.exec(`
			INSERT INTO league (id, name) VALUES (39, 'Premier League'), (140, 'La Liga'), (78, 'Bundesliga');
			INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B');
			INSERT INTO season (league_id, year, is_current) VALUES (39, 2024, true);
			INSERT INTO followed_league (league_id) VALUES (39), (140);
			INSERT INTO followed_league (league_id, enabled) VALUES (78, false);
			INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id) VALUES
				(1001, 39, 2024, '2026-11-17T15:00:00Z', 'NS', 1, 2),
				(1002, 39, 2024, '2026-12-30T15:00:00Z', 'NS', 1, 2),
				(1003, 78, 2024, '2026-11-17T15:00:00Z', 'NS', 1, 2);
		`);
		const input = await loadPlannerInput(db, NOW);
		expect(input.leagues).toEqual([
			{ id: 39, season: 2024 },
			{ id: 140, season: 2024 }
		]);
		expect(input.fixtures.map((f) => f.id)).toEqual([1001]);
		expect(input.fixtures[0].kickoff.toISOString()).toBe('2026-11-17T15:00:00.000Z');
		const keys = planTasks(input).map((t) => t.dedupeKey);
		expect(keys).toContain('odds_late:39:2026-11-17');
	});
});
