import { authConfigFromEnv, authorize, hashToken, type AuthConfig } from './auth';

const TOKEN = 'teszt-token';
let hash: string;
const req = (authorization?: string) =>
	new Request('http://localhost/api/budget', { headers: authorization ? { authorization } : {} });

beforeAll(async () => {
	hash = await hashToken(TOKEN);
});

describe('authorize', () => {
	const cfg = (over: Partial<AuthConfig> = {}): AuthConfig => ({ tokenHash: hash, production: true, ...over });

	it('accepts the correct token (scheme case-insensitive, hash case-insensitive)', async () => {
		expect(await authorize(req(`Bearer ${TOKEN}`), cfg())).toEqual({ ok: true, via: 'bearer' });
		expect((await authorize(req(`bearer ${TOKEN}`), cfg({ tokenHash: hash.toUpperCase() }))).ok).toBe(true);
	});

	it('rejects a wrong token', async () => {
		expect(await authorize(req('Bearer rossz'), cfg())).toEqual({ ok: false, message: 'Érvénytelen token' });
	});

	it('rejects a missing token', async () => {
		expect(await authorize(req(), cfg())).toEqual({ ok: false, message: 'Hiányzó Bearer token' });
	});

	it('rejects a wrong scheme', async () => {
		expect(await authorize(req(`Basic ${TOKEN}`), cfg())).toMatchObject({ ok: false, message: 'Csak Bearer séma támogatott' });
		expect((await authorize(req(TOKEN), cfg())).ok).toBe(false);
	});

	it('rejects everything when the configured hash is malformed', async () => {
		expect((await authorize(req(`Bearer ${TOKEN}`), cfg({ tokenHash: 'abc' }))).ok).toBe(false);
	});

	it('without a hash: open in dev, fail-closed in production', async () => {
		expect(await authorize(req(), { tokenHash: null, production: false })).toEqual({ ok: true, via: 'open' });
		expect((await authorize(req(`Bearer ${TOKEN}`), { tokenHash: null, production: true })).ok).toBe(false);
	});

	it('any extra authorizer is enough (extension point for a web session)', async () => {
		const cookie = (r: Request) => r.headers.get('cookie') === 'session=ok';
		const withCookie = new Request('http://localhost/', { headers: { cookie: 'session=ok' } });
		expect(await authorize(withCookie, cfg({ authorizers: [cookie] }))).toEqual({ ok: true, via: 'authorizer' });
		expect((await authorize(req(), cfg({ authorizers: [cookie] }))).ok).toBe(false);
		expect((await authorize(withCookie, { production: true, authorizers: [cookie] })).ok).toBe(true);
	});
});

describe('authConfigFromEnv / hashToken', () => {
	it('reads the hash and production flag', () => {
		expect(authConfigFromEnv({ APP_API_TOKEN_HASH: ` ${'a'.repeat(64)} `, NODE_ENV: 'production' })).toEqual({
			tokenHash: 'a'.repeat(64),
			production: true
		});
		expect(authConfigFromEnv({ APP_API_TOKEN_HASH: '' })).toEqual({ tokenHash: null, production: false });
	});

	it('hashes to lowercase sha256 hex', async () => {
		expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
	});
});
