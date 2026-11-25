import { describe, expect, it } from 'vitest';
import { buildTeamFilterIndex, NO_TEAM_FILTER, teamFilterAllows } from './teamFilter';

const fx = (leagueId: number, homeTeamId: number, awayTeamId: number) => ({ leagueId, homeTeamId, awayTeamId });

describe('teamFilterAllows', () => {
	it('szűrő nélkül mindent átenged', () => {
		expect(teamFilterAllows(fx(39, 1, 2), NO_TEAM_FILTER)).toBe(true);
	});

	it('Kizár: a csapat meccse bármelyik oldalon kimarad', () => {
		const idx = buildTeamFilterIndex([{ teamId: 2, mode: 'exclude' }], []);
		expect(teamFilterAllows(fx(39, 1, 2), idx)).toBe(false);
		expect(teamFilterAllows(fx(39, 2, 3), idx)).toBe(false);
		expect(teamFilterAllows(fx(39, 1, 3), idx)).toBe(true);
	});

	it('Csak: a csapat ligájában csak az include-csapatok meccsei, más liga érintetlen', () => {
		const idx = buildTeamFilterIndex(
			[{ teamId: 1, mode: 'include' }],
			[
				{ teamId: 1, leagueId: 39 },
				{ teamId: 5, leagueId: 140 }
			]
		);
		expect([...idx.includeLeagues]).toEqual([39]);
		expect(teamFilterAllows(fx(39, 1, 2), idx)).toBe(true);
		expect(teamFilterAllows(fx(39, 3, 1), idx)).toBe(true);
		expect(teamFilterAllows(fx(39, 2, 3), idx)).toBe(false);
		expect(teamFilterAllows(fx(140, 5, 6), idx)).toBe(true);
	});

	it('include és exclude egy meccsen → az exclude nyer; hiányzó csapat-id nem zár ki', () => {
		const idx = buildTeamFilterIndex(
			[
				{ teamId: 1, mode: 'include' },
				{ teamId: 2, mode: 'exclude' }
			],
			[{ teamId: 1, leagueId: 39 }]
		);
		expect(teamFilterAllows(fx(39, 1, 2), idx)).toBe(false);
		expect(teamFilterAllows({ leagueId: 78, homeTeamId: null, awayTeamId: undefined }, idx)).toBe(true);
	});
});
