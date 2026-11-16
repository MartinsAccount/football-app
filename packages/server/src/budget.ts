import type { BudgetCronDto, BudgetJobDto, BudgetStatusCheckDto } from '@football/contract';
import type { SqlExecutor } from '@football/db';

/** A Budget-panel részletei (I19, ROADMAP 2.4); a `GET /api/budget` a napi számláló mellé teszi. */
export interface BudgetDetails {
	jobs: BudgetJobDto[];
	status: BudgetStatusCheckDto;
	cron: BudgetCronDto;
}

export const EMPTY_BUDGET_DETAILS: BudgetDetails = {
	jobs: [],
	status: { checkedAt: null, remainingAtCheck: null },
	cron: { runs: 0, calls: 0, lastAt: null, lastStatus: null }
};

/** Feladat nélküli (kézi/szkriptből indított) hívás job-neve. */
export const MANUAL_JOB = 'manual';

const iso = (x: unknown): string | null =>
	x == null ? null : x instanceof Date ? x.toISOString() : new Date(String(x)).toISOString();
const int = (x: unknown): number => Number(x ?? 0);

/**
 * A mai (UTC) nap hívásai jobonként (`api_call_log` ⟕ `ingest_task.kind`), a legutóbbi `/status` és a `cron_run` összesítő.
 * A `/status` nem fogy a kvótából, ezért a jobok közül kimarad. Csak olvas.
 */
export async function loadBudgetDetails(db: SqlExecutor, day: string): Promise<BudgetDetails> {
	const range = [day];
	const DAY = `$1::date::timestamp AT TIME ZONE 'UTC'`;
	const IN_DAY = (col: string) => `${col} >= ${DAY} AND ${col} < (${DAY} + interval '1 day')`;
	const [jobs, status, cron] = await Promise.all([
		db.query<{ job: string; live: unknown; mock: unknown }>(
			`SELECT COALESCE(t.kind, '${MANUAL_JOB}') AS job,
				count(*) FILTER (WHERE NOT l.mock) AS live, count(*) FILTER (WHERE l.mock) AS mock
			 FROM api_call_log l LEFT JOIN ingest_task t ON t.id = l.task_id
			 WHERE ${IN_DAY('l.called_at')} AND l.endpoint <> '/status'
			 GROUP BY 1 ORDER BY 2 DESC, 3 DESC, 1`,
			range
		),
		db.query<{ called_at: unknown; quota_remaining_day: number | null }>(
			`SELECT called_at, quota_remaining_day FROM api_call_log
			 WHERE ${IN_DAY('called_at')} AND endpoint = '/status' ORDER BY called_at DESC, id DESC LIMIT 1`,
			range
		),
		db.query<{ runs: unknown; calls: unknown; last_at: unknown; last_status: string | null }>(
			`SELECT count(*) AS runs, COALESCE(sum(calls), 0) AS calls, max(started_at) AS last_at,
				(SELECT status FROM cron_run WHERE ${IN_DAY('started_at')} ORDER BY started_at DESC, id DESC LIMIT 1) AS last_status
			 FROM cron_run WHERE ${IN_DAY('started_at')}`,
			range
		)
	]);
	const s = status.rows[0];
	const c = cron.rows[0];
	return {
		jobs: jobs.rows.map((r) => ({ job: r.job, live: int(r.live), mock: int(r.mock) })),
		status: { checkedAt: iso(s?.called_at), remainingAtCheck: s?.quota_remaining_day ?? null },
		cron: { runs: int(c?.runs), calls: int(c?.calls), lastAt: iso(c?.last_at), lastStatus: c?.last_status ?? null }
	};
}
