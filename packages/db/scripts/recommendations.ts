// Ajánlás-pillanatkép (S18, ROADMAP 5.4): egy mentett hétvége (2025-04-12/13, top 5 liga) meccseire `elo-poisson` predikció +
// piaci kombinálás + §5 szűrők, a football-data CSV-kből. 0 élő hívás, nincs DB, determinisztikus.
// Futtatás: `npm run recommendations -w @football/db` → `data/recommendations/recommendations-v0.json`.
// A `fixtureId` a DB (API-Football) meccs-id-ja az S11b-párosításból (I20b), így a TipCard `/match/:id` linkje működik.
// TODO(polish): DB-ből (prediction_run/prediction) olvasni, ha a 5.2 predikció-pipeline kész; API-Football csapatnevek.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	blendReason,
	confidenceLevel,
	dataWarnings,
	DEFAULT_RECOMMENDATION_RULES,
	deriveStandings,
	eloPoissonPrediction,
	evaluateMarket,
	ELO_POISSON_VERSION,
	pickRecommendation,
	SNAPSHOT_OUTCOMES,
	teamMotivation,
	teamView,
	type BookmakerOdds,
	type Motivation,
	type PlayedMatch,
	type RecommendationItem,
	type RecommendationSnapshot,
	type SnapshotMarket,
	type SnapshotTeam,
	type StandingRow
} from '@football/core';
import { fixtureIdFor, loadCsvFixtureIds } from '../src/import/csvFixtureIds';
import { csvKickoffUtc, parseFootballDataCsv, type CsvMatchRow } from '../src/import/footballData';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'history', 'football-data');
const API_DIR = join(ROOT, 'data', 'history', 'api-football');
const OUT_DIR = join(ROOT, 'data', 'recommendations');
const OUT_JSON = join(OUT_DIR, 'recommendations-v0.json');

/** A mentett „mai nap”: szombat 09:00 Budapest; a nap és a holnap meccsei kerülnek a listára. */
const NOW = '2025-04-12T07:00:00.000Z';
const DAYS = ['2025-04-12', '2025-04-13'];
/** A CSV „nyitó” oddsa a péntek délutáni letöltés (football-data); pontos időbélyeg nincs, közelítés. */
const ODDS_AT = '2025-04-11T14:00:00.000Z';
const STAKE_UNITS = 1;

const LEAGUE_NAME: Record<string, string> = {
	E0: 'Premier League',
	D1: 'Bundesliga',
	F1: 'Ligue 1',
	I1: 'Serie A',
	SP1: 'La Liga'
};
/** Irodák a CSV-oszlop-előtagokkal (a tőzsde – BFE – kimarad: jutalék, nem fogadóiroda). */
const H2H_BOOKS: [string, string][] = [
	['B365', 'Bet365'],
	['BF', 'Betfair'],
	['PS', 'Pinnacle'],
	['1XB', '1xBet']
];
const OU_BOOKS: [string, string][] = [
	['B365', 'Bet365'],
	['P', 'Pinnacle']
];
const STAKE_TEXT: Record<string, string> = { cim: 'bajnoki címért', europa: 'európai kupahelyért', kieses: 'bennmaradásért' };

interface CsvMatch extends PlayedMatch {
	league: string;
	season: number;
	odds: Record<string, number>;
	played: boolean;
	row: CsvMatchRow;
}

const teamIds = new Map<string, number>();
const teamNames = new Map<number, string>();
const teamId = (name: string) => {
	if (!teamIds.has(name)) {
		teamIds.set(name, teamIds.size + 1);
		teamNames.set(teamIds.size, name);
	}
	return teamIds.get(name)!;
};

const all: CsvMatch[] = [];
for (const file of readdirSync(CSV_DIR)
	.filter((f) => /^[A-Z0-9]+-\d{4}\.csv$/.test(f))
	.sort()) {
	const [div, yy] = file.replace('.csv', '').split('-');
	for (const row of parseFootballDataCsv(readFileSync(join(CSV_DIR, file), 'utf8'))) {
		all.push({
			id: all.length + 1,
			kickoff: csvKickoffUtc(row.date, row.time),
			homeTeamId: teamId(row.home),
			awayTeamId: teamId(row.away),
			homeGoals: row.goalsHome ?? 0,
			awayGoals: row.goalsAway ?? 0,
			played: row.goalsHome !== null && row.goalsAway !== null,
			league: div,
			season: 2000 + Number(yy.slice(0, 2)),
			odds: row.odds,
			row
		});
	}
}

const dbFixtureIds = loadCsvFixtureIds(CSV_DIR, API_DIR);
const nowMs = Date.parse(NOW);
// Pont-idejű: csak a „most” előtt lejátszott meccsek látszanak (a szombati eredmények a vasárnapi predikciónál sem).
const history = all.filter((m) => m.played && Date.parse(m.kickoff) < nowMs).sort((a, b) => a.kickoff.localeCompare(b.kickoff));
const targets = all
	.filter((m) => DAYS.includes(m.kickoff.slice(0, 10)) && Date.parse(m.kickoff) > nowMs)
	.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id - b.id);

const bookOdds = (m: CsvMatch, books: [string, string][], suffixes: string[]): BookmakerOdds[] =>
	books.flatMap(([prefix, bookmaker]) => {
		const odds = suffixes.map((s) => m.odds[`${prefix}${s}`]);
		return odds.every((o) => o > 1) ? [{ bookmaker, odds }] : [];
	});

