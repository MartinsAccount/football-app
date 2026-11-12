import { openMemoryRepository } from '@football/db';
import { SqlBudgetStore, SqlCallLogger, utcDay } from './stores';

describe('SQL budget store and call logger (PGlite)', () => {
	it('reserves atomically up to the limit, syncs, and logs calls', async () => {
		const { db } = await openMemoryRepository();
		await db.query("INSERT INTO api_budget_day (day, daily_limit, reserve) VALUES ('2026-11-12', 3, 1)");
		const budget = new SqlBudgetStore(db);

		expect(await budget.reserve('2026-11-12')).toBe(1);
		expect(await budget.reserve('2026-11-12')).toBe(2);
		expect(await budget.reserve('2026-11-12')).toBeNull();
		expect(await budget.usage('2026-11-12')).toEqual({ used: 2, limit: 3, reserve: 1, syncedRemaining: null });

		await budget.sync('2026-11-13', 1);
		expect(await budget.reserve('2026-11-13')).toBe(1);
		expect(await budget.reserve('2026-11-13')).toBeNull();
		expect(await budget.usage('2026-11-14')).toMatchObject({ used: 0, limit: 100 });

		const logger = new SqlCallLogger(db);
		await logger.log({
			endpoint: '/odds',
			params: { league: '39' },
			httpStatus: 200,
			errors: { plan: 'x' },
			results: 0,
			pagingTotal: 1,
			quotaRemainingDay: 42,
			rateRemainingMin: null,
			durationMs: 12.6,
			mock: false
		});
		const { rows } = await db.query<{ endpoint: string; params: unknown; errors: unknown; duration_ms: number }>(
			'SELECT endpoint, params, errors, duration_ms FROM api_call_log'
		);
		expect(rows).toEqual([{ endpoint: '/odds', params: { league: '39' }, errors: { plan: 'x' }, duration_ms: 13 }]);
		await db.close();
	});

	it('uses the UTC day', () => {
		expect(utcDay(new Date('2026-11-12T23:30:00-02:00'))).toBe('2026-11-13');
	});
});
