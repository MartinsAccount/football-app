import { PGlite } from '@electric-sql/pglite';
import { SqlCronStore } from './cron';
import { migrate } from './migrate';

let store: SqlCronStore;

beforeAll(async () => {
	const db = new PGlite();
	await migrate(db);
	store = new SqlCronStore(db);
});

describe('SqlCronStore', () => {
	it('az advisory lock megszerezhető és elengedhető', async () => {
		expect(await store.tryLock()).toBe(true);
		await store.unlock();
		expect(await store.tryLock()).toBe(true);
		await store.unlock();
	});

	it('egy futás-sor életciklusa: running → ok, időtartammal', async () => {
		const id = await store.startRun(new Date('2026-11-16T10:00:00Z'));
		let [run] = await store.listRuns(1);
		expect(run).toMatchObject({ id, status: 'running', finishedAt: null });
		await store.finishRun(id, new Date('2026-11-16T10:00:01.500Z'), { status: 'ok', planned: 2, executed: 1, calls: 1 });
		[run] = await store.listRuns(1);
		expect(run).toMatchObject({
			id,
			status: 'ok',
			planned: 2,
			executed: 1,
			calls: 1,
			error: null,
			durationMs: 1500,
			startedAt: '2026-11-16T10:00:00.000Z',
			finishedAt: '2026-11-16T10:00:01.500Z'
		});
	});

	it('hiba és foglalt lock naplózása; a lista legújabb elöl', async () => {
		const id = await store.startRun(new Date('2026-11-16T10:15:00Z'));
		await store.finishRun(id, new Date('2026-11-16T10:15:00Z'), { status: 'error', error: 'boom' });
		const lockedId = await store.logLocked(new Date('2026-11-16T10:30:00Z'));
		const runs = await store.listRuns(3);
		expect(runs.map((r) => r.status)).toEqual(['locked', 'error', 'ok']);
		expect(runs[0]).toMatchObject({ id: lockedId, durationMs: 0, executed: 0 });
		expect(runs[1].error).toBe('boom');
	});
});
