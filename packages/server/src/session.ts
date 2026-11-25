import type { ApiErrorBody, ApiErrorCode, SessionResponse } from '@football/contract';
import type { Authorizer } from './auth';

/**
 * Web-login (I31, ROADMAP 1.6b; docs/plans/i31-web-login.md). Egyfelhasználós: egy jelszó, aminek a PBKDF2-hash-e az
 * `APP_PASSWORD_HASH` env-ben él; a belépés állapotmentes, HMAC-aláírt sütit ad (`SESSION_SECRET`). Web Crypto, így Node-on
 * és Vercelen is fut. A mobil továbbra is Bearer tokent használ (`auth.ts`).
 */

export const SESSION_COOKIE = 'oe_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 3600;
export const PBKDF2_ITERATIONS = 210_000;
/** Ennyi hibás próbálkozás után az IP `LOGIN_WINDOW_MS`-ig 429-et kap. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60_000;
const MAX_PASSWORD_LENGTH = 1024;

export interface SessionConfig {
	/** `pbkdf2-sha256$<iter>$<salt>$<hash>`; hiányában nincs bejelentkezés. */
	passwordHash: string | null;
	/** A süti-aláírás kulcsa; hiányában nincs bejelentkezés. */
	secret: string | null;
	/** `Secure` süti-attribútum (productionben igen; a lokális http-dev-ben nem). */
	secure: boolean;
	ttlSeconds?: number;
}

export function sessionConfigFromEnv(env: Record<string, string | undefined>): SessionConfig {
	return {
		passwordHash: env.APP_PASSWORD_HASH?.trim() || null,
		secret: env.SESSION_SECRET?.trim() || null,
		secure: env.NODE_ENV === 'production'
	};
}

export const sessionEnabled = (c: SessionConfig): boolean => Boolean(c.passwordHash && c.secret);

const enc = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
	const s = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
	return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
	return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
	return new Uint8Array(bits);
}

/** A jelszó hash-e az `APP_PASSWORD_HASH`-hoz (`npm run password -w @football/server`). */
export async function hashPassword(password: string, opts: { salt?: Uint8Array; iterations?: number } = {}): Promise<string> {
	const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16));
	const iterations = opts.iterations ?? PBKDF2_ITERATIONS;
	return `pbkdf2-sha256$${iterations}$${toB64url(salt)}$${toB64url(await pbkdf2(password, salt, iterations))}`;
}

/** Időzítés-biztos ellenőrzés; hibás formátumú hash → `false`. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const m = /^pbkdf2-sha256\$(\d{1,7})\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(stored.trim());
	if (!m) return false;
	const salt = fromB64url(m[2]);
	const expected = fromB64url(m[3]);
	if (!salt || !expected) return false;
	return bytesEqual(await pbkdf2(password, salt, Number(m[1])), expected);
}

const hmacKey = (secret: string) =>
	crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

/** Süti-érték: `<lejárat epoch mp>.<HMAC>`. */
export async function signSession(secret: string, expiresAt: number): Promise<string> {
	const payload = String(expiresAt);
	const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload)));
	return `${payload}.${toB64url(sig)}`;
}

export async function verifySession(secret: string, value: string, now: Date): Promise<boolean> {
	const m = /^(\d{1,12})\.([A-Za-z0-9_-]+)$/.exec(value);
	if (!m || Number(m[1]) * 1000 <= now.getTime()) return false;
	const sig = fromB64url(m[2]);
	if (!sig) return false;
	return crypto.subtle.verify('HMAC', await hmacKey(secret), sig, enc.encode(m[1]));
}

export function readCookie(req: Request, name: string): string | null {
	for (const part of (req.headers.get('cookie') ?? '').split(';')) {
		const i = part.indexOf('=');
		if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
	}
	return null;
}

