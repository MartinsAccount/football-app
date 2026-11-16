import { SqlBudgetStore } from '@football/api-client';
import { openMemoryRepository, SqlCronStore } from '@football/db';
import { createCronHandler, createTickRunner, cronAuthorize, type TickWorker } from './cron';
import { createApiHandler } from './router';

const AT = new Date('2026-11-16T10:00:00Z');

async function setup() {
	const { db, repo } = await openMemoryRepository();
	return { db, repo, store: new SqlCronStore(db) };
}

const req = (path: string, init: RequestInit & { token?: string } = {}) =>
	new Request(`http://localhost${path}`, {
		...init,
		headers: init.token ? { authorization: `Bearer ${init.token}` } : undefined
	});

describe('cronAuthorize', () => {
	it('titok nélkül dev nyitott, production zárt', () => {
		expect(cronAuthorize(req('/api/cron/tick'), { production: false }).ok).toBe(true);
		expect(cronAuthorize(req('/api/cron/tick'), { production: true }).ok).toBe(false);
	});

	it('titokkal csak a helyes Bearer engedett', () => {
		const config = { secret: 's3cret', production: true };
		expect(cronAuthorize(req('/api/cron/tick', { token: 's3cret' }), config).ok).toBe(true);
		expect(cronAuthorize(req('/api/cron/tick', { token: 's3creT' }), config).ok).toBe(false);
		expect(cronAuthorize(req('/api/cron/tick'), config).ok).toBe(false);
	});
});

describe('createTickRunner', () => {
	it('no-op tick: ok sor a naplóban, a lock utána újra szabad', async () => {
		const { store } = await setup();
		const tick = createTickRunner({ store, now: () => AT });
		expect(await tick()).toMatchObject({ status: 'ok', planned: 0, executed: 0, calls: 0 });
		expect(await tick()).toMatchObject({ status: 'ok' });
		const runs = await store.listRuns();
		expect(runs.map((r) => r.status)).toEqual(['ok', 'ok']);
	});

	it('átfedő tick nem futtatja a workert, hanem locked sort ír', async () => {
		const { store } = await setup();
		let release!: () => void;
		let calls = 0;
		const worker: TickWorker = async () => {
			calls++;
			await new Promise<void>((r) => (release = r));
			return { planned: 1, executed: 1, calls: 0 };
		};
		const tick = createTickRunner({ store, worker, now: () => AT });
		const first = tick();
		await vi.waitFor(() => expect(calls).toBe(1));
		expect(await tick()).toMatchObject({ status: 'locked' });
		release();
		expect(await first).toMatchObject({ status: 'ok', executed: 1 });
		expect(calls).toBe(1);
		expect((await store.listRuns()).map((r) => r.status).sort()).toEqual(['locked', 'ok']);
	});

	it('foglalt DB-lock (másik példány) → locked', async () => {
		const { store } = await setup();
		vi.spyOn(store, 'tryLock').mockResolvedValueOnce(false);
		const worker = vi.fn(async () => ({ planned: 0, executed: 0, calls: 0 }));
		expect(await createTickRunner({ store, worker })()).toMatchObject({ status: 'locked' });
		expect(worker).not.toHaveBeenCalled();
	});

	it('worker-hiba → error sor, a lock felszabadul', async () => {
		const { store } = await setup();
		const unlock = vi.spyOn(store, 'unlock');
		const tick = createTickRunner({
			store,
			worker: async () => {
				throw new Error('boom');
			}
		});
		expect(await tick()).toMatchObject({ status: 'error', error: 'boom' });
		expect(unlock).toHaveBeenCalledTimes(1);
		expect((await store.listRuns(1))[0]).toMatchObject({ status: 'error', error: 'boom' });
	});
});

describe('/api/cron/tick', () => {
	it('a router az app-auth előtt a cron-kezelőhöz irányít; titok, metódus, útvonal', async () => {
		const { db, repo, store } = await setup();
		const handler = createApiHandler({
			repo,
			budget: new SqlBudgetStore(db),
			auth: { production: true, tokenHash: null },
			cron: createCronHandler({ store, config: { secret: 'tick-secret', production: true }, now: () => AT })
		});
		expect((await handler(req('/api/cron/tick'))).status).toBe(401);
		const ok = await handler(req('/api/cron/tick', { token: 'tick-secret' }));
		expect(ok.status).toBe(200);
		expect(await ok.json()).toMatchObject({ status: 'ok', planned: 0 });
		expect((await handler(req('/api/cron/tick', { token: 'tick-secret', method: 'POST' }))).status).toBe(200);
		expect((await handler(req('/api/cron/tick', { token: 'tick-secret', method: 'DELETE' }))).status).toBe(405);
		expect((await handler(req('/api/cron/other', { token: 'tick-secret' }))).status).toBe(404);
		// Az app-auth érvényben marad a többi végponton: a CRON_SECRET nem nyit meg semmit.
		expect((await handler(req('/api/budget', { token: 'tick-secret' }))).status).toBe(401);
		expect(await store.listRuns()).toHaveLength(2);
	});
});
