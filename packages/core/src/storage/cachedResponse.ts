// Utolsó sikeres válasz cache-elése (ROADMAP 11.6, offline mód): hálózati hiba esetén a mentett válasz jelenik meg
// „offline – utolsó frissítés: …” jelzéssel. Platformfüggetlen: a `KeyValueStorage`-ra épül (mobil: AsyncStorage).

import { parseJsonOrNull, type KeyValueStorage } from './keyValue';

/** A tárolt borítékolt válasz. `savedAt`: ISO 8601 (UTC). */
export interface CachedEnvelope<T> {
	savedAt: string;
	data: T;
}

export type CachedResult<T> =
	| { source: 'network'; data: T; savedAt: string }
	| { source: 'cache'; data: T; savedAt: string; error: unknown }
	| { source: 'none'; error: unknown };

const isEnvelope = (x: unknown): x is CachedEnvelope<unknown> =>
	typeof x === 'object' &&
	x !== null &&
	typeof (x as CachedEnvelope<unknown>).savedAt === 'string' &&
	!Number.isNaN(Date.parse((x as CachedEnvelope<unknown>).savedAt)) &&
	'data' in x;

/** Sérült / hiányzó / olvashatatlan cache → `null` (sosem dob). A `data` alakját a hívó felel érte. */
export const readCached = async <T>(storage: KeyValueStorage, key: string): Promise<CachedEnvelope<T> | null> => {
	try {
		const parsed = parseJsonOrNull(await storage.getItem(key));
		return isEnvelope(parsed) ? (parsed as CachedEnvelope<T>) : null;
	} catch {
		return null;
	}
};

/**
 * Hálózatról tölt; siker esetén elmenti (a mentés hibája nem buktatja a választ). Hiba esetén a cache-ből ad,
 * ha van, különben `source: 'none'` a hibával.
 */
export const loadWithCache = async <T>(
	storage: KeyValueStorage,
	key: string,
	fetcher: () => Promise<T>,
	now: () => Date = () => new Date()
): Promise<CachedResult<T>> => {
	try {
		const data = await fetcher();
		const savedAt = now().toISOString();
		try {
			await storage.setItem(key, JSON.stringify({ savedAt, data } satisfies CachedEnvelope<T>));
		} catch {
			// tele / olvashatatlan tároló: a friss válasz attól még megjelenik
		}
		return { source: 'network', data, savedAt };
	} catch (error) {
		const cached = await readCached<T>(storage, key);
		if (cached) return { source: 'cache', data: cached.data, savedAt: cached.savedAt, error };
		return { source: 'none', error };
	}
};
