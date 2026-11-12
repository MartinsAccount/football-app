// football-data.co.uk CSV-odds import (S11b, ROADMAP 4.2): `data/history/football-data/<div>-<yyyy>.csv` →
// `odds_snapshot(source='football-data-csv')` + `team_alias`. 0 élő hívás. Idempotens. Előfeltétel: `import:history`.
// Futtatás: `npm run import:odds-csv -w @football/db [-- <dataDir>]`. A párosítatlan sorok: `data/history/unmatched-csv.json`.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	CSV_BOOKMAKERS,
	CSV_MARKETS,
	CSV_SOURCE,
	DIV_LEAGUE,
	csvRowSnapshots,
	matchCsvRows,
	parseFootballDataCsv,
	type CsvMatchRow
} from '../src/import/footballData';
import { mapLegacyFixtures, type LegacyFixturesFile } from '../src/import/legacy';
import { openMemoryRepository } from '../src/memory';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'history', 'football-data');
const API_DIR = join(ROOT, 'data', 'history', 'api-football');
const dataDir = process.argv[2] ?? join(ROOT, '.data', 'pglite');

const started = Date.now();
const { db, repo } = await openMemoryRepository(dataDir);
if ((await repo.countRows('fixture')) === 0)
	throw new Error('Nincs meccs a DB-ben: előbb `npm run import:history -w @football/db`.');
await repo.upsertBookmakers(CSV_BOOKMAKERS);
await repo.upsertMarkets(CSV_MARKETS);

const known = await repo.listTeamAliases(CSV_SOURCE);
const unmatched: CsvMatchRow[] = [];
const summary: Record<string, { rows: number; matched: number; scoreDiff: number; snapshots: number; created: number }> = {};
for (const file of readdirSync(CSV_DIR)
	.filter((f) => /^[A-Z0-9]+-\d{4}\.csv$/.test(f))
	.sort()) {
	const [div, yy] = file.replace('.csv', '').split('-');
	const leagueId = DIV_LEAGUE[div];
	const season = 2000 + Number(yy.slice(0, 2));
	const api = JSON.parse(readFileSync(join(API_DIR, `fixtures-${leagueId}-${season}.json`), 'utf8')) as LegacyFixturesFile;
	const { fixtures, teams } = mapLegacyFixtures([api]);
	const rows = parseFootballDataCsv(readFileSync(join(CSV_DIR, file), 'utf8'));
	const result = matchCsvRows(
		rows,
		fixtures.filter((f) => f.leagueId === leagueId && f.season === season),
		teams,
		known
	);
	await repo.upsertTeamAliases(result.aliases);
	let snapshots = 0;
	let created = 0;
	// Ellenőrzés: a párosított meccs végeredménye egyezzen a CSV-vel.
	const scoreDiff = result.matched.filter(
		({ row, fixture }) => row.goalsHome !== fixture.goalsHome || row.goalsAway !== fixture.goalsAway
	).length;
	for (const { row, fixture } of result.matched) {
		for (const s of csvRowSnapshots(row, fixture)) {
			snapshots++;
			if ((await repo.insertOddsSnapshot(s)).created) created++;
		}
	}
	unmatched.push(...result.unmatched);
	summary[file] = { rows: rows.length, matched: result.matched.length, scoreDiff, snapshots, created };
}
const counts = { team_alias: await repo.countRows('team_alias'), odds_snapshot: await repo.countRows('odds_snapshot') };
await db.close();

const total = Object.values(summary).reduce((a, s) => ({ rows: a.rows + s.rows, matched: a.matched + s.matched }), {
	rows: 0,
	matched: 0
});
writeFileSync(join(ROOT, 'data', 'history', 'unmatched-csv.json'), JSON.stringify(unmatched, null, '\t') + '\n');
console.log(`CSV-odds import → ${dataDir} (${Date.now() - started} ms)`);
console.table(summary);
console.log(
	`párosítás: ${total.matched}/${total.rows} = ${((100 * total.matched) / total.rows).toFixed(2)}%, párosítatlan: ${
		unmatched.length
	}`
);
console.table(counts);
