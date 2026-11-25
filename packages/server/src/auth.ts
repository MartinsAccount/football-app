/**
 * Hozzáférés-védelem (ADR-0005, ROADMAP 11.3): egyfelhasználós `Authorization: Bearer <token>`, ahol a token
 * sha256-hash-e (hex) az `APP_API_TOKEN_HASH` env-ben él. Web-standard (Web Crypto), így Node-on és Vercelen is fut.
 * Bővítési pont: `authorizers` – több hitelesítő közül bármelyik elég (pl. a későbbi web-session cookie).
 */

/** További hitelesítő (pl. cookie-session); `true` = a kérés engedélyezett. */
export type Authorizer = (req: Request) => Promise<boolean> | boolean;

export interface AuthConfig {
	/** A Bearer token sha256-hash-e hexben; hiányában csak nem-production környezetben nyitott az API. */
	tokenHash?: string | null;
	/** `true` → fail-closed: védelem nélkül minden kérés 401. */
	production: boolean;
	/** További hitelesítők; bármelyik sikere elég. */
	authorizers?: Authorizer[];
}

export type AuthResult = { ok: true; via: 'bearer' | 'authorizer' | 'open' } | { ok: false; message: string };

const HEX64 = /^[0-9a-f]{64}$/i;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/** A token sha256-hash-e kisbetűs hexben (ezt kell az `APP_API_TOKEN_HASH`-be tenni). */
export async function hashToken(token: string): Promise<string> {
	return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))));
}

/** Időzítés-biztos összevetés két azonos hosszú (64 hex karakteres) hash között. */
function hashesEqual(a: string, b: string): boolean {
	const x = a.toLowerCase();
	const y = b.toLowerCase();
	if (x.length !== y.length) return false;
	let diff = 0;
	for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
	return diff === 0;
}

/** Env → `AuthConfig`. Production: `NODE_ENV === 'production'` (a Vercel-függvényekben ez az alap). */
export function authConfigFromEnv(env: Record<string, string | undefined>): AuthConfig {
	const tokenHash = env.APP_API_TOKEN_HASH?.trim() || null;
	return { tokenHash, production: env.NODE_ENV === 'production' };
}

export async function authorize(req: Request, config: AuthConfig): Promise<AuthResult> {
	const extra = config.authorizers ?? [];
	if (!config.tokenHash && extra.length === 0) {
		return config.production
			? { ok: false, message: 'A szerveren nincs beállítva hozzáférés-védelem (APP_API_TOKEN_HASH)' }
			: { ok: true, via: 'open' };
	}

	let message = 'Hiányzó Bearer token';
	const header = req.headers.get('authorization');
	if (config.tokenHash && header) {
		const m = /^(\S+)\s+(\S+)\s*$/.exec(header.trim());
		if (!m || m[1].toLowerCase() !== 'bearer') message = 'Csak Bearer séma támogatott';
		else if (!HEX64.test(config.tokenHash)) message = 'Érvénytelen token';
		else if (hashesEqual(await hashToken(m[2]), config.tokenHash)) return { ok: true, via: 'bearer' };
		else message = 'Érvénytelen token';
	}

	for (const a of extra) if (await a(req)) return { ok: true, via: 'authorizer' };
	return { ok: false, message };
}
