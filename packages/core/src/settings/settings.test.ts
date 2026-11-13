import { describe, expect, it } from 'vitest';
import { loadStored, memoryKeyValueStorage, saveStored } from '../storage/keyValue';
import {
	DEFAULT_SETTINGS,
	migrateSettings,
	sameSettings,
	sanitizeSettings,
	SETTINGS_STORAGE_KEY,
	settingsCodec
} from './settings';

describe('settingsCodec', () => {
	it('keeps the existing localStorage key and the plain JSON format (v1)', () => {
		expect(SETTINGS_STORAGE_KEY).toBe('oe_settings');
		expect(settingsCodec.key).toBe('oe_settings');
		expect(JSON.parse(settingsCodec.encode(DEFAULT_SETTINGS) as string)).toEqual(DEFAULT_SETTINGS);
	});

	it('reads a saved v1 value and drops unknown or invalid fields', () => {
		const saved = JSON.stringify({ ...DEFAULT_SETTINGS, leagues: [39, 999], stakeUnit: 2000, minOdds: 'x' });
		const s = settingsCodec.decode(saved);
		expect(s.leagues).toEqual([39]);
		expect(s.stakeUnit).toBe(2000);
		expect(s.minOdds).toBe(DEFAULT_SETTINGS.minOdds);
	});

	it('falls back to the defaults on missing or corrupt data', () => {
		expect(settingsCodec.decode(null)).toEqual(DEFAULT_SETTINGS);
		expect(settingsCodec.decode('{not json')).toEqual(DEFAULT_SETTINGS);
		expect(settingsCodec.decode('42')).toEqual(DEFAULT_SETTINGS);
	});

	it('round-trips through an async KeyValueStorage', async () => {
		const storage = memoryKeyValueStorage();
		const next = sanitizeSettings({ ...DEFAULT_SETTINGS, leagues: [140, 39], retention: 'all' });
		await saveStored(storage, settingsCodec, next);
		const loaded = await loadStored(storage, settingsCodec);
		expect(sameSettings(loaded, next)).toBe(true);
		expect(Object.keys(storage.snapshot())).toEqual(['oe_settings']);
	});

	it('migrates v1 as identity', () => {
		const raw = { leagues: [39] };
		expect(migrateSettings(raw)).toBe(raw);
	});
});
