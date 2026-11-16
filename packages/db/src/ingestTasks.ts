import type {
	IngestTaskKind,
	IngestTaskStatus,
	PlannerInput,
	QueueTask,
	TaskFailureUpdate,
	TaskParamValue,
	TaskPlan
} from '@football/core';
import type { SqlExecutor } from './migrate';

/**
 * Feladat-tár az `ingest_task` táblán (ROADMAP 3.1b, architecture.md §7.1–§7.3). A szabályok (kiválasztás, backoff) a core
 * `ingest/queue.ts`-ben; itt csak az SQL. A becsült hívásszám a `params._estCalls` kulcsban él (nincs külön oszlop).
 */

export const EST_CALLS_PARAM = '_estCalls';

export interface StoredTask extends QueueTask {
	dedupeKey: string;
	params: Record<string, TaskParamValue>;
	lastError: string | null;
}

export interface TaskStore {
	/** Új tervek beszúrása; a meglévő `dedupe_key` kimarad. A ténylegesen beszúrt sorok száma. */
	enqueue(plans: readonly TaskPlan[], now: Date): Promise<number>;
	/** A lejárt határidejű `pending` sorok → `skipped`. */
	skipExpired(now: Date): Promise<number>;
	/** A `staleMs`-nél régebben `running` sorok → `pending` (megszakadt tick). */
	resetStale(now: Date, staleMs: number): Promise<number>;
	/** Az esedékes `pending` sorok (a végső kiválasztás a core `selectNextTask`-é). */
	listRunnable(now: Date, limit?: number): Promise<StoredTask[]>;
	/** `pending` → `running`; `false`, ha közben más elvitte. */
	claim(id: number, now: Date): Promise<boolean>;
	complete(id: number, now: Date): Promise<void>;
	fail(id: number, update: TaskFailureUpdate, now: Date): Promise<void>;
	list(status?: IngestTaskStatus): Promise<StoredTask[]>;
}

interface TaskRow {
	id: number;
	dedupeKey: string;
	kind: IngestTaskKind;
	params: Record<string, TaskParamValue> | string;
	priority: number;
	status: IngestTaskStatus;
	attempts: number;
	notBefore: unknown;
	deadline: unknown;
	lastError: string | null;
}

const SELECT = `SELECT id::float8 AS "id", dedupe_key AS "dedupeKey", kind, params, priority, status, attempts,
	not_before AS "notBefore", deadline, last_error AS "lastError" FROM ingest_task`;

const toDate = (v: unknown): Date => (v instanceof Date ? v : new Date(v as string));

const fromRow = (r: TaskRow): StoredTask => {
	const raw = typeof r.params === 'string' ? (JSON.parse(r.params) as Record<string, TaskParamValue>) : { ...r.params };
	const est = raw[EST_CALLS_PARAM];
	delete raw[EST_CALLS_PARAM];
	return {
		id: r.id,
		dedupeKey: r.dedupeKey,
		kind: r.kind,
		params: raw,
		priority: r.priority,
		status: r.status,
		attempts: r.attempts,
		notBefore: toDate(r.notBefore),
		deadline: r.deadline === null || r.deadline === undefined ? null : toDate(r.deadline),
		estCalls: typeof est === 'number' ? est : 1,
		lastError: r.lastError
	};
};

export class SqlTaskStore implements TaskStore {
	constructor(private readonly db: SqlExecutor) {}

	async enqueue(plans: readonly TaskPlan[], now: Date): Promise<number> {
		let inserted = 0;
		// TODO(polish): egy többsoros INSERT (unnest) a soronkénti helyett.
		for (const p of plans) {
			const { rows } = await this.db.query<{ id: number }>(
				`INSERT INTO ingest_task (dedupe_key, kind, params, priority, not_before, deadline, created_at, updated_at)
				 VALUES ($1, $2, $3::jsonb, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz, $7::timestamptz)
				 ON CONFLICT (dedupe_key) DO NOTHING RETURNING id::float8 AS id`,
				[
					p.dedupeKey,
					p.kind,
					JSON.stringify({ ...p.params, [EST_CALLS_PARAM]: p.estCalls }),
					p.priority,
					p.notBefore.toISOString(),
					p.deadline?.toISOString() ?? null,
					now.toISOString()
				]
			);
			inserted += rows.length;
		}
		return inserted;
	}

	async skipExpired(now: Date): Promise<number> {
		const { rows } = await this.db.query<{ id: number }>(
			`UPDATE ingest_task SET status = 'skipped', updated_at = $1::timestamptz
			 WHERE status = 'pending' AND deadline IS NOT NULL AND deadline <= $1::timestamptz RETURNING id::float8 AS id`,
			[now.toISOString()]
		);
		return rows.length;
	}

