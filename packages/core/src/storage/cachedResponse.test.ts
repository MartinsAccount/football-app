import { describe, expect, it } from 'vitest';
import { loadWithCache, readCached } from './cachedResponse';
import { memoryKeyValueStorage, type KeyValueStorage } from './keyValue';

const KEY = 'oe_cache_fixtures';
const now = () => new Date('2026-11-13T10:00:00.000Z');
const fail = () => Promise.reject(new Error('offline'));

describe('loadWithCache', () => {
	it('returns and stores a fresh network response', async () => {
		const storage = memoryKeyValueStorage();
		const r = await loadWithCache(storage, KEY, async () => ({ n: 1 }), now);
		expect(r).toEqual({ source: 'network', data: { n: 1 }, savedAt: '2026-11-13T10:00:00.000Z' });
		expect(await readCached(storage, KEY)).toEqual({ savedAt: '2026-11-13T10:00:00.000Z', data: { n: 1 } });
	});

	it('falls back to the last successful response on error', async () => {
		const storage = memoryKeyValueStorage();
		await loadWithCache(storage, KEY, async () => ({ n: 1 }), now);
		const r = await loadWithCache(storage, KEY, fail, () => new Date('2026-11-14T00:00:00Z'));
		expect(r.source).toBe('cache');
		if (r.source === 'cache') {
			expect(r.data).toEqual({ n: 1 });
			expect(r.savedAt).toBe('2026-11-13T10:00:00.000Z');
			expect((r.error as Error).message).toBe('offline');
		}
	});

	it('reports none without a cache, and ignores a corrupt cache', async () => {
		expect((await loadWithCache(memoryKeyValueStorage(), KEY, fail)).source).toBe('none');
		const corrupt = memoryKeyValueStorage({ [KEY]: '{nem json' });
		expect((await loadWithCache(corrupt, KEY, fail)).source).toBe('none');
		const wrongShape = memoryKeyValueStorage({ [KEY]: JSON.stringify({ savedAt: 'tegnap', data: 1 }) });
		expect(await readCached(wrongShape, KEY)).toBeNull();
	});

	it('still returns the network response when saving fails', async () => {
		const broken: KeyValueStorage = {
			getItem: async () => null,
			setItem: async () => {
				throw new Error('quota');
			},
			removeItem: async () => undefined
		};
		expect((await loadWithCache(broken, KEY, async () => 42, now)).source).toBe('network');
	});
});
