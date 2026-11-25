import { expiredTaskIds, isRunnable, onTaskFailure, selectNextTask, type QueueTask } from './queue';

const at = (iso: string) => new Date(iso);
const now = at('2026-11-16T10:00:00Z');
const task = (p: Partial<QueueTask> & { id: number }): QueueTask => ({
	kind: 'reference',
	priority: 4,
	status: 'pending',
	attempts: 0,
	notBefore: at('2026-11-16T09:00:00Z'),
	deadline: null,
	...p
});

describe('selectNextTask', () => {
	it('a legmagasabb prioritást választja, azon belül a korábbi határidőt', () => {
		const tasks = [
			task({ id: 1, priority: 4 }),
			task({ id: 2, kind: 'odds_late', priority: 1, deadline: at('2026-11-16T18:00:00Z') }),
			task({ id: 3, kind: 'odds_late', priority: 1, deadline: at('2026-11-16T12:00:00Z') })
		];
		expect(selectNextTask(tasks, now)?.id).toBe(3);
	});

	it('kihagyja a nem esedékes, nem pending és lejárt feladatot', () => {
		const tasks = [
			task({ id: 1, priority: 1, notBefore: at('2026-11-16T11:00:00Z') }),
			task({ id: 2, priority: 1, status: 'done' }),
			task({ id: 3, priority: 1, deadline: at('2026-11-16T10:00:00Z') }),
			task({ id: 4, priority: 5 })
		];
		expect(selectNextTask(tasks, now)?.id).toBe(4);
		expect(selectNextTask([], now)).toBeNull();
	});

	it('kevés keretnél nem ugorja át a fontosabbat egy olcsóbbért', () => {
		const tasks = [task({ id: 1, priority: 1, estCalls: 3 }), task({ id: 2, priority: 4, estCalls: 1 })];
		expect(selectNextTask(tasks, now, 2)).toBeNull();
		expect(selectNextTask(tasks, now, 3)?.id).toBe(1);
	});
});

describe('határidő', () => {
	it('a lekésett pending feladat skipped-jelölt, a running és a lezárt nem', () => {
		const deadline = at('2026-11-16T09:59:00Z');
		const tasks = [
			task({ id: 1, deadline }),
			task({ id: 2, deadline, status: 'running' }),
			task({ id: 3, deadline, status: 'done' }),
			task({ id: 4, deadline: at('2026-11-16T11:00:00Z') }),
			task({ id: 5 })
		];
		expect(expiredTaskIds(tasks, now)).toEqual([1]);
		expect(isRunnable(tasks[0], now)).toBe(false);
	});
});

describe('onTaskFailure', () => {
	const t = { attempts: 0, notBefore: at('2026-11-16T09:00:00Z') };

	it('átmeneti hiba: exponenciális visszalépés, plafonnal', () => {
		expect(onTaskFailure(t, { kind: 'transient', message: 'HTTP 503' }, now)).toEqual({
			status: 'pending',
			attempts: 1,
			notBefore: at('2026-11-16T10:15:00Z'),
			lastError: 'transient: HTTP 503'
		});
		expect(onTaskFailure({ ...t, attempts: 1 }, { kind: 'transient', message: 'x' }, now).notBefore).toEqual(
			at('2026-11-16T10:30:00Z')
		);
		const capped = onTaskFailure({ ...t, attempts: 1 }, { kind: 'transient', message: 'x' }, now, {
			maxAttempts: 9,
			baseDelayMs: 60_000,
			maxDelayMs: 90_000
		});
		expect(capped.notBefore).toEqual(at('2026-11-16T10:01:30Z'));
	});

	it('maxAttempts után failed', () => {
		expect(onTaskFailure({ ...t, attempts: 4 }, { kind: 'transient', message: 'x' }, now)).toMatchObject({
			status: 'failed',
			attempts: 5
		});
	});

	it.each(['plan', 'token', 'permanent'] as const)('%s hiba nem ismétlődik (failed)', (kind) => {
		expect(onTaskFailure(t, { kind, message: 'm' }, now)).toMatchObject({ status: 'failed', notBefore: t.notBefore });
	});

	it.each(['quota', 'budget'] as const)('%s hiba: aznap nem, a következő UTC-napon újra, attempts nem nő', (kind) => {
		expect(onTaskFailure(t, { kind, message: 'm' }, now)).toMatchObject({
			status: 'pending',
			attempts: 0,
			notBefore: at('2026-11-17T00:00:00Z')
		});
	});
});
