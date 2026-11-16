// Arbitrázs-pillanatkép (S23, ROADMAP 8.1): a mentett football-data CSV „nyitó” oddsaiból irodák közti
// arbitrázs-pásztázás 1X2-re és Gól 2,5-re, a core `scanMarket`-tel. 0 élő hívás, nincs DB, determinisztikus.
// Futtatás: `npm run arbitrage -w @football/db` → `data/arbitrage/arbitrage-v0.json`.
// A `fixtureId` a DB (API-Football) meccs-id-ja az S11b-párosításból (I20b).
// TODO(polish): DB `odds_snapshot`-ból (api-football `early`/`late`), a beállított ligákra/irodákra (ROADMAP 8.1/8.3).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanMarket, type ArbitrageFixture, type ArbitrageQuote, type ArbitrageSnapshot } from '@football/core';
import { fixtureIdFor, loadCsvFixtureIds } from '../src/import/csvFixtureIds';
import { csvKickoffUtc, OPENING_OFFSET_MS, parseFootballDataCsv } from '../src/import/footballData';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'history', 'football-data');
const API_DIR = join(ROOT, 'data', 'history', 'api-football');
const OUT_DIR = join(ROOT, 'data', 'arbitrage');
const OUT_JSON = join(OUT_DIR, 'arbitrage-v0.json');

/** Ugyanaz a mentett „most”, mint az ajánlásoknál (S18): szombat 09:00 Budapest; a következő 10 nap (2 forduló) meccsei. */
const NOW = '2025-04-12T07:00:00.000Z';
const UNTIL = '2025-04-22T00:00:00.000Z';

const LEAGUE_NAME: Record<string, string> = {
	E0: 'Premier League',
	D1: 'Bundesliga',
	F1: 'Ligue 1',
	I1: 'Serie A',
	SP1: 'La Liga'
};
/** CSV-oszlop-előtag → iroda. A tőzsde (BFE) és az átlag/maximum oszlopok kimaradnak (nem fogadható iroda). */
const MARKETS = [
	{
		key: 'h2h',
		label: 'Végeredmény',
		outcomes: [
			{ key: 'Home', label: 'Hazai', col: 'H' },
			{ key: 'Draw', label: 'Döntetlen', col: 'D' },
			{ key: 'Away', label: 'Vendég', col: 'A' }
		],
		books: [
			['B365', 'Bet365'],
			['BW', 'Bwin'],
			['BF', 'Betfair'],
			['PS', 'Pinnacle'],
			['WH', 'William Hill'],
			['1XB', '1xBet']
		]
	},
	{
		key: 'ou25',
		label: 'Gólok 2,5',
		outcomes: [
			{ key: 'Over', label: 'Több mint 2,5', col: '>2.5' },
			{ key: 'Under', label: 'Kevesebb mint 2,5', col: '<2.5' }
		],
		books: [
			['B365', 'Bet365'],
			['P', 'Pinnacle']
		]
	}
];

const fixtures: ArbitrageFixture[] = [];
const CSV_FILES = /^[A-Z0-9]+-2425\.csv$/;
const dbFixtureIds = loadCsvFixtureIds(CSV_DIR, API_DIR, CSV_FILES);
const files = readdirSync(CSV_DIR)
	.filter((f) => CSV_FILES.test(f))
	.sort();
for (const file of files) {
	const div = file.split('-')[0];
	for (const row of parseFootballDataCsv(readFileSync(join(CSV_DIR, file), 'utf8'))) {
		const kickoff = csvKickoffUtc(row.date, row.time);
		if (kickoff <= NOW || kickoff >= UNTIL) continue;
		fixtures.push({
			fixtureId: fixtureIdFor(dbFixtureIds, row),
			league: LEAGUE_NAME[div] ?? div,
			kickoff,
			home: row.home,
			away: row.away,
			// A CSV „nyitó” oddsának pontos ideje nincs meg: kezdés − 48 óra (mint az `import:odds-csv`).
			oddsAt: new Date(Date.parse(kickoff) - OPENING_OFFSET_MS).toISOString(),
			opportunities: MARKETS.map((m) => {
				const quotes: ArbitrageQuote[] = m.books.flatMap(([prefix, bookmaker]) =>
					m.outcomes.flatMap((o) => {
						const odds = row.odds[`${prefix}${o.col}`];
						return odds > 1 ? [{ bookmaker, outcome: o.key, odds }] : [];
					})
				);
				return scanMarket(
					m.key,
					m.outcomes.map((o) => o.key),
					quotes
				);
			})
		});
	}
}
// Stabil rendezés kezdésre: azonos kezdésnél a CSV-sorrend marad (a DB-id nem sorrend-kulcs).
fixtures.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

const snapshot: ArbitrageSnapshot = {
	generatedAt: NOW, // determinisztikus kimenet (a 2. futás nem változtat a fájlon)
	now: NOW,
	source: 'football-data CSV (2024/25, nyitó odds)',
	markets: MARKETS.map((m) => ({ key: m.key, label: m.label, outcomes: m.outcomes.map(({ key, label }) => ({ key, label })) })),
	bookmakers: [...new Set(MARKETS.flatMap((m) => m.books.map(([, b]) => b)))],
	fixtures
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(snapshot, null, '\t') + '\n');

const opps = fixtures.flatMap((f) => f.opportunities);
const count = (band: string) => opps.filter((o) => o.band === band).length;
console.log(
	`arbitrage → ${OUT_JSON}: ${fixtures.length} meccs, ${opps.length} piac; arb ${count('arb')}, közel ${count('near')}`
);
