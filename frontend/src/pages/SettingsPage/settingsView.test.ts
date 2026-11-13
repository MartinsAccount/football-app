import { estimateDailyCalls } from '@football/core';
import {
	DEFAULT_SETTINGS,
	estimateSettings,
	missingCoverage,
	numberFieldText,
	parseDecimalInput,
	parseNumberField,
	sameSettings,
	sanitizeSettings,
	SETTINGS_LEAGUES,
	settingsDiff,
	settingsWarnings,
	stakeOptions
} from './settingsView';

describe('settingsView', () => {
	it('sanitizes stored settings: unknown ids drop, bad numbers fall back to defaults', () => {
		expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
		const s = sanitizeSettings({
			leagues: [39, 999],
			markets: ['h2h', 'xx'],
			evThreshold: -1,
			minOdds: 5,
			maxOdds: 2,
			stakeUnit: 123
		});
		expect(s.leagues).toEqual([39]);
		expect(s.markets).toEqual(['h2h']);
		expect(s.evThreshold).toBe(DEFAULT_SETTINGS.evThreshold);
		expect([s.minOdds, s.maxOdds]).toEqual([DEFAULT_SETTINGS.minOdds, DEFAULT_SETTINGS.maxOdds]);
		expect(s.stakeUnit).toBe(DEFAULT_SETTINGS.stakeUnit);
	});

	it('parses Hungarian decimal input and field units', () => {
		expect(parseDecimalInput('1,5')).toBe(1.5);
		expect(parseDecimalInput(' 2.10 ')).toBe(2.1);
		expect(parseDecimalInput('abc')).toBeNull();
		expect(parseNumberField('evThreshold', '5')).toBe(0.05);
		expect(parseNumberField('evThreshold', '80')).toBeNull();
		expect(parseNumberField('minOdds', '1')).toBeNull();
		expect(parseNumberField('backfillReserve', '12,4')).toBe(12);
		expect(numberFieldText('evThreshold', 0.05)).toBe('5');
		expect(numberFieldText('minOdds', 1.5)).toBe('1,5');
	});

	it('derives the stake ladder from the unit', () => {
		expect(stakeOptions(1000)).toEqual([500, 1000, 2000, 5000]);
		expect(stakeOptions(500)).toEqual([250, 500, 1000, 2500]);
	});

	it('estimates calls with the core budget and storage per season', () => {
		const e = estimateSettings(DEFAULT_SETTINGS);
		const top5 = SETTINGS_LEAGUES.filter((l) => DEFAULT_SETTINGS.leagues.includes(l.id));
		const core = estimateDailyCalls(top5.map((l) => ({ fixturesPerRound: Math.floor(l.teams / 2) })));
		expect(e.dailyAverage).toBeCloseTo(core.dailyAverage);
		expect(e.peakWithReserve).toBeCloseTo(core.peakDay + DEFAULT_SETTINGS.backfillReserve);
		// 3·380 + 2·306 meccs × 2 snapshot × 5 iroda × 7 kimenet
		expect(e.rowsPerSeason).toBe((3 * 380 + 2 * 306) * 2 * 5 * 7);
		expect(settingsWarnings(DEFAULT_SETTINGS, e)).toEqual([]);
		const all = estimateSettings({ ...DEFAULT_SETTINGS, retention: 'all' });
		expect(all.storageBytes).toBeGreaterThan(e.storageBytes);
	});

	it('warns when the daily budget or the selection is not enough', () => {
		const s = { ...DEFAULT_SETTINGS, leagues: SETTINGS_LEAGUES.map((l) => l.id), backfillReserve: 60, bookmakers: [] };
		const w = settingsWarnings(s, estimateSettings(s));
		expect(w.some((x) => x.danger && x.text.includes('napi 100'))).toBe(true);
		expect(w.some((x) => x.text.includes('iroda'))).toBe(true);
	});

	it('lists only the missing coverage items', () => {
		const full = SETTINGS_LEAGUES.find((l) => l.id === 39)!;
		expect(missingCoverage(full)).toEqual([]);
		expect(missingCoverage(SETTINGS_LEAGUES.find((l) => l.id === 271)!)).toEqual(['Sérültek nincs']);
		expect(missingCoverage({ ...full, coverage: { odds: false, injuries: true, statistics: false } })).toEqual([
			'Odds nincs',
			'Statisztika nincs'
		]);
	});

	it('describes the saved → draft estimate change', () => {
		const saved = estimateSettings(DEFAULT_SETTINGS);
		const est = (daily: number, mb: number) => ({ ...saved, dailyWithReserve: daily, storageBytes: mb * 1024 * 1024 });
		expect(settingsDiff(est(17, 17.5), est(21.2, 20.08))).toBe('Napi hívás: 17 → 21 · Tárhely/szezon: 17,5 → 20,1 MB');
		expect(settingsDiff(est(17, 17.5), est(17, 12))).toBe('Napi hívás: 17 · Tárhely/szezon: 17,5 → 12,0 MB');
	});

	it('compares settings regardless of list order', () => {
		expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, leagues: [...DEFAULT_SETTINGS.leagues].reverse() })).toBe(true);
		expect(sameSettings(DEFAULT_SETTINGS, { ...DEFAULT_SETTINGS, stakeUnit: 2000 })).toBe(false);
	});
});
