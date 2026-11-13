import { DEFAULT_SETTINGS, ISettings } from '../pages/SettingsPage/settingsView';
import { ISettingsStorage, SettingsStore } from './SettingsStore';
import { memorySlipStorage, SlipStore } from './SlipStore';

const memory = (initial: unknown = null) => {
	let saved: unknown = initial;
	const storage: ISettingsStorage & { saved: () => unknown } = {
		load: () => saved,
		save: (s: ISettings) => {
			saved = JSON.parse(JSON.stringify(s));
		},
		saved: () => saved
	};
	return storage;
};

describe('SettingsStore', () => {
	it('loads sanitized settings and persists every change', () => {
		const storage = memory({ leagues: [39], stakeUnit: 2000 });
		const store = new SettingsStore(storage);
		expect(store.settings.leagues).toEqual([39]);
		store.toggleLeague(140);
		store.toggleMarket('btts');
		expect((storage.saved() as ISettings).leagues).toEqual([39, 140]);
		expect(new SettingsStore(storage).settings.markets).not.toContain('btts');
		expect(store.stakeOptions).toEqual([1000, 2000, 4000, 10000]);
	});

	it('rejects min odds not below max odds', () => {
		const store = new SettingsStore(memory());
		expect(store.setNumber('minOdds', 5)).toBe(false);
		expect(store.settings.minOdds).toBe(DEFAULT_SETTINGS.minOdds);
		expect(store.setNumber('maxOdds', 6)).toBe(true);
		store.reset();
		expect(store.settings).toEqual(DEFAULT_SETTINGS);
	});

	it('feeds the slip stake ladder', () => {
		const settings = new SettingsStore(memory({ stakeUnit: 500 }));
		const slip = new SlipStore(memorySlipStorage(), () => settings.stakeOptions);
		expect(slip.stakeOptions).toEqual([250, 500, 1000, 2500]);
		expect(slip.stake).toBe(500);
	});
});
