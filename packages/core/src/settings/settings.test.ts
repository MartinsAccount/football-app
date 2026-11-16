import { describe, expect, it } from 'vitest';
import { loadStored, memoryKeyValueStorage, saveStored } from '../storage/keyValue';
import {
	DEFAULT_SETTINGS,
	estimateSettings,
	FALLBACK_LEAGUE_TEAMS,
	leagueCatalog,
	migrateSettings,
	sameSettings,
	sanitizeSettings,
	SETTINGS_LEAGUES,
	SETTINGS_STORAGE_KEY,
	settingsCodec,
	toggleSettingsItem,
	withSettingsNumber
} from './settings';

describe('settingsCodec', () => {
	it('keeps the existing localStorage key and the plain JSON format (v1)', () => {
		expect(SETTINGS_STORAGE_KEY).toBe('oe_settings');
		expect(settingsCodec.key).toBe('oe_settings');
		expect(JSON.parse(settingsCodec.encode(DEFAULT_SETTINGS) as string)).toEqual(DEFAULT_SETTINGS);
	});

	it('reads a saved v1 value and drops unknown or invalid fields', () => {
		const saved = JSON.stringify({ ...DEFAULT_SETTINGS, leagues: [39, 999, 39, -1, 1.5, 'x'], stakeUnit: 2000, minOdds: 'x' });
		const s = settingsCodec.decode(saved);
		expect(s.leagues).toEqual([39, 999]);
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

describe('settings edits', () => {
	it('toggles a list item and keeps the result valid', () => {
		const off = toggleSettingsItem(DEFAULT_SETTINGS, 'leagues', 39);
		expect(off.leagues).not.toContain(39);
		expect(toggleSettingsItem(off, 'leagues', 39).leagues).toContain(39);
		expect(toggleSettingsItem(DEFAULT_SETTINGS, 'markets', 'btts').markets).toEqual(['h2h', 'ou25']);
		expect(toggleSettingsItem(DEFAULT_SETTINGS, 'bookmakers', 999).bookmakers).toEqual(DEFAULT_SETTINGS.bookmakers);
	});

	it('writes a number field only when it is in range and min < max', () => {
		expect(withSettingsNumber(DEFAULT_SETTINGS, 'minOdds', 1.8)?.minOdds).toBe(1.8);
		expect(withSettingsNumber(DEFAULT_SETTINGS, 'minOdds', 4)).toBeNull();
		expect(withSettingsNumber(DEFAULT_SETTINGS, 'maxOdds', 1.2)).toBeNull();
		expect(withSettingsNumber(DEFAULT_SETTINGS, 'evThreshold', 0.9)).toBeNull();
		expect(withSettingsNumber(DEFAULT_SETTINGS, 'backfillReserve', 20)?.backfillReserve).toBe(20);
	});
});

describe('leagueCatalog (I18b)', () => {
	const cov = { odds: true, injuries: false, statistics: null };
	const rows = [
		{ id: 39, name: 'Premier League', country: 'England', teamCount: 22, coverage: cov },
		{ id: 2, name: 'Champions League', country: 'World', teamCount: null, coverage: null },
		{ id: 203, name: 'Süper Lig', country: 'Turkey', teamCount: 19, coverage: null },
		{ id: 500, name: 'Követett', country: null, teamCount: null, coverage: null }
	];

	it('szerver nélkül a kézi lista, coverage nélkül', () => {
		expect(leagueCatalog(null)).toEqual(SETTINGS_LEAGUES);
		expect(SETTINGS_LEAGUES.every((l) => l.coverage === null)).toBe(true);
	});

	it('a kézi jelöltekre a DB csapatszáma és coverage-e; utána az adatos vagy követett DB-ligák', () => {
		const out = leagueCatalog(rows, [500]);
		expect(out.slice(0, SETTINGS_LEAGUES.length).map((l) => l.id)).toEqual(SETTINGS_LEAGUES.map((l) => l.id));
		expect(out[0]).toEqual({ id: 39, name: 'Premier League', country: 'Anglia', teams: 22, coverage: cov });
		expect(out.find((l) => l.id === 140)).toEqual(SETTINGS_LEAGUES.find((l) => l.id === 140));
		expect(out.slice(SETTINGS_LEAGUES.length)).toEqual([
			{ id: 203, name: 'Süper Lig', country: 'Turkey', teams: 19, coverage: null },
			{ id: 500, name: 'Követett', country: '', teams: FALLBACK_LEAGUE_TEAMS, coverage: null }
		]);
	});

	it('a becslés a katalógus csapatszámát használja', () => {
		const s = { ...DEFAULT_SETTINGS, leagues: [203] };
		expect(estimateSettings(s, leagueCatalog(rows)).dailyAverage).toBeGreaterThan(estimateSettings(s).dailyAverage);
		expect(estimateSettings(s, leagueCatalog(rows)).leagueDaily.get(203)).toBeGreaterThan(0);
	});
});