	async resetStale(now: Date, staleMs: number): Promise<number> {
		const { rows } = await this.db.query<{ id: number }>(
			`UPDATE ingest_task SET status = 'pending', updated_at = $1::timestamptz
			 WHERE status = 'running' AND updated_at <= $2::timestamptz RETURNING id::float8 AS id`,
			[now.toISOString(), new Date(now.getTime() - staleMs).toISOString()]
		);
		return rows.length;
	}

	async listRunnable(now: Date, limit = 500): Promise<StoredTask[]> {
		const { rows } = await this.db.query<TaskRow>(
			`${SELECT} WHERE status = 'pending' AND not_before <= $1::timestamptz
			   AND (deadline IS NULL OR deadline > $1::timestamptz)
			 ORDER BY priority, deadline NULLS LAST, not_before, id LIMIT $2`,
			[now.toISOString(), limit]
		);
		return rows.map(fromRow);
	}

	async claim(id: number, now: Date): Promise<boolean> {
		const { rows } = await this.db.query<{ id: number }>(
			`UPDATE ingest_task SET status = 'running', updated_at = $2::timestamptz
			 WHERE id = $1 AND status = 'pending' RETURNING id::float8 AS id`,
			[id, now.toISOString()]
		);
		return rows.length === 1;
	}

	async complete(id: number, now: Date): Promise<void> {
		await this.db.query(`UPDATE ingest_task SET status = 'done', last_error = NULL, updated_at = $2::timestamptz WHERE id = $1`, [
			id,
			now.toISOString()
		]);
	}

	async fail(id: number, u: TaskFailureUpdate, now: Date): Promise<void> {
		await this.db.query(
			`UPDATE ingest_task SET status = $2, attempts = $3, not_before = $4::timestamptz, last_error = $5,
				updated_at = $6::timestamptz WHERE id = $1`,
			[id, u.status, u.attempts, u.notBefore.toISOString(), u.lastError, now.toISOString()]
		);
	}

	async list(status?: IngestTaskStatus): Promise<StoredTask[]> {
		const { rows } = status
			? await this.db.query<TaskRow>(`${SELECT} WHERE status = $1 ORDER BY id`, [status])
			: await this.db.query<TaskRow>(`${SELECT} ORDER BY id`);
		return rows.map(fromRow);
	}
}

/** Free tier: csak 2022–2024 (ADR-0002) – ha a DB nem ad szezont. */
export const DEFAULT_PLANNER_SEASON = 2024;

/**
 * A planner bemenete a DB-ből: az engedélyezett követett ligák (szezon: `season.is_current` → legnagyobb meccs-szezon →
 * `defaultSeason`) és az ablakbeli meccsek (kezdés −72 h … +horizont +24 h, hogy a horizont szélén
 * kezdődő meccsnap egészben meglegyen – a planner az első kezdés szerint szűr).
 */
export async function loadPlannerInput(
	db: SqlExecutor,
	now: Date,
	opts: { horizonHours?: number; defaultSeason?: number } = {}
): Promise<PlannerInput> {
	const horizonHours = opts.horizonHours ?? 72;
	const { rows: leagues } = await db.query<{ id: number; season: number | null }>(
		`SELECT fl.league_id::float8 AS id,
			COALESCE(
				(SELECT max(s.year) FROM season s WHERE s.league_id = fl.league_id AND s.is_current),
				(SELECT max(f.season) FROM fixture f WHERE f.league_id = fl.league_id)
			) AS season
		 FROM followed_league fl WHERE fl.enabled ORDER BY fl.priority, fl.league_id`
	);
	const ids = leagues.map((l) => l.id);
	const { rows: fixtures } = ids.length
		? await db.query<{ id: number; leagueId: number; kickoff: unknown; status: string; round: string | null }>(
				`SELECT id::float8 AS id, league_id::float8 AS "leagueId", kickoff_at AS kickoff, status, round FROM fixture
				 WHERE league_id = ANY($1::bigint[]) AND kickoff_at >= $2::timestamptz AND kickoff_at <= $3::timestamptz`,
				[
					ids,
					new Date(now.getTime() - 72 * 3_600_000).toISOString(),
					new Date(now.getTime() + (horizonHours + 24) * 3_600_000).toISOString()
				]
		  )
		: { rows: [] };
	return {
		now,
		horizonHours,
		leagues: leagues.map((l) => ({ id: l.id, season: l.season ?? opts.defaultSeason ?? DEFAULT_PLANNER_SEASON })),
		fixtures: fixtures.map((f) => ({ ...f, kickoff: toDate(f.kickoff) }))
	};
}
