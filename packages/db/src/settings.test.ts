import { PGlite } from '@electric-sql/pglite';
import { resolveStoredScope } from '@football/core';
import { migrate } from './migrate';
import { SqlSettingsRepository } from './settings';

let repo: SqlSettingsRepository;

beforeAll(async () => {
	const db = new PGlite();
	await migrate(db);
	await db.exec(`
		INSERT INTO league (id, name) VALUES (39, 'Premier League'), (140, 'La Liga');
		INSERT INTO team (id, name) VALUES (40, 'Liverpool'), (50, 'Man City');
		INSERT INTO market (id, name, code, stored) VALUES (1, 'Match Winner', 'Vegeredmeny', true), (8, 'BTTS', 'MindketCsapatGol', false);
		INSERT INTO bookmaker (id, name, stored) VALUES (8, 'Bet365', true), (1, 'Other', false);
	`);
	repo = new SqlSettingsRepository(db);
});

describe('SqlSettingsRepository', () => {
	it('követett liga: upsert alapértékkel, részleges frissítés, felülírás törlése, egyedi törlés', async () => {
		await repo.upsertFollowedLeague({ leagueId: 39 });
		await repo.upsertFollowedLeague({ leagueId: 140, priority: 2, markets: ['MindketCsapatGol'] });
		let leagues = await repo.listFollowedLeagues();
		expect(leagues.map((l) => [l.leagueId, l.enabled, l.priority, l.markets])).toEqual([
			[140, true, 2, ['MindketCsapatGol']],
			[39, true, 0, null]
		]);
		expect(leagues[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

		await repo.upsertFollowedLeague({ leagueId: 140, enabled: false });
		leagues = await repo.listFollowedLeagues();
		expect(leagues[0]).toMatchObject({ leagueId: 140, enabled: false, priority: 2, markets: ['MindketCsapatGol'] });

		await repo.upsertFollowedLeague({ leagueId: 140, enabled: true, markets: null });
		expect((await repo.listFollowedLeagues())[0].markets).toBeNull();
		await repo.upsertFollowedLeague({ leagueId: 140, markets: ['MindketCsapatGol'] });

		expect(await repo.removeFollowedLeague(39)).toBe(true);
		expect(await repo.removeFollowedLeague(39)).toBe(false);
		await repo.upsertFollowedLeague({ leagueId: 39 });
	});

	it('csapatszűrő: upsert módváltással és törlés', async () => {
		await repo.upsertTeamFilter({ teamId: 50, mode: 'include' });
		await repo.upsertTeamFilter({ teamId: 40, mode: 'include' });
		await repo.upsertTeamFilter({ teamId: 50, mode: 'exclude' });
		expect(await repo.listTeamFilters()).toEqual([
			{ teamId: 40, mode: 'include' },
			{ teamId: 50, mode: 'exclude' }
		]);
		expect(await repo.removeTeamFilter(40)).toBe(true);
		expect(await repo.listTeamFilters()).toEqual([{ teamId: 50, mode: 'exclude' }]);
	});

	it('setting: a 0005 alapértékei olvashatók, upsert jsonb-ként', async () => {
		expect(await repo.getSetting('ev_threshold')).toBe(0.05);
		expect(await repo.getSetting('nincs')).toBeUndefined();
		await repo.setSetting('ev_threshold', 0.07);
		await repo.setSetting('stake_mode', 'kelly');
		await repo.setSetting('odds_band', { min: 1.5, max: 4 });
		const all = await repo.getSettings();
		expect(all).toMatchObject({ ev_threshold: 0.07, stake_mode: 'kelly', odds_band: { min: 1.5, max: 4 }, odds_retention: true });
		await expect(repo.setSetting('x', undefined)).rejects.toThrow();
	});

	it('piac/iroda tárolási jelző és a core feloldó bemenete', async () => {
		expect(await repo.setBookmakerStored(1, true)).toBe(true);
		expect(await repo.setMarketStored(404, true)).toBe(false);
		expect(await repo.listBookmakers()).toEqual([
			{ id: 1, name: 'Other', stored: true },
			{ id: 8, name: 'Bet365', stored: true }
		]);

		const input = await repo.loadStoredScopeInput();
		expect(resolveStoredScope(39, input)).toEqual({ leagueId: 39, followed: true, marketIds: [1], bookmakerIds: [1, 8] });
		expect(resolveStoredScope(140, input).marketIds).toEqual([8]);
		expect(resolveStoredScope(78, input).followed).toBe(false);
	});
});
