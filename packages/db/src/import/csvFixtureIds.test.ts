import { describe, expect, it } from 'vitest';
import type { Fixture, Team } from '../types';
import { csvFixtureIdIndex, csvRowKey, fixtureIdFor } from './csvFixtureIds';
import { matchCsvRows, parseFootballDataCsv } from './footballData';

const CSV = [
	'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A',
	'E0,05/08/2022,20:00,Crystal Palace,Arsenal,0,2,4.2,3.6,1.85',
	'E0,06/08/2022,15:00,Man United,Brighton,1,2,1.6,4.2,5.25',
	'E0,07/08/2022,14:00,Arsenal,Man United,3,1,1.9,3.8,4',
	'E0,09/08/2022,20:00,Arsenal,Brighton,1,1,1.5,4,6'
].join('\n');
const TEAMS: Team[] = [
	{ id: 42, name: 'Arsenal' },
	{ id: 52, name: 'Crystal Palace' },
	{ id: 33, name: 'Manchester United' },
	{ id: 51, name: 'Brighton' }
];
const fx = (id: number, kickoffAt: string, homeTeamId: number, awayTeamId: number): Fixture => ({
	id,
	leagueId: 39,
	season: 2022,
	kickoffAt,
	status: 'FT',
	homeTeamId,
	awayTeamId
});
// DB (API-Football) id-k, nem a CSV-sorszámok.
const FIXTURES = [
	fx(867946, '2022-08-05T19:00:00+00:00', 52, 42),
	fx(867950, '2022-08-06T14:00:00+00:00', 33, 51),
	fx(867960, '2022-08-07T13:00:00+00:00', 42, 33)
];

describe('CSV-sor → DB fixture-id (I20b)', () => {
	const rows = parseFootballDataCsv(CSV);
	const index = csvFixtureIdIndex(matchCsvRows(rows, FIXTURES, TEAMS).matched);

	it('a párosított sor a DB-meccs id-ját kapja (alias-következtetéssel is: „Man United”)', () => {
		expect(fixtureIdFor(index, rows[0])).toBe(867946);
		expect(fixtureIdFor(index, rows[1])).toBe(867950);
		expect(fixtureIdFor(index, rows[2])).toBe(867960);
		expect(index.size).toBe(3);
	});
	it('a kulcs liga + dátum + CSV-nevek; ugyanaz a párosítás más ligában nem ütközik', () => {
		expect(csvRowKey(rows[0])).toBe('E0|2022-08-05|Crystal Palace|Arsenal');
		expect(index.has(csvRowKey({ ...rows[0], div: 'D1' }))).toBe(false);
	});
	it('párosítatlan sor (nincs DB-meccs) hibát dob, nem ad hamis id-t', () => {
		expect(() => fixtureIdFor(index, rows[3])).toThrow(/Párosítatlan/);
	});
});
