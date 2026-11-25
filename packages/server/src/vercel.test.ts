import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openMemoryRepository, SqlCronStore } from '@football/db';
import { hashToken } from './auth';
import { hashPassword } from './session';
import { createVercelHandler, lazyExecutor, type ClosableExecutor } from './vercel';

const TOKEN = 'tok-123';
const SECRET = 'cron-secret-0123456789';
const AT = new Date('2026-11-25T10:00:00Z');
const EMPTY_DATA = mkdtempSync(join(tmpdir(), 'vercel-data-'));

/** Egy közös PGlite; az `openDb` kérésenként „nyit” (számlál), a `close` nem zárja le ténylegesen. */
async function setup(env: Record<string, string | undefined>, opts: { failOpen?: boolean; throwSync?: boolean } = {}) {
	const { db } = await openMemoryRepository();
	const stats = { opened: 0, closed: 0 };
	const asyncOpen = async (): Promise<ClosableExecutor> => {
		if (opts.failOpen) throw new Error('connect ECONNREFUSED');
		stats.opened++;
		return {
			exec: (sql) => db.exec(sql),
			query: (sql, params) => db.query(sql, params),
			close: async () => void stats.closed++
		};
	};
	// A valódi opener (`openPg(readDatabaseUrl())`) hiányzó env-nél szinkron dob.
	const openDb = (): Promise<ClosableExecutor> => {
		if (opts.throwSync) throw new Error('DATABASE_URL hiányzik');
		return asyncOpen();
	};
	const handler = createVercelHandler({ env, openDb, dataDir: EMPTY_DATA, now: () => AT });
	return { db, stats, handler };
}

const req = (path: string, init: { token?: string; method?: string } = {}) =>
	new Request(`https://example.vercel.app${path}`, {
		method: init.method ?? 'GET',
		headers: init.token ? { authorization: `Bearer ${init.token}` } : undefined
	});

describe('createVercelHandler', () => {
	it('fail-closed: hash nélkül 401, NODE_ENV=development mellett is, és nem nyit DB-t', async () => {
		const { handler, stats } = await setup({ NODE_ENV: 'development' });
		const res = await handler(req('/api/budget'));
		expect(res.status).toBe(401);
		expect(stats.opened).toBe(0);
	});

	it('helyes Bearer → 200, a kapcsolatot a válasz után zárja', async () => {
		const { handler, stats } = await setup({ APP_API_TOKEN_HASH: await hashToken(TOKEN) });
		expect((await handler(req('/api/fixtures'))).status).toBe(401);
		const res = await handler(req('/api/fixtures', { token: TOKEN }));
		expect(res.status).toBe(200);
		expect(stats).toEqual({ opened: 1, closed: 1 });
	});

	it('tick: CRON_SECRET nélkül 401; titokkal no-op futás (mock worker nincs)', async () => {
		const closed = await setup({});
		expect((await closed.handler(req('/api/cron/tick', { method: 'POST' }))).status).toBe(401);

		const { handler, db } = await setup({ CRON_SECRET: SECRET });
		expect((await handler(req('/api/cron/tick', { method: 'POST', token: 'rossz' }))).status).toBe(401);
		const res = await handler(req('/api/cron/tick', { method: 'POST', token: SECRET }));
		expect(res.status).toBe(200);
		expect(await res.json()).toMatchObject({ status: 'ok', planned: 0, executed: 0, calls: 0 });
		// GET is megy (külső pinger / klasszikus cron), és a lock felszabadult.
		expect(await (await handler(req('/api/cron/tick', { token: SECRET }))).json()).toMatchObject({ status: 'ok' });
		expect((await new SqlCronStore(db).listRuns()).map((r) => r.status)).toEqual(['ok', 'ok']);
	});

	it('elérhetetlen DB → 503, a cím nélkül', async () => {
		const { handler } = await setup({ APP_API_TOKEN_HASH: await hashToken(TOKEN) }, { failOpen: true });
		const res = await handler(req('/api/fixtures', { token: TOKEN }));
		expect(res.status).toBe(503);
		expect(await res.json()).toEqual({ error: 'internal', message: 'Az adatbázis nem érhető el' });
	});

	it('hiányzó DATABASE_URL (szinkron dobó opener) → 503, nem 500', async () => {
		const { handler } = await setup({ APP_API_TOKEN_HASH: await hashToken(TOKEN) }, { throwSync: true });
		expect((await handler(req('/api/fixtures', { token: TOKEN }))).status).toBe(503);
	});

	it('web-login: session-állapot → belépés → a süti a védett végpontot is nyitja; a logout törli a sütit', async () => {
		const env = { APP_PASSWORD_HASH: await hashPassword('admin-jelszo-123', { iterations: 1000 }), SESSION_SECRET: SECRET };
		const { handler, stats } = await setup(env);
		const session = await handler(req('/api/session'));
		expect(await session.json()).toEqual({ authenticated: false, loginEnabled: true });
		expect((await handler(req('/api/fixtures'))).status).toBe(401);
		expect(stats.opened).toBe(0);

		const login = await handler(
			new Request('https://example.vercel.app/api/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password: 'admin-jelszo-123' })
			})
		);
		expect(login.status).toBe(200);
		const setCookie = login.headers.get('set-cookie')!;
		expect(setCookie).toContain('Secure'); // a Vercel-handler mindig production
		const cookie = { cookie: setCookie.split(';')[0] };

		expect(await (await handler(new Request('https://example.vercel.app/api/session', { headers: cookie }))).json()).toEqual({
			authenticated: true,
			loginEnabled: true
		});
		expect((await handler(new Request('https://example.vercel.app/api/fixtures', { headers: cookie }))).status).toBe(200);
		const out = await handler(new Request('https://example.vercel.app/api/logout', { method: 'POST' }));
		expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
	});

	it('web-login env nélkül: loginEnabled false, a login 503', async () => {
		const { handler } = await setup({});
		expect(await (await handler(req('/api/session'))).json()).toEqual({ authenticated: false, loginEnabled: false });
		expect((await handler(req('/api/login', { method: 'POST' }))).status).toBe(503);
	});

	it('pillanatkép-fájl hiányában a végpont 404 (nem 500)', async () => {
		const { handler } = await setup({ APP_API_TOKEN_HASH: await hashToken(TOKEN) });
		expect((await handler(req('/api/backtest', { token: TOKEN }))).status).toBe(404);
	});
});

describe('lazyExecutor', () => {
	it('csak az első lekérdezés nyit, a close csak megnyitottat zár', async () => {
		let opens = 0;
		let closes = 0;
		const ex = lazyExecutor(async () => {
			opens++;
			return { exec: async () => undefined, query: async () => ({ rows: [] }), close: async () => void closes++ };
		});
		await ex.close();
		expect([opens, closes, ex.opened()]).toEqual([0, 0, false]);
		await ex.query('select 1');
		await ex.query('select 2');
		await ex.close();
		expect([opens, closes]).toEqual([1, 1]);
	});
});
