// Közös backtest-adat (I26): football-data.co.uk CSV-k (`data/history/football-data/<DIV>-<YYZZ>.csv`) → `BacktestMatch[]`.
// A v0 (`backtest.ts`), az M1 (`backtest-elo-logit.ts`) és a v1 riport (`backtest-model-v1.ts`) ugyanezt használja. 0 élő hívás.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BacktestMatch } from '@football/core';
import { parseFootballDataCsv } from '../src/import/footballData';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const CSV_DIR = join(ROOT, 'data', 'history', 'football-data');

export const LEAGUE_NAME: Record<string, string> = {
	E0: 'Premier League',
	D1: 'Bundesliga',
	F1: 'Ligue 1',
	I1: 'Serie A',
	SP1: 'La Liga'
};

const cols = (odds: Record<string, number>, names: string[]) =>
	names.every((n) => odds[n]) ? names.map((n) => odds[n]) : undefined;

/** Az összes CSV, fájlnév szerint rendezve; a csapat-id a CSV-név első előfordulásának sorszáma (determinisztikus). */
export const loadBacktestMatches = (dir = CSV_DIR): { matches: BacktestMatch[]; skipped: number } => {
	const teamIds = new Map<string, number>();
	const teamId = (name: string) => teamIds.get(name) ?? (teamIds.set(name, teamIds.size + 1), teamIds.size);
	const matches: BacktestMatch[] = [];
	let skipped = 0;
	for (const file of readdirSync(dir)
		.filter((f) => /^[A-Z0-9]+-\d{4}\.csv$/.test(f))
		.sort()) {
		const [div, yy] = file.replace('.csv', '').split('-');
		const season = 2000 + Number(yy.slice(0, 2));
		for (const row of parseFootballDataCsv(readFileSync(join(dir, file), 'utf8'))) {
			if (row.goalsHome === null || row.goalsAway === null) {
				skipped++;
				continue;
			}
			const o = row.odds;
			matches.push({
				id: matches.length + 1,
				kickoff: `${row.date}T12:00:00Z`,
				homeTeamId: teamId(row.home),
				awayTeamId: teamId(row.away),
				homeGoals: row.goalsHome,
				awayGoals: row.goalsAway,
				league: div,
				season,
				odds: {
					h2h: {
						taken: cols(o, ['B365H', 'B365D', 'B365A']),
						takenClosing: cols(o, ['B365CH', 'B365CD', 'B365CA']),
						marketOpening: cols(o, ['AvgH', 'AvgD', 'AvgA']),
						marketClosing: cols(o, ['AvgCH', 'AvgCD', 'AvgCA'])
					},
					ou25: {
						taken: cols(o, ['B365>2.5', 'B365<2.5']),
						takenClosing: cols(o, ['B365C>2.5', 'B365C<2.5']),
						marketOpening: cols(o, ['Avg>2.5', 'Avg<2.5']),
						marketClosing: cols(o, ['AvgC>2.5', 'AvgC<2.5'])
					}
				}
			});
		}
	}
	return { matches, skipped };
};
