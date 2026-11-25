import {
	createLoginHandler,
	createLoginLimiter,
	createSessionAuthorizer,
	hashPassword,
	readCookie,
	SESSION_COOKIE,
	signSession,
	verifyPassword,
	verifySession,
	type SessionConfig
} from './session';

const AT = new Date('2026-11-25T12:00:00Z');
const SECRET = 'session-secret-0123456789';
// Kevés iteráció, hogy a teszt gyors legyen; a formátum ugyanaz.
const fastHash = (pw: string) => hashPassword(pw, { iterations: 1000 });

const loginReq = (body: unknown, ip = '1.2.3.4', path = '/api/login') =>
	new Request(`https://x.test${path}`, {
		method: 'POST',
		headers: { 'content-type': 'application/json', 'x-real-ip': ip },
		body: typeof body === 'string' ? body : JSON.stringify(body)
	});

async function config(): Promise<SessionConfig> {
	return { passwordHash: await fastHash('helyes-jelszo-123'), secret: SECRET, secure: true };
}

describe('jelszó-hash', () => {
	it('helyes jelszó igaz, hibás és sérült hash hamis; a só miatt két hash különbözik', async () => {
		const h = await fastHash('titok-jelszo-1');
		expect(h).toMatch(/^pbkdf2-sha256\$1000\$[\w-]+\$[\w-]+$/);
		expect(await verifyPassword('titok-jelszo-1', h)).toBe(true);
		expect(await verifyPassword('titok-jelszo-2', h)).toBe(false);
		expect(await verifyPassword('titok-jelszo-1', 'sha1$x')).toBe(false);
		expect(await fastHash('titok-jelszo-1')).not.toBe(h);
	});
});

describe('session-süti', () => {
	it('aláírt, le nem járt érték érvényes; lejárt, hamisított vagy más titokkal írt nem', async () => {
		const exp = AT.getTime() / 1000 + 60;
		const value = await signSession(SECRET, exp);
		expect(await verifySession(SECRET, value, AT)).toBe(true);
		expect(await verifySession(SECRET, value, new Date(AT.getTime() + 61_000))).toBe(false);
		expect(await verifySession('masik-titok-0123456789', value, AT)).toBe(false);
		expect(await verifySession(SECRET, `${exp + 3600}.${value.split('.')[1]}`, AT)).toBe(false);
		expect(await verifySession(SECRET, 'szemet', AT)).toBe(false);
	});

	it('readCookie a több süti közül a nevesítettet adja', () => {
		const req = new Request('https://x.test/', { headers: { cookie: `a=1; ${SESSION_COOKIE}=v.sig; b=2` } });
		expect(readCookie(req, SESSION_COOKIE)).toBe('v.sig');
		expect(readCookie(req, 'nincs')).toBeNull();
	});
});

describe('createLoginHandler', () => {
	it('helyes jelszó → 200 + HttpOnly/Secure/SameSite=Strict süti, amit az authorizer elfogad', async () => {
		const cfg = await config();
		const res = await createLoginHandler(cfg, { now: () => AT })(loginReq({ password: 'helyes-jelszo-123' }));
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ authenticated: true });
		const cookie = res.headers.get('set-cookie')!;
		expect(cookie.split('; ')).toEqual([
			expect.stringMatching(/^oe_session=\d+\.[\w-]+$/),
			'Path=/api',
			'HttpOnly',
			'SameSite=Strict',
			`Max-Age=${30 * 24 * 3600}`,
			'Secure'
		]);

		const value = cookie.split(';')[0];
		const authed = new Request('https://x.test/api/budget', { headers: { cookie: value } });
		expect(await createSessionAuthorizer(cfg, () => AT)(authed)).toBe(true);
		expect(await createSessionAuthorizer(cfg, () => AT)(new Request('https://x.test/api/budget'))).toBe(false);
	});

	it('hibás jelszó 401; 5 hiba után ugyanarról az IP-ről 429, másik IP-ről még mehet', async () => {
		const handler = createLoginHandler(await config(), { now: () => AT, limiter: createLoginLimiter(5, 60_000) });
		for (let i = 0; i < 5; i++) expect((await handler(loginReq({ password: 'rossz' }))).status).toBe(401);
		const blocked = await handler(loginReq({ password: 'helyes-jelszo-123' }));
		expect(blocked.status).toBe(429);
		expect(blocked.headers.get('retry-after')).toBe('60');
		expect((await handler(loginReq({ password: 'helyes-jelszo-123' }, '5.6.7.8'))).status).toBe(200);
	});

	it('hibás törzs 400, GET 405, beállítás nélkül 503, logout törli a sütit', async () => {
		const handler = createLoginHandler(await config(), { now: () => AT });
		expect((await handler(loginReq('nem json'))).status).toBe(400);
		expect((await handler(loginReq({}))).status).toBe(400);
		expect((await handler(new Request('https://x.test/api/login'))).status).toBe(405);
		const off = createLoginHandler({ passwordHash: null, secret: null, secure: false });
		expect((await off(loginReq({ password: 'x' }))).status).toBe(503);
		const out = await handler(loginReq({}, '1.2.3.4', '/api/logout'));
		expect(out.status).toBe(200);
		expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
	});
});