const stakeText = (mot: Motivation | null): string | undefined => {
	if (!mot?.zone) return undefined;
	return mot.level === 'kritikus' ? `${STAKE_TEXT[mot.zone]} (kritikus)` : STAKE_TEXT[mot.zone];
};

const lastN = (teamIdValue: number, n: number) =>
	history
		.flatMap((m) => {
			const v = teamView(m, teamIdValue);
			return v ? [{ m, v }] : [];
		})
		.slice(-n);

const team = (id: number, table: StandingRow[], mot: Motivation | null): SnapshotTeam => {
	const row = table.find((r) => r.teamId === id);
	return {
		name: teamNames.get(id)!,
		rank: row?.position,
		points: row?.points,
		goalDiff: row?.goalDiff,
		stake: stakeText(mot),
		last5: lastN(id, 5).map(({ m, v }) => ({
			result: v.result,
			opponent: teamNames.get(v.opponentId)!,
			home: v.isHome,
			goalsFor: v.goalsFor,
			goalsAgainst: v.goalsAgainst,
			date: m.kickoff
		}))
	};
};

// A CSV-ben 2024/25-re 1X2-re 4, O/U-ra 2 iroda van: az 5-irodás szabály itt nem teljesíthető (DECISIONS.md), a UI jelzi.
const rules = { ...DEFAULT_RECOMMENDATION_RULES, minBookmakers: 2 };
const oddsAgeMs = nowMs - Date.parse(ODDS_AT);
const items: RecommendationItem[] = [];
const rejected = new Map<string, number>();

for (const m of targets) {
	const leagueHistory = history.filter((x) => x.league === m.league);
	const seasonMatches = leagueHistory.filter((x) => x.season === m.season);
	const seasonTeams = [
		...new Set(all.filter((x) => x.league === m.league && x.season === m.season).flatMap((x) => [x.homeTeamId, x.awayTeamId]))
	];
	const table = deriveStandings(seasonMatches, m.kickoff, seasonTeams);
	const pred = eloPoissonPrediction(m, { history, leagueMatches: leagueHistory });
	const pr = pred.probabilities;
	const h2h = history
		.filter((x) => teamView(x, m.homeTeamId)?.opponentId === m.awayTeamId)
		.slice(-5)
		.reverse();
	const played = (id: number) => table.find((r) => r.teamId === id)?.played ?? 0;
	const warnings = dataWarnings({
		oddsAgeMs,
		homeMatches: played(m.homeTeamId),
		awayMatches: played(m.awayTeamId),
		h2hMatches: h2h.length
	});
	const blocked = warnings.some((w) => w.blocking);
	const evaluations = [
		{
			market: 'h2h' as SnapshotMarket,
			e: evaluateMarket([pr.home, pr.draw, pr.away], bookOdds(m, H2H_BOOKS, ['H', 'D', 'A']), rules, blocked)
		},
		{
			market: 'ou25' as SnapshotMarket,
			e: evaluateMarket([pr.over25, pr.under25], bookOdds(m, OU_BOOKS, ['>2.5', '<2.5']), rules, blocked)
		}
	];
	for (const { e } of evaluations) for (const r of e?.rejections ?? []) rejected.set(r, (rejected.get(r) ?? 0) + 1);
	const pick = pickRecommendation(evaluations.map(({ market, e }) => (e ? { ...e, market } : null)));
	if (!pick) continue;
	const factorTexts = pred.explanation.map((f) => f.text);
	items.push({
		fixtureId: fixtureIdFor(dbFixtureIds, m.row),
		league: LEAGUE_NAME[m.league] ?? m.league,
		leagueSize: table.length,
		kickoff: m.kickoff,
		market: pick.market,
		outcome: SNAPSHOT_OUTCOMES[pick.market][pick.outcomeIndex],
		pModel: pick.pFinal,
		pModelRaw: pick.pModelRaw,
		pMarket: pick.pMarket,
		bestOdds: pick.odds,
		bookmaker: pick.bookmaker,
		bookmakers: pick.bookmakers,
		oddsAt: ODDS_AT,
		minOdds: pick.minOdds,
		ev: pick.ev,
		confidence: confidenceLevel({
			edge: pick.edge,
			seasonMatches: Math.min(played(m.homeTeamId), played(m.awayTeamId)),
			oddsAgeMs
		}),
		warnings: warnings.map((w) => w.text),
		reasons: [...factorTexts, blendReason(pick.pModelRaw, pick.pFinal, rules.blendWeight)],
		stakeUnits: STAKE_UNITS,
		modelVersion: ELO_POISSON_VERSION,
		home: team(m.homeTeamId, table, teamMotivation(table, m.homeTeamId)),
		away: team(m.awayTeamId, table, teamMotivation(table, m.awayTeamId)),
		h2h: h2h.map((x) => {
			const v = teamView(x, m.homeTeamId)!;
			return {
				date: x.kickoff,
				homeName: teamNames.get(x.homeTeamId)!,
				awayName: teamNames.get(x.awayTeamId)!,
				homeGoals: x.homeGoals,
				awayGoals: x.awayGoals,
				result: v.result
			};
		})
	});
}

const snapshot: RecommendationSnapshot = {
	modelVersion: ELO_POISSON_VERSION,
	now: NOW,
	source: 'football-data.co.uk CSV (2022/23–2024/25), mentett adat',
	rules,
	analyzed: targets.length,
	items
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(snapshot, null, '\t') + '\n');
console.log(`${targets.length} meccs elemezve, ${items.length} ajánlás → ${OUT_JSON}`);
console.log('Elutasítási okok (piaconként):', Object.fromEntries(rejected));
