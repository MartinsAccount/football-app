import type { SqlExecutor } from './migrate';

/**
 * Ütemező-tár (ROADMAP 1.7, architecture.md §7.2): a tick advisory lockja és a `cron_run` napló.
 * A lock session-szintű (`pg_try_advisory_lock`), ezért a lock és az unlock ugyanazon a kapcsolaton fusson
 * (`openPg` egy klienst ad; Supabase-en a Session pooler kell, a Transaction pooler nem tartja a sessiont).
 * Egy kapcsolaton belül a lock újra-belépő: a folyamaton belüli átfedést a hívó (`runTick`) őrzi.
 */

/** Fix lock-kulcs a tickhez (tetszőleges bigint, csak egyedi legyen az appban). */
export const CRON_LOCK_KEY = 7_001_001;

export type CronRunStatus = 'running' | 'ok' | 'locked' | 'error';

export interface CronRunResult {
	planned: number;
	executed: number;
	calls: number;
}

export interface CronRun extends CronRunResult {
	id: number;
	startedAt: string;
	finishedAt: string | null;
	status: CronRunStatus;
	error: string | null;
	durationMs: number | null;
}

export interface CronStore {
	tryLock(): Promise<boolean>;
	unlock(): Promise<void>;
	startRun(at: Date): Promise<number>;
	finishRun(id: number, at: Date, outcome: { status: 'ok' | 'error'; error?: string } & Partial<CronRunResult>): Promise<void>;
	/** Foglalt lock miatt kihagyott tick naplózása (azonnal lezárt sor). */
	logLocked(at: Date): Promise<number>;
	/** A legutóbbi futások, legújabb elöl. */
	listRuns(limit?: number): Promise<CronRun[]>;
}

const RUN_SELECT = `SELECT id::float8 AS "id", started_at AS "startedAt", finished_at AS "finishedAt", status,
	planned, executed, calls, error, duration_ms AS "durationMs" FROM cron_run`;

const iso = (v: unknown): string | null => (v === null || v === undefined ? null : new Date(v as string).toISOString());

export class SqlCronStore implements CronStore {
	constructor(private readonly db: SqlExecutor) {}

	async tryLock(): Promise<boolean> {
		const { rows } = await this.db.query<{ ok: boolean }>('SELECT pg_try_advisory_lock($1::bigint) AS ok', [CRON_LOCK_KEY]);
		return rows[0]?.ok === true;
	}

	async unlock(): Promise<void> {
		await this.db.query('SELECT pg_advisory_unlock($1::bigint)', [CRON_LOCK_KEY]);
	}

	async startRun(at: Date): Promise<number> {
		const { rows } = await this.db.query<{ id: number }>(
			`INSERT INTO cron_run (started_at) VALUES ($1::timestamptz) RETURNING id::float8 AS id`,
			[at.toISOString()]
		);
		return rows[0].id;
	}

	async finishRun(
		id: number,
		at: Date,
		outcome: { status: 'ok' | 'error'; error?: string } & Partial<CronRunResult>
	): Promise<void> {
		await this.db.query(
			`UPDATE cron_run SET finished_at = $2::timestamptz, status = $3, planned = $4, executed = $5, calls = $6, error = $7,
				duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM ($2::timestamptz - started_at)) * 1000)::integer)
			 WHERE id = $1`,
			[
				id,
				at.toISOString(),
				outcome.status,
				outcome.planned ?? 0,
				outcome.executed ?? 0,
				outcome.calls ?? 0,
				outcome.error ?? null
			]
		);
	}

	async logLocked(at: Date): Promise<number> {
		const { rows } = await this.db.query<{ id: number }>(
			`INSERT INTO cron_run (started_at, finished_at, status, duration_ms) VALUES ($1::timestamptz, $1::timestamptz, 'locked', 0)
			 RETURNING id::float8 AS id`,
			[at.toISOString()]
		);
		return rows[0].id;
	}

	async listRuns(limit = 100): Promise<CronRun[]> {
		const { rows } = await this.db.query<CronRun>(`${RUN_SELECT} ORDER BY started_at DESC, id DESC LIMIT $1`, [limit]);
		return rows.map((r) => ({ ...r, startedAt: iso(r.startedAt)!, finishedAt: iso(r.finishedAt) }));
	}
}
