import { openMemoryRepository } from '@football/db';
import type { LeagueTeamsResponse, LeaguesResponse } from '@football/contract';
import { loadLeagueCatalog, loadLeagueTeams, toCoverageDto } from './leagues';
import { createApiHandler } from './router';

describe('toCoverageDto (tiszta)', () => {
	it('csak a valódi boolean jelzőket veszi át, a hiányzót null-nak hagyja', () => {
		expect(toCoverageDto({ odds: true, injuries: false, fixtures: { statistics_fixtures: true } })).toEqual({
			odds: true,
			injuries: false,
			statistics: true
		});
		expect(toCoverageDto({ odds: 'yes', fixtures: null })).toEqual({ odds: null, injuries: null, statistics: null });
		expect(toCoverageDto(null)).toBeNull();
		expect(toCoverageDto([1])).toBeNull();
	});
});

describe('loadLeagueCatalog + GET /api/leagues', () => {
	it('aktuális szezon, csapatszám a season_team-ből vagy a meccsekből, tárolt coverage', async () => {
		const { db } = await openMemoryRepository();
		await db.exec(`
			INSERT INTO league (id, name, country, type) VALUES (39, 'Premier League', 'England', 'league'),
				(271, 'NB I', 'Hungary', 'league'), (999, 'Kupa', NULL, 'cup');
			INSERT INTO season (league_id, year, is_current, coverage) VALUES
				(39, 2023, false, NULL),
				(39, 2024, true, '{"odds": true, "injuries": true, "fixtures": {"statistics_fixtures": false}}'),
				(271, 2022, false, NULL), (271, 2024, false, NULL);
			INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C');
			INSERT INTO season_team (league_id, year, team_id) VALUES (39, 2023, 1), (39, 2023, 2), (39, 2023, 3);
			INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id) VALUES
				(1, 271, 2024, '2024-08-01T18:00:00Z', 'FT', 1, 2), (2, 271, 2024, '2024-08-08T18:00:00Z', 'NS', 2, 1);
		`);
		const leagues = await loadLeagueCatalog(db);
		expect(leagues.map((l) => [l.id, l.season, l.teamCount, l.coverage])).toEqual([
			[999, null, null, null],
			[271, 2024, 2, null],
			[39, 2024, 3, { odds: true, injuries: true, statistics: false }]
		]);
		expect(leagues[2]).toMatchObject({ name: 'Premier League', country: 'England', type: 'league', logoUrl: null });

		const h = createApiHandler({ repo: {} as never, budget: {} as never, leagues: () => loadLeagueCatalog(db) });
		const res = await h(new Request('http://x/api/leagues'));
		expect(res.status).toBe(200);
		expect(((await res.json()) as LeaguesResponse).leagues).toHaveLength(3);
		const none = createApiHandler({ repo: {} as never, budget: {} as never });
		expect((await none(new Request('http://x/api/leagues'))).status).toBe(404);
	});
});

describe('osztályozó + GET /api/leagues/:id/teams (I18c)', () => {
	const seed = `
		INSERT INTO league (id, name, country, type) VALUES (78, 'Bundesliga', 'Germany', 'league'), (61, 'Ligue 1', 'France', 'league');
		INSERT INTO season (league_id, year, is_current) VALUES (78, 2024, true), (61, 2023, false), (61, 2024, true);
		INSERT INTO team (id, name, logo_url) VALUES (1, 'Bayern', 'b.png'), (2, 'Augsburg', NULL), (3, 'Heidenheim', NULL),
			(4, 'Elversberg', NULL), (5, 'Metz', NULL), (6, 'Reims', NULL);
		INSERT INTO fixture (id, league_id, season, round, kickoff_at, status, home_team_id, away_team_id) VALUES
			(1, 78, 2024, 'Regular Season - 1', '2024-08-23T18:30:00Z', 'FT', 1, 2),
			(2, 78, 2024, 'Regular Season - 2', '2024-08-30T18:30:00Z', 'FT', 3, 1),
			(3, 78, 2024, 'Relegation Round', '2025-05-22T18:30:00Z', 'FT', 4, 3),
			(4, 61, 2024, 'Relegation Round', '2025-05-29T18:30:00Z', 'FT', 5, 6);
	`;

	it('a meccsekből mért csapatszám nem számolja az osztályozó másodosztályú csapatát', async () => {
		const { db } = await openMemoryRepository();
		await db.exec(seed);
		const byId = new Map((await loadLeagueCatalog(db)).map((l) => [l.id, l.teamCount]));
		expect(byId.get(78)).toBe(3);
		expect(byId.get(61)).toBeNull();
	});

	it('season_team legutóbbi szezonja, különben a meccsek (osztályozó nélkül); nincs adat → üres', async () => {
		const { db } = await openMemoryRepository();
		await db.exec(seed);
		expect(await loadLeagueTeams(db, 78)).toEqual({
			leagueId: 78,
			season: 2024,
			teams: [
				{ id: 2, name: 'Augsburg', logoUrl: null },
				{ id: 1, name: 'Bayern', logoUrl: 'b.png' },
				{ id: 3, name: 'Heidenheim', logoUrl: null }
			]
		});
		expect(await loadLeagueTeams(db, 61)).toEqual({ leagueId: 61, season: null, teams: [] });
		await db.exec(`INSERT INTO season_team (league_id, year, team_id) VALUES (61, 2023, 5), (61, 2024, 6), (61, 2024, 5)`);
		expect((await loadLeagueTeams(db, 61)).teams.map((t) => t.name)).toEqual(['Metz', 'Reims']);

		const h = createApiHandler({ repo: {} as never, budget: {} as never, leagueTeams: (id) => loadLeagueTeams(db, id) });
		const res = await h(new Request('http://x/api/leagues/78/teams'));
		expect(res.status).toBe(200);
		expect(((await res.json()) as LeagueTeamsResponse).teams).toHaveLength(3);
		expect((await h(new Request('http://x/api/leagues/abc/teams'))).status).toBe(400);
		expect((await h(new Request('http://x/api/leagues/999/teams'))).status).toBe(200);
		const none = createApiHandler({ repo: {} as never, budget: {} as never });
		expect((await none(new Request('http://x/api/leagues/78/teams'))).status).toBe(404);
	});
});
