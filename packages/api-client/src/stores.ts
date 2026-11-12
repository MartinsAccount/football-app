import type { BudgetStore, CallLogEntry, CallLogger } from './types';

/** A budget napja UTC-nap (a kvóta 00:00 UTC-kor nullázódik). */
export function utcDay(now: Date): string {
	return now.toISOString().slice(0, 10);
}

/** Memóriabeli budget (teszt, mock, egyszeri script). Ugyanazt a szabályt követi, mint az `api_budget_reserve()`. */
export class MemoryBudgetStore implements BudgetStore {
	private days = new Map<string, { used: number; syncedRemaining: number | null }>();

	constructor(private readonly limit = 100, private readonly reserveCalls = 0) {
		if (limit < 0 || limit > 100) throw new RangeError('daily limit must be 0–100');
	}

	private day(day: string) {
		let d = this.days.get(day);
		if (!d) this.days.set(day, (d = { used: 0, syncedRemaining: null }));
		return d;
	}

	async reserve(day: string, cap?: number): Promise<number | null> {
		const d = this.day(day);
		if (d.used >= this.limit - this.reserveCalls) return null;
		if (cap != null && d.used >= cap) return null;
		if (d.syncedRemaining != null && d.syncedRemaining <= 0) return null;
		d.used += 1;
		if (d.syncedRemaining != null) d.syncedRemaining -= 1;
		return d.used;
	}

	async sync(day: string, remaining: number): Promise<void> {
		this.day(day).syncedRemaining = remaining;
	}

	async usage(day: string) {
		const d = this.day(day);
		return { used: d.used, limit: this.limit, reserve: this.reserveCalls, syncedRemaining: d.syncedRemaining };
	}
}

export class MemoryCallLogger implements CallLogger {
	readonly entries: CallLogEntry[] = [];
	async log(entry: CallLogEntry): Promise<void> {
		this.entries.push(entry);
	}
}

/** Strukturálisan a `@football/db` `SqlExecutor`-ával egyezik (PGlite, később `pg`). */
export interface SqlQuery {
	query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Budget az `api_budget_day` tábla és az atomikus `api_budget_reserve()` fölött (migrations/0005_ops.sql). */
export class SqlBudgetStore implements BudgetStore {
	constructor(private readonly db: SqlQuery) {}

	async reserve(day: string, cap?: number): Promise<number | null> {
		const { rows } = await this.db.query<{ used: number | null }>('SELECT api_budget_reserve($1::date, $2::integer) AS used', [
			day,
			cap ?? null
		]);
		return rows[0]?.used ?? null;
	}

	async sync(day: string, remaining: number): Promise<void> {
		await this.db.query(
			`INSERT INTO api_budget_day (day, synced_remaining) VALUES ($1::date, $2)
			 ON CONFLICT (day) DO UPDATE SET synced_remaining = EXCLUDED.synced_remaining`,
			[day, remaining]
		);
	}

	async usage(day: string) {
		const { rows } = await this.db.query<{ used: number; daily_limit: number; reserve: number; synced_remaining: number | null }>(
			'SELECT used, daily_limit, reserve, synced_remaining FROM api_budget_day WHERE day = $1::date',
			[day]
		);
		const r = rows[0];
		return r
			? { used: r.used, limit: r.daily_limit, reserve: r.reserve, syncedRemaining: r.synced_remaining }
			: { used: 0, limit: 100, reserve: 0, syncedRemaining: null };
	}
}

/** Hívásnapló az `api_call_log` táblába. */
export class SqlCallLogger implements CallLogger {
	constructor(private readonly db: SqlQuery) {}

	async log(e: CallLogEntry): Promise<void> {
		await this.db.query(
			`INSERT INTO api_call_log (endpoint, params, http_status, errors, results, paging_total, quota_remaining_day,
				rate_remaining_min, duration_ms, task_id, mock)
			 VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11)`,
			[
				e.endpoint,
				JSON.stringify(e.params),
				e.httpStatus,
				e.errors == null ? null : JSON.stringify(e.errors),
				e.results,
				e.pagingTotal,
				e.quotaRemainingDay,
				e.rateRemainingMin,
				Math.round(e.durationMs),
				e.taskId ?? null,
				e.mock
			]
		);
	}
}
