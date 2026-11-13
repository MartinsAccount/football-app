/**
 * A service worker cache-szabálya (ADR-0010, terv: docs/plans/mobile.md M1).
 * A `public/sw.js` ugyanezt a szabályt tartalmazza másolatként (a SW nem importálhat TS-t);
 * a `cacheStrategy.test.ts` a két változatot ugyanazon esettáblán összeveti.
 */
export type CacheStrategy = 'network-only' | 'network-first' | 'navigate' | 'cache-first';

export interface ICacheRequest {
	method: string;
	url: string;
	/** `Request.mode` – 'navigate' az oldalbetöltés. */
	mode?: string;
}

// SW-SHARED-START
function pickStrategy(req, origin) {
	if (req.method !== 'GET') return 'network-only';
	var u = new URL(req.url, origin);
	if (u.origin !== origin) return 'network-only';
	var p = u.pathname;
	if (p === '/sw.js') return 'network-only';
	if (p.indexOf('/api/') === 0) return 'network-first';
	if (req.mode === 'navigate') return 'navigate';
	if (/\.json$/i.test(p)) return 'network-first';
	return 'cache-first';
}
// SW-SHARED-END

/**
 * Melyik stratégiát kapja egy kérés.
 * - nem GET vagy idegen origin (pl. közvetlen API-Football) → network-only (nem cache-elünk)
 * - `/api/*` és `*.json` (fixture-adat, manifest) → network-first + cache-fallback (offline olvasás)
 * - oldalbetöltés → network-first, offline a precache-elt `index.html` (SPA-útvonalak)
 * - minden más azonos originű GET (hash-elt build-assetek, ikonok) → cache-first
 */
export function cacheStrategy(req: ICacheRequest, origin: string): CacheStrategy {
	return pickStrategy(req, origin) as CacheStrategy;
}
