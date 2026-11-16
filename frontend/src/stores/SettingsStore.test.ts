import { reaction } from 'mobx';
import { DEFAULT_SETTINGS, ISettings } from '../pages/SettingsPage/settingsView';
import type { RemoteSettingsShape, RemoteSettingsUpdate } from '@football/core';
import { ISettingsStorage, SettingsStore } from './SettingsStore';
import { memorySlipStorage, SlipStore } from './SlipStore';

const memory = (initial: unknown = null) => {
	let saved: unknown = initial;
	let writes = 0;
	const storage: ISettingsStorage & { saved: () => unknown; writes: () => number } = {
		load: () => saved,
		save: (s: ISettings) => {
			writes += 1;
			saved = JSON.parse(JSON.stringify(s));
		},
		saved: () => saved,
		writes: () => writes
	};
	return storage;
};

describe('SettingsStore', () => {
	it('edits a draft and writes storage only on save', () => {
		const storage = memory({ leagues: [39], stakeUnit: 2000 });
		const store = new SettingsStore(storage);
		expect(store.draft.leagues).toEqual([39]);
		expect(store.dirty).toBe(false);
		store.toggleLeague(140);
		store.toggleMarket('btts');
		expect(store.dirty).toBe(true);
		expect(storage.writes()).toBe(0);
		expect(store.saved.leagues).toEqual([39]);
		expect(store.diff).toMatch(/^Napi hívás: \d+ → \d+ · Tárhely\/szezon: /);
		store.save();
		expect(store.dirty).toBe(false);
		expect((storage.saved() as ISettings).leagues).toEqual([39, 140]);
		expect(new SettingsStore(storage).saved.markets).not.toContain('btts');
		expect(store.stakeOptions).toEqual([1000, 2000, 4000, 10000]);
	});

	it('discards the draft back to the saved settings', () => {
		const storage = memory();
		const store = new SettingsStore(storage);
		store.setStakeUnit(5000);
		store.toggleLeague(271);
		store.discard();
		expect(store.dirty).toBe(false);
		expect(store.draft).toEqual(DEFAULT_SETTINGS);
		expect(storage.writes()).toBe(0);
	});

	it('edits a league market override from the global list and resets it (I18f)', () => {
		const store = new SettingsStore(memory({ leagues: [39], markets: ['h2h', 'btts'] }));
		store.toggleLeagueMarket(39, 'btts');
		expect(store.draft.leagueMarkets).toEqual([{ leagueId: 39, markets: ['h2h'] }]);
		expect(store.dirty).toBe(true);
		store.setLeagueMarkets(39, null);
		expect(store.draft.leagueMarkets).toEqual([]);
		expect(store.dirty).toBe(false);
	});

	it('toggling back to the saved value is not dirty', () => {
		const store = new SettingsStore(memory());
		store.toggleLeague(39);
		store.toggleLeague(39);
		expect(store.dirty).toBe(false);
	});

	it('rejects min odds not below max odds', () => {
		const store = new SettingsStore(memory());
		expect(store.setNumber('minOdds', 5)).toBe(false);
		expect(store.draft.minOdds).toBe(DEFAULT_SETTINGS.minOdds);
		expect(store.setNumber('maxOdds', 6)).toBe(true);
		store.reset();
		expect(store.draft).toEqual(DEFAULT_SETTINGS);
	});

	it('feeds the slip stake ladder from the saved settings, not the draft', () => {
		const settings = new SettingsStore(memory({ stakeUnit: 500 }));
		const slip = new SlipStore(memorySlipStorage(), () => settings.stakeOptions);
		// Ugyanaz a reaction, mint a MainStore-ban.
		reaction(
			() => settings.saved.stakeUnit,
			(unit) => slip.setStake(unit)
		);
		expect(slip.stakeOptions).toEqual([250, 500, 1000, 2500]);
		expect(slip.stake).toBe(500);
		settings.setStakeUnit(2000);
		expect(slip.stakeOptions).toEqual([250, 500, 1000, 2500]);
		expect(slip.stake).toBe(500);
		settings.save();
		expect(slip.stakeOptions).toEqual([1000, 2000, 4000, 10000]);
		expect(slip.stake).toBe(2000);
	});

	describe('with the settings API (I18a)', () => {
		const response = (over: Partial<RemoteSettingsShape> = {}): RemoteSettingsShape => ({
			values: { evThreshold: 0.05, minOdds: 1.3, maxOdds: 5, stakeUnit: 2000, backfillReserve: 10, retention: 'opening-closing' },
			followedLeagues: [{ leagueId: 39, enabled: true }],
			markets: [{ id: 1, stored: true }],
			bookmakers: [{ id: 8, stored: true }],
			...over
		});

		it('loads the server state as saved, caches it locally, and PUTs only the diff', async () => {
			const storage = memory({ leagues: [140] });
			const sent: RemoteSettingsUpdate[] = [];
			const store = new SettingsStore(storage, {
				load: async () => response(),
				update: async (u) => {
					sent.push(u);
					return response({
						followedLeagues: [
							{ leagueId: 39, enabled: true },
							{ leagueId: 140, enabled: true }
						]
					});
				}
			});
			expect(store.syncStatus).toBe('loading');
			await store.sync();
			expect(store.syncStatus).toBe('synced');
			expect(store.saved.leagues).toEqual([39]);
			expect(store.draft.stakeUnit).toBe(2000);
			expect((storage.saved() as ISettings).leagues).toEqual([39]);

			store.toggleLeague(140);
			await store.save();
			expect(sent).toEqual([{ followedLeagues: { upsert: [{ leagueId: 140, enabled: true }] } }]);
			expect(store.saved.leagues).toEqual([39, 140]);
			expect(store.dirty).toBe(false);
		});

		it('keeps the draft and reports the error when the PUT fails', async () => {
			const store = new SettingsStore(memory(), {
				load: async () => response(),
				update: async () => {
					throw new Error('ismeretlen liga');
				}
			});
			await store.sync();
			store.toggleLeague(140);
			await store.save();
			expect(store.saveError).toBe('ismeretlen liga');
			expect(store.dirty).toBe(true);
			expect(store.saving).toBe(false);
		});

		it('falls back to local-only saving when the server is unreachable', async () => {
			const storage = memory({ leagues: [140] });
			const store = new SettingsStore(storage, {
				load: async () => {
					throw new Error('offline');
				},
				update: async () => {
					throw new Error('unreachable');
				}
			});
			await store.sync();
			expect(store.syncStatus).toBe('offline');
			expect(store.saved.leagues).toEqual([140]);
			store.toggleLeague(39);
			await store.save();
			expect(store.saveError).toBeNull();
			expect((storage.saved() as ISettings).leagues).toEqual([140, 39]);
		});

		it('lists the league catalog from the server and estimates with its team counts (I18b)', async () => {
			const store = new SettingsStore(memory({ leagues: [203] }), {
				load: async () => response({ followedLeagues: [{ leagueId: 203, enabled: true }] }),
				update: async () => response(),
				leagues: async () => [
					{
						id: 39,
						name: 'Premier League',
						country: 'England',
						teamCount: 20,
						coverage: { odds: true, injuries: false, statistics: true }
					},
					{ id: 203, name: 'Süper Lig', country: 'Turkey', teamCount: 19, coverage: null }
				]
			});
			expect(store.leagues.some((l) => l.id === 203)).toBe(false);
			const before = store.estimate.dailyAverage;
			await store.loadCatalog();
			expect(store.leagues.find((l) => l.id === 39)?.coverage?.injuries).toBe(false);
			expect(store.leagues.find((l) => l.id === 203)).toMatchObject({ name: 'Süper Lig', teams: 19 });
			expect(store.estimate.dailyAverage).toBeGreaterThan(before);
		});

		it('loads league teams once and PUTs the team filter diff (I18c)', async () => {
			const puts: RemoteSettingsUpdate[] = [];
			let teamCalls = 0;
			const store = new SettingsStore(memory(), {
				load: async () =>
					response({
						followedLeagues: [
							{ leagueId: 39, enabled: true },
							{ leagueId: 78, enabled: true }
						],
						teamFilters: [{ teamId: 50, mode: 'exclude' }]
					}),
				update: async (u) => {
					puts.push(u);
					return response({ teamFilters: u.teamFilters?.upsert ?? [] });
				},
				teams: async (leagueId) => {
					teamCalls += 1;
					return { season: 2024, teams: [{ id: leagueId * 10, name: `T${leagueId}` }] };
				}
			});
			await store.sync();
			expect(store.teamsLeague).toBe(39);
			await store.loadTeams(39);
			await store.loadTeams(39);
			expect(teamCalls).toBe(1);
			expect(store.teamsState).toEqual({ season: 2024, teams: [{ id: 390, name: 'T39' }] });
			store.selectTeamsLeague(78);
			expect(store.teamsLeague).toBe(78);

			store.setTeamFilter(780, 'include');
			store.setTeamFilter(50, null);
			expect(store.dirty).toBe(true);
			await store.save();
			expect(puts).toEqual([{ teamFilters: { upsert: [{ teamId: 780, mode: 'include' }], remove: [50] } }]);
			expect(store.saved.teamFilters).toEqual([{ teamId: 780, mode: 'include' }]);
			expect(store.dirty).toBe(false);
		});

		it('marks the team list as error without a teams endpoint', async () => {
			const store = new SettingsStore(memory({ leagues: [39] }));
			await store.loadTeams(39);
			expect(store.teamsState).toBe('error');
		});
	});
});
