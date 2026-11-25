import { ApiFootballClient, ApiFootballError, SqlBudgetStore } from '@football/api-client';
import { loadPlannerInput, openMemoryRepository, SqlCronStore, SqlTaskStore } from '@football/db';
import { createTickRunner } from './cron';
import { createIngestWorker, toFailureKind, type TaskHandler } from './ingestWorker';

const AT = new Date('2026-11-16T10:00:00Z');

async function setup() {
	const { db } = await openMemoryRepository();
	await db.exec(`
		INSERT INTO league (id, name) VALUES (39, 'Premier League');
		INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B');
		INSERT INTO followed_league (league_id) VALUES (39);
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id) VALUES
			(1001, 39, 2024, '2026-11-16T12:00:00Z', 'NS', 1, 2);
	`);
	const tasks = new SqlTaskStore(db);
	const budget = new SqlBudgetStore(db);
	return { db, tasks, budget, cron: new SqlCronStore(db), plannerInput: (now: Date) => loadPlannerInput(db, now) };
}

describe('toFailureKind', () => {
	it('api-client hibafajta → core sor-hibafajta', () => {
		const err = (kind: ConstructorParameters<typeof ApiFootballError>[0], httpStatus?: number) =>
			new ApiFootballError(kind, 'x', { endpoint: '/odds', httpStatus });
		expect(toFailureKind(err('budget'))).toBe('budget');
		expect(toFailureKind(err('quota'))).toBe('quota');
		expect(toFailureKind(err('plan'))).toBe('plan');
		expect(toFailureKind(err('token'))).toBe('token');
		expect(toFailureKind(err('http', 503))).toBe('transient');
		expect(toFailureKind(err('http', 429))).toBe('transient');
		expect(toFailureKind(err('http', 404))).toBe('permanent');
		expect(toFailureKind(err('api'))).toBe('permanent');
		expect(toFailureKind(err('mock-missing'))).toBe('permanent');
		expect(toFailureKind(new Error('ECONNRESET'))).toBe('transient');
	});
});

describe('createIngestWorker a tickben', () => {
	it('két tick nem duplikál: a második 0 új feladatot tervez és 0-t futtat', async () => {
		const { tasks, budget, cron, plannerInput } = await setup();
		const client = new ApiFootballClient({ mode: 'mock', fixtures: {} });
		const tick = createTickRunner({
			store: cron,
			now: () => AT,
			worker: createIngestWorker({ tasks, budget, plannerInput, client })
		});

		const first = await tick();
		expect(first).toMatchObject({ status: 'ok', calls: 0 });
		const planned = (first as { planned: number }).planned;
		expect(planned).toBeGreaterThan(0);
		const all = await tasks.list();
		expect(all).toHaveLength(planned);
		expect(new Set(all.map((t) => t.dedupeKey)).size).toBe(planned);
		expect(all.map((t) => t.dedupeKey)).toContain('odds_late:39:2026-11-16');

		expect(await tick()).toMatchObject({ status: 'ok', planned: 0, executed: 0 });
		expect(await tasks.list()).toHaveLength(planned);
		const runs = await cron.listRuns();
		expect(runs[1]).toMatchObject({ status: 'ok', planned, executed: (first as { executed: number }).executed });
	});

	it('a budget-plafont tartja: kevés keretnél megáll, a maradék pending marad', async () => {
		const { db, tasks, budget, plannerInput } = await setup();
		await db.query(`INSERT INTO api_budget_day (day, used) VALUES ('2026-11-16', 97)`);
		const spend: TaskHandler = async (task) => {
			for (let i = 0; i < (task.estCalls ?? 1); i++)
				if ((await budget.reserve('2026-11-16')) === null)
					throw new ApiFootballError('budget', 'nincs keret', { endpoint: '/odds' });
			return { calls: task.estCalls ?? 1 };
		};
		const handlers = Object.fromEntries(
			['odds_late', 'injuries', 'fixtures_window', 'reference', 'standings'].map((k) => [k, spend])
		);
		const worker = createIngestWorker({ tasks, budget, plannerInput, handlers });

		const res = await worker({ now: AT, deadline: new Date(AT.getTime() + 240_000) });
		expect(res).toMatchObject({ executed: 3, calls: 3 });
		expect((await budget.usage('2026-11-16')).used).toBe(100);
		// A legfontosabb kettő (odds_late, injuries) lefutott; a pending sorok a következő napra várnak.
		const done = (await tasks.list('done')).map((t) => t.kind);
		expect(done.slice(0, 2).sort()).toEqual(['injuries', 'odds_late']);
		expect((await tasks.list('pending')).length).toBeGreaterThan(0);
		expect(await worker({ now: AT, deadline: new Date(AT.getTime() + 240_000) })).toMatchObject({ executed: 0, calls: 0 });
	});

	it('hibánál a core szabálya szerint zár: plan → failed, 503 → backoff, budget → következő UTC-nap', async () => {
		const { tasks, budget, plannerInput } = await setup();
		const fail =
			(e: Error): TaskHandler =>
			async () => {
				throw e;
			};
		const worker = createIngestWorker({
			tasks,
			budget,
			plannerInput,
			handlers: {
				odds_late: fail(new ApiFootballError('plan', 'plan: free', { endpoint: '/odds' })),
				injuries: fail(new ApiFootballError('http', 'HTTP 503', { endpoint: '/injuries', httpStatus: 503 })),
				reference: fail(new ApiFootballError('budget', 'nincs keret', { endpoint: '/teams' }))
			}
		});
		await worker({ now: AT, deadline: new Date(AT.getTime() + 240_000) });
		const byKind = (kind: string) => tasks.list().then((ts) => ts.filter((t) => t.kind === kind));
		expect(await byKind('odds_late')).toMatchObject([{ status: 'failed', attempts: 1, lastError: 'plan: plan: free' }]);
		const [inj] = await byKind('injuries');
		expect(inj).toMatchObject({ status: 'pending', attempts: 1 });
		expect(inj.notBefore.toISOString()).toBe('2026-11-16T10:15:00.000Z');
		for (const t of await byKind('reference'))
			expect(t).toMatchObject({ status: 'pending', attempts: 0, notBefore: new Date('2026-11-17T00:00:00Z') });
		expect((await byKind('fixtures_window'))[0].status).toBe('done');
	});
});
