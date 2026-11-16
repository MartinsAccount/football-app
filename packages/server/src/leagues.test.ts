import { openMemoryRepository } from '@football/db';
import type { LeaguesResponse } from '@football/contract';
import { loadLeagueCatalog, toCoverageDto } from './leagues';
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
