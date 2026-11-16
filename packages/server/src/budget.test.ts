import { SqlBudgetStore } from '@football/api-client';
import { openMemoryRepository, type SqlExecutor } from '@football/db';
import { EMPTY_BUDGET_DETAILS, loadBudgetDetails, MANUAL_JOB } from './budget';
import { createApiHandler } from './router';

let db: SqlExecutor;

const log = (at: string, endpoint: string, opts: { taskId?: number; mock?: boolean; quota?: number } = {}) =>
	db.query(
		`INSERT INTO api_call_log (called_at, endpoint, task_id, mock, quota_remaining_day) VALUES ($1::timestamptz, $2, $3, $4, $5)`,
		[at, endpoint, opts.taskId ?? null, opts.mock ?? false, opts.quota ?? null]
	);

beforeAll(async () => {
	({ db } = await openMemoryRepository());
	await db.query(`INSERT INTO ingest_task (id, dedupe_key, kind) VALUES (1, 'a', 'odds_late'), (2, 'b', 'standings')`);
	await log('2026-11-12T08:00:00Z', '/odds', { taskId: 1 });
	await log('2026-11-12T08:01:00Z', '/odds', { taskId: 1 });
	await log('2026-11-12T08:02:00Z', '/standings', { taskId: 2, mock: true });
	await log('2026-11-12T09:00:00Z', '/fixtures');
	await log('2026-11-12T07:00:00Z', '/status', { quota: 90 });
	await log('2026-11-12T09:30:00Z', '/status', { quota: 87 });
	await log('2026-11-11T23:59:59Z', '/odds', { taskId: 1 }); // tegnap (UTC) → kimarad
	await log('2026-11-13T00:00:00Z', '/status', { quota: 100 }); // holnap → kimarad
	await db.query(
		`INSERT INTO cron_run (started_at, status, calls) VALUES
			('2026-11-12T08:00:00Z', 'ok', 3), ('2026-11-12T09:00:00Z', 'locked', 0), ('2026-11-11T12:00:00Z', 'ok', 9)`
	);
});

describe('loadBudgetDetails', () => {
	it('groups the UTC day calls by job, picks the last /status and sums cron runs', async () => {
		expect(await loadBudgetDetails(db, '2026-11-12')).toEqual({
			jobs: [
				{ job: 'odds_late', live: 2, mock: 0 },
				{ job: MANUAL_JOB, live: 1, mock: 0 },
				{ job: 'standings', live: 0, mock: 1 }
			],
			status: { checkedAt: '2026-11-12T09:30:00.000Z', remainingAtCheck: 87 },
			cron: { runs: 2, calls: 3, lastAt: '2026-11-12T09:00:00.000Z', lastStatus: 'locked' }
		});
	});

	it('returns the empty breakdown for a day without data', async () => {
		expect(await loadBudgetDetails(db, '2026-10-01')).toEqual(EMPTY_BUDGET_DETAILS);
	});

	it('GET /api/budget carries the breakdown', async () => {
		const h = createApiHandler({
			repo: {} as never,
			budget: new SqlBudgetStore(db),
			budgetDetails: (day) => loadBudgetDetails(db, day),
			now: () => new Date('2026-11-12T10:00:00Z')
		});
		const body = (await (await h(new Request('http://localhost/api/budget'))).json()) as any;
		expect(body.jobs).toHaveLength(3);
		expect(body.status.remainingAtCheck).toBe(87);
		expect(body.cron.runs).toBe(2);
	});
});
