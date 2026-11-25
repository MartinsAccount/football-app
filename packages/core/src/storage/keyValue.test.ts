import { describe, expect, it } from 'vitest';
import {
	KeyValueStorage,
	loadStored,
	loadStoredSync,
	memoryKeyValueStorage,
	parseJsonOrNull,
	saveStored,
	saveStoredSync,
	StoredValueCodec
} from './keyValue';

const flag: StoredValueCodec<string> = {
	key: 'flag',
	decode: (raw) => raw ?? 'default',
	encode: (value) => (value === 'default' ? null : value)
};

describe('memoryKeyValueStorage', () => {
	it('serves the async and the sync API from the same data', async () => {
		const s = memoryKeyValueStorage({ a: '1' });
		expect(await s.getItem('a')).toBe('1');
		await s.setItem('b', '2');
		expect(s.getItemSync('b')).toBe('2');
		s.removeItemSync('a');
		expect(await s.getItem('a')).toBeNull();
		expect(s.snapshot()).toEqual({ b: '2' });
	});
});

describe('stored values', () => {
	it('round-trips through a codec and removes the key on a null encoding', async () => {
		const s = memoryKeyValueStorage();
		expect(await loadStored(s, flag)).toBe('default');
		await saveStored(s, flag, 'on');
		expect(s.snapshot()).toEqual({ flag: 'on' });
		expect(loadStoredSync(s, flag)).toBe('on');
		saveStoredSync(s, flag, 'default');
		expect(s.snapshot()).toEqual({});
	});

	it('falls back to the default when the storage cannot be read', async () => {
		const broken: KeyValueStorage = {
			getItem: () => Promise.reject(new Error('denied')),
			setItem: () => Promise.resolve(),
			removeItem: () => Promise.resolve()
		};
		expect(await loadStored(broken, flag)).toBe('default');
		const brokenSync = {
			...memoryKeyValueStorage(),
			getItemSync: () => {
				throw new Error('denied');
			}
		};
		expect(loadStoredSync(brokenSync, flag)).toBe('default');
	});

	it('parses JSON leniently', () => {
		expect(parseJsonOrNull('{"a":1}')).toEqual({ a: 1 });
		expect(parseJsonOrNull('{broken')).toBeNull();
		expect(parseJsonOrNull('')).toBeNull();
		expect(parseJsonOrNull(null)).toBeNull();
	});
});