function cookieHeader(config: SessionConfig, value: string, maxAge: number): string {
	return [`${SESSION_COOKIE}=${value}`, 'Path=/api', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAge}`]
		.concat(config.secure ? ['Secure'] : [])
		.join('; ');
}

/** `auth.ts` bővítési pont: érvényes, le nem járt, aláírt süti → engedélyezett. */
export function createSessionAuthorizer(config: SessionConfig, now: () => Date = () => new Date()): Authorizer {
	return async (req) => {
		if (!config.secret) return false;
		const value = readCookie(req, SESSION_COOKIE);
		return value ? verifySession(config.secret, value, now()) : false;
	};
}

/** Hibás belépések IP-nként, a példány memóriájában (Fluid-példányonként külön). TODO(polish): DB-alapú számláló. */
export function createLoginLimiter(max = LOGIN_MAX_FAILURES, windowMs = LOGIN_WINDOW_MS) {
	const failures = new Map<string, number[]>();
	const recent = (key: string, at: number) => (failures.get(key) ?? []).filter((t) => at - t < windowMs);
	return {
		/** Hátralévő tiltás ms-ban (0 = mehet). */
		blockedFor(key: string, at: number): number {
			const list = recent(key, at);
			failures.set(key, list);
			return list.length >= max ? windowMs - (at - list[0]) : 0;
		},
		fail(key: string, at: number) {
			failures.set(key, [...recent(key, at), at]);
		},
		reset(key: string) {
			failures.delete(key);
		}
	};
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
	});

const fail = (status: number, error: ApiErrorCode, message: string, headers: Record<string, string> = {}) =>
	json(status, { error, message } satisfies ApiErrorBody, headers);

const clientKey = (req: Request): string =>
	req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'ismeretlen';

/** `POST /api/login` és `POST /api/logout`. A router az app-auth ELŐTT hívja (különben be sem lehetne lépni). */
export function createLoginHandler(
	config: SessionConfig,
	opts: { now?: () => Date; limiter?: ReturnType<typeof createLoginLimiter> } = {}
): (req: Request) => Promise<Response> {
	const now = opts.now ?? (() => new Date());
	const limiter = opts.limiter ?? createLoginLimiter();
	const ttl = config.ttlSeconds ?? SESSION_TTL_SECONDS;

	return async (req) => {
		const path = new URL(req.url).pathname.replace(/\/+$/, '');
		if (req.method !== 'POST') return fail(405, 'method', 'Csak POST engedélyezett');
		if (path === '/api/logout')
			return json(200, { authenticated: false } satisfies Pick<SessionResponse, 'authenticated'>, {
				'set-cookie': cookieHeader(config, '', 0)
			});
		if (path !== '/api/login') return fail(404, 'not-found', `Ismeretlen végpont: ${path}`);
		if (!sessionEnabled(config))
			return fail(503, 'internal', 'A szerveren nincs beállítva bejelentkezés (APP_PASSWORD_HASH, SESSION_SECRET)');

		const at = now().getTime();
		const key = clientKey(req);
		const wait = limiter.blockedFor(key, at);
		if (wait > 0) {
			const minutes = Math.ceil(wait / 60_000);
			return fail(429, 'rate-limited', `Túl sok hibás próbálkozás, próbáld újra ${minutes} perc múlva`, {
				'retry-after': String(Math.ceil(wait / 1000))
			});
		}

		let password: unknown;
		try {
			password = ((await req.json()) as { password?: unknown })?.password;
		} catch {
			return fail(400, 'bad-request', 'A törzs nem érvényes JSON');
		}
		if (typeof password !== 'string' || password.length === 0 || password.length > MAX_PASSWORD_LENGTH)
			return fail(400, 'bad-request', 'Hiányzó jelszó');

		if (!(await verifyPassword(password, config.passwordHash!))) {
			limiter.fail(key, at);
			return fail(401, 'unauthorized', 'Hibás jelszó');
		}
		limiter.reset(key);
		const value = await signSession(config.secret!, Math.floor(at / 1000) + ttl);
		return json(200, { authenticated: true } satisfies Pick<SessionResponse, 'authenticated'>, {
			'set-cookie': cookieHeader(config, value, ttl)
		});
	};
}
