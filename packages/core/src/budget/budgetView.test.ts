import { budgetJobLabel, budgetTone, budgetView, reconcileBudget, type IBudgetInput } from './budgetView';

const NOW = new Date('2026-11-12T10:00:00Z');

const input = (o: Partial<IBudgetInput> = {}): IBudgetInput => ({
	day: '2026-11-12',
	used: 12,
	limit: 100,
	reserve: 3,
	syncedRemaining: null,
	remaining: 85,
	jobs: [
		{ job: 'odds_late', live: 8, mock: 0 },
		{ job: 'manual', live: 4, mock: 2 }
	],
	status: { checkedAt: null, remainingAtCheck: null },
	cron: { runs: 0, calls: 0, lastAt: null, lastStatus: null },
	...o
});

describe('budgetView', () => {
	it('formats the pill, stats, meter and job rows', () => {
		const v = budgetView(input(), NOW);
		expect(v.pill).toBe('12/100 hívás');
		expect(v.usedPct).toBe(12);
		expect(v.tone).toBe('ok');
		expect(v.stats.map((s) => s.value)).toEqual(['12', '85', '3']);
		expect(v.jobs).toEqual([
			{ key: 'odds_late', label: 'Késői odds', live: '8', mock: null },
			{ key: 'manual', label: 'Kézi / szkript', live: '4', mock: '2' }
		]);
		expect(v.cron).toBe('Ma még nem futott az ütemező.');
	});

	it('summarizes cron runs with the last time (Budapest) and a non-ok status', () => {
		const v = budgetView(input({ cron: { runs: 3, calls: 7, lastAt: '2026-11-12T09:15:00Z', lastStatus: 'locked' } }), NOW);
		expect(v.cron).toBe('3 ütemező-futás, 7 hívás · utolsó ma 10:15 (locked)');
	});

	it('clamps the meter and tones by the remaining share', () => {
		expect(budgetView(input({ used: 100, remaining: 0 }), NOW)).toMatchObject({ usedPct: 100, tone: 'danger' });
		expect(budgetTone(30, 100)).toBe('warning');
		expect(budgetTone(31, 100)).toBe('ok');
		expect(budgetTone(10, 100)).toBe('danger');
		expect(budgetTone(5, 0)).toBe('danger');
	});

	it('keeps unknown job kinds as-is', () => {
		expect(budgetJobLabel('something_new')).toBe('something_new');
	});
});

describe('reconcileBudget', () => {
	it('without saved /status data falls back to the local counter', () => {
		expect(reconcileBudget(input(), NOW).state).toBe('none');
	});

	it('matches when limit − used equals the synced remaining', () => {
		const r = reconcileBudget(
			input({ syncedRemaining: 88, status: { checkedAt: '2026-11-12T07:30:00Z', remainingAtCheck: 95 } }),
			NOW
		);
		expect(r).toEqual({ state: 'match', text: 'Egyezik a /status-szal (ma 08:30).' });
	});

	it('reports drift in both directions', () => {
		expect(reconcileBudget(input({ syncedRemaining: 80 }), NOW)).toEqual({
			state: 'drift',
			text: 'A /status szerint 8 hívással kevesebb maradt – a kulcsot más is használja.'
		});
		expect(reconcileBudget(input({ syncedRemaining: 90 }), NOW).text).toBe('A /status szerint 2 hívással több maradt.');
	});
});
