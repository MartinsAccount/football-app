import { describe, expect, it } from 'vitest';
import { openMemoryRepository } from '../memory';
import type { Fixture, Team } from '../types';
import {
	CSV_BOOKMAKERS,
	CSV_MARKETS,
	csvKickoffUtc,
	csvRowSnapshots,
	matchCsvRows,
	normalizeTeamName,
	parseCsvDate,
	parseFootballDataCsv
} from './footballData';

const HEADER =
	'Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A,PSH,PSD,PSA,B365>2.5,B365<2.5,P>2.5,P<2.5,B365CH,B365CD,B365CA,PSCH,PSCD,PSCA,AvgCH,AvgCD,AvgCA,B365C>2.5,B365C<2.5';
const CSV = [
	'﻿' + HEADER,
	'E0,05/08/2022,20:00,Crystal Palace,Arsenal,0,2,4.2,3.6,1.85,4.5,3.65,1.89,2.1,1.72,2.14,1.78,4.5,3.6,1.8,4.58,3.63,1.88,4.56,3.57,1.85,2.1,1.72',
	'E0,06/08/2022,15:00,Man United,Brighton,1,2,1.6,4.2,5.25,,,,1.8,2,,,1.7,4,4.75,,,,,,,1.83,1.98',
	'E0,07/08/2022,14:00,Arsenal,Man United,3,1,1.9,3.8,4,,,,,,,,,,,,,,,,,,',
	',,,,,,,,',
	''
].join('\r\n');

const team = (id: number, name: string): Team => ({ id, name });
const TEAMS = [team(42, 'Arsenal'), team(52, 'Crystal Palace'), team(33, 'Manchester United'), team(51, 'Brighton')];
const fx = (id: number, kickoffAt: string, homeTeamId: number, awayTeamId: number): Fixture => ({
	id,
	leagueId: 39,
	season: 2022,
	kickoffAt,
	status: 'FT',
	homeTeamId,
	awayTeamId
});
const FIXTURES = [
	fx(1, '2022-08-05T19:00:00+00:00', 52, 42),
	fx(2, '2022-08-06T14:00:00+00:00', 33, 51),
	fx(3, '2022-08-07T13:00:00+00:00', 42, 33)
];

describe('parseFootballDataCsv', () => {
	it('BOM-ot, CRLF-et, üres és csonka sort tűr; az üres odds-cella kimarad', () => {
		const rows = parseFootballDataCsv(CSV);
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({
			div: 'E0',
			date: '2022-08-05',
			home: 'Crystal Palace',
			away: 'Arsenal',
			goalsHome: 0,
			goalsAway: 2
		});
		expect(rows[0].odds['B365H']).toBe(4.2);
		expect(rows[1].odds['PSH']).toBeUndefined();
	});
	it('kezdés: Time oszlop, angol helyi idő → UTC (BST/GMT)', () => {
		expect(parseFootballDataCsv(CSV)[0].time).toBe('20:00');
		expect(csvKickoffUtc('2025-04-12', '15:00')).toBe('2025-04-12T14:00:00.000Z');
		expect(csvKickoffUtc('2025-01-11', '17:30')).toBe('2025-01-11T17:30:00.000Z');
		expect(csvKickoffUtc('2025-04-12')).toBe('2025-04-12T14:00:00.000Z');
	});
	it('dátum: dd/mm/yyyy és dd/mm/yy', () => {
		expect(parseCsvDate('05/08/2022')).toBe('2022-08-05');
		expect(parseCsvDate('5/8/22')).toBe('2022-08-05');
	});
	it('névnormalizálás: ékezet, írásjel, klub-rövidítés', () => {
		expect(normalizeTeamName('1. FC Köln')).toBe('koln');
		expect(normalizeTeamName('FC Koln')).toBe('koln');
		expect(normalizeTeamName('VfB Stuttgart')).toBe('stuttgart');
	});
});

describe('matchCsvRows', () => {
	it('névegyezés + ellenfél-alapú alias-következtetés („Man United” → Manchester United)', () => {
		const r = matchCsvRows(parseFootballDataCsv(CSV), FIXTURES, TEAMS);
		expect(r.unmatched).toEqual([]);
		expect(r.matched.map((m) => m.fixture.id)).toEqual([1, 2, 3]);
		expect(r.aliases).toContainEqual({ source: 'football-data-csv', name: 'Man United', teamId: 33 });
	});
	it('a meglévő alias elsőbbséget kap; más napon nincs párosítás (±1 nap)', () => {
		const rows = parseFootballDataCsv(CSV).map((row) => ({ ...row, date: '2022-09-20' }));
		const r = matchCsvRows(rows, FIXTURES, TEAMS, [{ source: 'football-data-csv', name: 'Man United', teamId: 33 }]);
		expect(r.matched).toEqual([]);
		expect(r.unmatched).toHaveLength(3);
	});
});

describe('csvRowSnapshots', () => {
	const [row] = parseFootballDataCsv(CSV);
	const [opening, closing] = csvRowSnapshots(row, FIXTURES[0]);
	it('nyitó = kezdés − 48 h, záró = kezdés; source/kind', () => {
		expect(opening).toMatchObject({
			fixtureId: 1,
			kind: 'opening_csv',
			source: 'football-data-csv',
			capturedAt: '2022-08-03T19:00:00.000Z'
		});
		expect(closing).toMatchObject({ kind: 'closing_csv', capturedAt: '2022-08-05T19:00:00.000Z' });
	});
	it('1X2 + O/U 2.5 irodánként; a hiányzó oszlop kimarad', () => {
		expect(opening.quotes).toHaveLength(10); // B365 + Pinnacle × (3 + 2)
		expect(opening.quotes).toContainEqual({ bookmakerId: 4, marketId: 5, selection: 'Over', line: 2.5, odd: 2.14 });
		expect(closing.quotes).toHaveLength(11); // B365 5 + PS 3 + Avg 3 (Avg O/U nincs)
		expect(closing.quotes).toContainEqual({ bookmakerId: 900001, marketId: 1, selection: 'Draw', line: null, odd: 3.57 });
	});
	it('odds nélküli oldal nem ad snapshotot', () => {
		const [, , third] = parseFootballDataCsv(CSV);
		expect(csvRowSnapshots(third, FIXTURES[2]).map((s) => s.kind)).toEqual(['opening_csv']);
	});
});

describe('team_alias repository', () => {
	it('upsert idempotens, listázás forrás szerint', async () => {
		const { db, repo } = await openMemoryRepository();
		await repo.upsertTeams(TEAMS);
		const rows = [{ source: 'football-data-csv', name: 'Man United', teamId: 33 }];
		expect(await repo.upsertTeamAliases(rows)).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
		expect(await repo.upsertTeamAliases(rows)).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
		expect(await repo.listTeamAliases('football-data-csv')).toEqual(rows);
		expect(await repo.upsertBookmakers(CSV_BOOKMAKERS)).toMatchObject({ inserted: 4 });
		expect(await repo.upsertMarkets(CSV_MARKETS)).toMatchObject({ inserted: 2 });
		await db.close();
	});
});
