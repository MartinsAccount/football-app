import { describe, expect, it } from 'vitest';
import { RemoteSettingsShape, settingsFromRemote, settingsUpdateFrom } from './remote';
import { DEFAULT_SETTINGS, ISettings } from './settings';

const remote: RemoteSettingsShape = {
	values: { evThreshold: 0.05, minOdds: 1.3, maxOdds: 5, stakeUnit: 2000, backfillReserve: 15, retention: 'all' },
	followedLeagues: [
		{ leagueId: 39, enabled: true },
		{ leagueId: 140, enabled: false },
		{ leagueId: 78, enabled: true }
	],
	markets: [
		{ id: 1, stored: true },
		{ id: 5, stored: false }
	],
	bookmakers: [
		{ id: 8, stored: true },
		{ id: 16, stored: false },
		{ id: 4, stored: false }
	]
};

describe('settingsFromRemote', () => {
	it('maps values, enabled leagues and stored flags; missing rows fall back to the local settings', () => {
		const s = settingsFromRemote(remote, { ...DEFAULT_SETTINGS, markets: ['btts'], bookmakers: [6, 16] });
		expect(s).toMatchObject({
			evThreshold: 0.05,
			minOdds: 1.3,
			maxOdds: 5,
			stakeUnit: 2000,
			backfillReserve: 15,
			retention: 'all'
		});
		expect(s.leagues).toEqual([39, 78]);
		// 1 stored, 5 not stored, 8 has no DB row → fallback (btts selected locally)
		expect(s.markets).toEqual(['h2h', 'btts']);
		// 8 stored; 16 and 4 explicitly off; 6 has no DB row → fallback
		expect(s.bookmakers.sort((a, b) => a - b)).toEqual([6, 8]);
	});
});

describe('settingsUpdateFrom', () => {
	const saved: ISettings = settingsFromRemote(remote, { ...DEFAULT_SETTINGS, markets: [], bookmakers: [] });

	it('returns null without changes', () => {
		expect(settingsUpdateFrom(saved, saved, remote)).toBeNull();
	});

	it('sends only the changed values, toggled leagues as enabled upserts and known market/bookmaker rows', () => {
		const draft: ISettings = {
			...saved,
			minOdds: 1.6,
			leagues: [78, 135],
			markets: ['ou25', 'btts'],
			bookmakers: [8, 16, 6]
		};
		expect(settingsUpdateFrom(saved, draft, remote)).toEqual({
			values: { minOdds: 1.6 },
			followedLeagues: {
				upsert: [
					{ leagueId: 135, enabled: true },
					{ leagueId: 39, enabled: false }
				]
			},
			// btts (8) has no DB row → not sent
			markets: [
				{ id: 5, stored: true },
				{ id: 1, stored: false }
			],
			// 6 has no DB row → not sent
			bookmakers: [{ id: 16, stored: true }]
		});
	});
});
