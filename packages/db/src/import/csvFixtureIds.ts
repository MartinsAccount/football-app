// CSV-sor → DB `fixture.id` leképezés (I20b): a pillanatkép-generátorok (ajánlás, arbitrázs) ugyanazzal az S11b-párosítással
// (`matchCsvRows`: liga + dátum ±1 nap + csapatnév/alias) írják a meccs-azonosítót, mint az `import:odds-csv`, így a web
// `/match/:id` linkje a DB-meccsre mutat. DB-t nem olvas: a párosítás a mentett API-Football fixture-fájlokból determinisztikus.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIV_LEAGUE, matchCsvRows, parseFootballDataCsv, type CsvMatchRow, type MatchResult } from './footballData';
import { mapLegacyFixtures, type LegacyFixturesFile } from './legacy';

/** Egy CSV-sor kulcsa: liga-kód + dátum + a CSV csapatnevei (egy ligában egy nap egy párosítás egyszer szerepel). */
export const csvRowKey = (row: Pick<CsvMatchRow, 'div' | 'date' | 'home' | 'away'>): string =>
	`${row.div}|${row.date}|${row.home}|${row.away}`;

/** A párosított sorokból kulcs → DB fixture-id. */
export function csvFixtureIdIndex(matched: MatchResult['matched']): Map<string, number> {
	return new Map(matched.map(({ row, fixture }) => [csvRowKey(row), fixture.id]));
}

/** A DB fixture-id egy CSV-sorhoz; párosítatlan sornál hiba (a pillanatkép ne kapjon hamis id-t). */
export function fixtureIdFor(index: Map<string, number>, row: Pick<CsvMatchRow, 'div' | 'date' | 'home' | 'away'>): number {
	const id = index.get(csvRowKey(row));
	if (id === undefined) throw new Error(`Párosítatlan CSV-sor (nincs DB fixture-id): ${csvRowKey(row)}`);
	return id;
}

/** A `<div>-<yyyy>.csv` fájlok (opcionális szűrővel) párosítása a `fixtures-<liga>-<szezon>.json` API-fájlokra. */
export function loadCsvFixtureIds(csvDir: string, apiDir: string, filePattern = /^[A-Z0-9]+-\d{4}\.csv$/): Map<string, number> {
	const index = new Map<string, number>();
	for (const file of readdirSync(csvDir)
		.filter((f) => filePattern.test(f))
		.sort()) {
		const [div, yy] = file.replace('.csv', '').split('-');
		const leagueId = DIV_LEAGUE[div];
		const season = 2000 + Number(yy.slice(0, 2));
		const api = JSON.parse(readFileSync(join(apiDir, `fixtures-${leagueId}-${season}.json`), 'utf8')) as LegacyFixturesFile;
		const { fixtures, teams } = mapLegacyFixtures([api]);
		const rows = parseFootballDataCsv(readFileSync(join(csvDir, file), 'utf8'));
		const result = matchCsvRows(
			rows,
			fixtures.filter((f) => f.leagueId === leagueId && f.season === season),
			teams
		);
		for (const [key, id] of csvFixtureIdIndex(result.matched)) index.set(key, id);
	}
	return index;
}
