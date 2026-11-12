import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openMemoryRepository } from '../memory';
import {
	importLegacy,
	mapLegacyFixtures,
	mapLegacyOdds,
	parseSelection,
	type LegacyFixturesFile,
	type LegacyOddsFile
} from './legacy';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(ROOT + rel, 'utf8')) as T;

describe('parseSelection', () => {
	it('splits line markets into selection + line', () => {
		expect(parseSelection('Over 2.5')).toEqual({ selection: 'Over', line: 2.5 });
		expect(parseSelection('Home -0.25')).toEqual({ selection: 'Home', line: -0.25 });
		expect(parseSelection('Away +1')).toEqual({ selection: 'Away', line: 1 });
	});
	it('keeps other selections whole, without a line', () => {
		expect(parseSelection('Draw')).toEqual({ selection: 'Draw', line: null });
		expect(parseSelection('1:0')).toEqual({ selection: '1:0', line: null });
		expect(parseSelection('Home/Draw')).toEqual({ selection: 'Home/Draw', line: null });
	});
});

describe('legacy import (real files, PL 2021)', () => {
	const fixturesFile = readJson<LegacyFixturesFile>('frontend/src/data/allMatchPremierLeague_2021.json');
	const englandOdds = readJson<LegacyOddsFile>('backend/stores/england-odds.json');
	const oddsFile: LegacyOddsFile = { odds: englandOdds.odds.slice(0, 5) };

	it('maps one fixture row per file element and dedupes master data', () => {
		const m = mapLegacyFixtures([fixturesFile]);
		expect(m.fixtures).toHaveLength(fixturesFile.response.length);
		expect(m.leagues).toEqual([expect.objectContaining({ id: 39, name: 'Premier League' })]);
		expect(m.seasons).toEqual([{ leagueId: 39, year: 2021 }]);
		expect(m.teams).toHaveLength(20);
	});

	it('maps every odds value to one quote', () => {
		const m = mapLegacyOdds([oddsFile]);
		const values = oddsFile.odds.flatMap((o) => o.bookmakers.flatMap((b) => b.bets.flatMap((bet) => bet.values))).length;
		expect(m.snapshots).toHaveLength(5);
		expect(m.snapshots.flatMap((s) => s.quotes)).toHaveLength(values);
		expect(m.bookmakers).toEqual([{ id: 16, name: 'Unibet', stored: true }]);
	});

	it('row counts match the files, and a second run writes 0 new rows', async () => {
		const { db, repo } = await openMemoryRepository();
		const input = { fixtureFiles: [fixturesFile], oddsFiles: [oddsFile] };
		const first = await importLegacy(repo, input);
		const quotes = mapLegacyOdds([oddsFile]).snapshots.flatMap((s) => s.quotes).length;

		expect(first.fixtures.inserted).toBe(fixturesFile.response.length);
		expect(first.odds).toEqual({ created: 5, existing: 0, skipped: 0, quotes });
		expect(await repo.countRows('fixture')).toBe(fixturesFile.response.length);
		expect(await repo.countRows('team')).toBe(20);
		expect(await repo.countRows('odds_snapshot')).toBe(5);
		expect(await repo.countRows('odds_quote')).toBe(quotes);

		const second = await importLegacy(repo, input);
		for (const r of [second.leagues, second.seasons, second.teams, second.fixtures, second.bookmakers, second.markets]) {
			expect(r.inserted + r.updated).toBe(0);
		}
		expect(second.odds).toEqual({ created: 0, existing: 5, skipped: 0, quotes: 0 });
		expect(await repo.countRows('odds_quote')).toBe(quotes);

		const latest = await repo.getLatestOdds(oddsFile.odds[0].fixture.id);
		expect(latest?.source).toBe('legacy-json');
		expect(latest?.quotes).toContainEqual(expect.objectContaining({ marketId: 5, selection: 'Over', line: 2.5 }));
		await db.close();
	}, 30_000);

	it('skips odds whose fixture is not in the DB', async () => {
		const { db, repo } = await openMemoryRepository();
		const report = await importLegacy(repo, { fixtureFiles: [], oddsFiles: [oddsFile] });
		expect(report.odds).toEqual({ created: 0, existing: 0, skipped: 5, quotes: 0 });
		await db.close();
	}, 30_000);
});
