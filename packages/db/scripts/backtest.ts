// Backtest-futtató (S15, ROADMAP 6.3): football-data CSV-k (2022–2024, top 5 liga) → walk-forward `elo-poisson@0.1.0` vs. piaci
// baseline. 0 élő hívás, nincs DB, determinisztikus (nincs időbélyeg a kimenetben).
// Futtatás: `npm run backtest -w @football/db` → `data/backtest/backtest-v0.json` + `docs/analysis/backtest-v0.md`.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	buildBacktestReport,
	runBacktest,
	type BacktestMatch,
	type BacktestReport,
	type MarketComparison,
	type SegmentSummary
} from '@football/core';
import { parseFootballDataCsv } from '../src/import/footballData';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CSV_DIR = join(ROOT, 'data', 'history', 'football-data');
const OUT_JSON = join(ROOT, 'data', 'backtest', 'backtest-v0.json');
const OUT_MD = join(ROOT, 'docs', 'analysis', 'backtest-v0.md');
const EVAL_SEASONS = [2023, 2024];
const LEAGUE_NAME: Record<string, string> = {
	E0: 'Premier League',
	D1: 'Bundesliga',
	F1: 'Ligue 1',
	I1: 'Serie A',
	SP1: 'La Liga'
};

const teamIds = new Map<string, number>();
const teamId = (name: string) => teamIds.get(name) ?? (teamIds.set(name, teamIds.size + 1), teamIds.size);
const cols = (odds: Record<string, number>, names: string[]) =>
	names.every((n) => odds[n]) ? names.map((n) => odds[n]) : undefined;

const matches: BacktestMatch[] = [];
let skipped = 0;
for (const file of readdirSync(CSV_DIR)
	.filter((f) => /^[A-Z0-9]+-\d{4}\.csv$/.test(f))
	.sort()) {
	const [div, yy] = file.replace('.csv', '').split('-');
	const season = 2000 + Number(yy.slice(0, 2));
	for (const row of parseFootballDataCsv(readFileSync(join(CSV_DIR, file), 'utf8'))) {
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

const options = { evalSeasons: EVAL_SEASONS, evThreshold: 0.05 };
const report = buildBacktestReport(runBacktest(matches, options), options);
mkdirSync(join(ROOT, 'data', 'backtest'), { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(report, null, '\t') + '\n');
writeFileSync(OUT_MD, renderMarkdown(report));
console.log(`${matches.length} meccs (${skipped} eredmény nélkül kihagyva), ${report.matches} értékelt → ${OUT_JSON}, ${OUT_MD}`);

// --- Markdown (riport, nem UI: itt szabad a toFixed) ---
function n3(x: number | null) {
	return x === null ? '–' : x.toFixed(4).replace('.', ',');
}
function pct(x: number | null, digits = 1) {
	return x === null ? '–' : `${(x * 100).toFixed(digits).replace('.', ',')}%`;
}
function probRows(label: string, c: MarketComparison) {
	return [
		`| ${label} | ${c.model.n} | ${n3(c.model.meanLogLoss)} | ${n3(c.marketOpening.meanLogLoss)} | ${n3(
			c.marketClosing.meanLogLoss
		)} | ${n3(c.model.meanBrier)} | ${n3(c.marketOpening.meanBrier)} | ${n3(c.marketClosing.meanBrier)} |`
	];
}
function betRow(label: string, c: MarketComparison) {
	const b = c.bets;
	const se = b.roiStdError === null ? '' : ` ± ${pct(b.roiStdError)}`;
	return `| ${label} | ${b.n} | ${pct(b.hitRate)} | ${pct(b.expectedHitRate)} | ${b.profit.toFixed(2).replace('.', ',')} | ${pct(
		b.roi
	)}${se} | ${pct(b.meanClv, 2)} |`;
}
function segmentTables(title: string, segments: Record<string, SegmentSummary>, name: (k: string) => string) {
	const lines = [`### ${title}`, ''];
	for (const market of ['h2h', 'ou25'] as const) {
		lines.push(`**${market === 'h2h' ? '1X2' : 'Gólszám 2,5'}**`, '');
		lines.push(
			'| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |',
			'|---|--:|--:|--:|--:|--:|--:|--:|'
		);
		for (const [k, s] of Object.entries(segments)) lines.push(...probRows(name(k), s[market]));
		lines.push('', '| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |', '|---|--:|--:|--:|--:|--:|--:|');
		for (const [k, s] of Object.entries(segments)) lines.push(betRow(name(k), s[market]));
		lines.push('');
	}
	return lines;
}
function renderMarkdown(r: BacktestReport): string {
	const o = r.overall;
	const verdict = (m: 'h2h' | 'ou25') => {
		const d = (o[m].model.meanLogLoss ?? 0) - (o[m].marketClosing.meanLogLoss ?? 0);
		return d > 0
			? `a modell log-lossa ${n3(d)}-del rosszabb a záró piacnál`
			: `a modell log-lossa ${n3(-d)}-del jobb a záró piacnál`;
	};
	const calib = (m: 'h2h' | 'ou25') => [
		'| Vödör | n | átlag p | gyakoriság |',
		'|---|--:|--:|--:|',
		...r.calibration[m].map((b) => `| ${pct(b.lower, 0)}–${pct(b.upper, 0)} | ${b.count} | ${pct(b.meanP)} | ${pct(b.hitRate)} |`)
	];
	return [
		`# Backtest: \`${r.modelVersion}\` vs. piaci baseline`,
		'',
		'> Generált fájl (`npm run backtest -w @football/db`), kézzel ne szerkeszd. Gépi változat: `data/backtest/backtest-v0.json`.',
		'',
		'## Protokoll',
		'',
		`- Adat: football-data.co.uk CSV, top 5 liga, 2022/23–2024/25 (0 élő hívás). Bemelegítés: 2022; értékelt szezonok: ${r.evalSeasons.join(
			', '
		)} (${r.matches} meccs).`,
		'- Walk-forward: kezdés szerinti sorrend, az Elo inkrementális, az azonos napi meccsek egymás eredményét nem látják. A paraméterek fixek (`DEFAULT_ELO_POISSON_PARAMS`), illesztés nincs → mindkét értékelt szezon out-of-sample.',
		'- Baseline: piaci átlag nyitó (`Avg*`) és záró (`AvgC*`) odds, arányos marzs-levonással. LL = átlagos log-loss, Brier = többosztályos Brier (kisebb a jobb). Páros összevetés: csak a nyitó és záró oddsszal is rendelkező meccsek.',
		`- Értéktipp: piaconként a legnagyobb EV-jű kimenet, ha \`p · odds − 1 ≥ ${pct(
			r.evThreshold,
			0
		)}\`; flat 1 egység a Bet365 nyitó oddsán; CLV a Bet365 záróhoz (\`odds / záró − 1\`).`,
		'- Ismert torzítás: a „nyitó” odds a CSV-letöltés pillanatának oddsa (péntek/kedd), nem a valódi nyitó; a kezdési időpont napra kerekítve.',
		'',
		'## Összegzés',
		'',
		`- 1X2: ${verdict('h2h')}.`,
		`- Gólszám 2,5: ${verdict('ou25')}.`,
		`- Értéktippek: 1X2 ${o.h2h.bets.n} db, ROI ${pct(o.h2h.bets.roi)}, CLV ${pct(o.h2h.bets.meanClv, 2)}; O/U ${
			o.ou25.bets.n
		} db, ROI ${pct(o.ou25.bets.roi)}, CLV ${pct(o.ou25.bets.meanClv, 2)}.`,
		'- Értelmezés: amíg a modell a záró piacnál rosszabbul jósol, a „value” jelzései főleg modellhibák; a v1 (ROADMAP 6.x/7.x) célja a piaci rés csökkentése, a piaci kombinálás (`w`) és az EV-küszöb hangolása CLV alapján.',
		'',
		'## Eredmények',
		'',
		...segmentTables('Összesen', { all: o }, () => 'Összes'),
		...segmentTables('Szezononként', r.bySeason, (k) => `${k}/${String(Number(k) + 1).slice(2)}`),
		...segmentTables('Ligánként', r.byLeague, (k) => LEAGUE_NAME[k] ?? k),
		'## Kalibráció (modell)',
		'',
		'**1X2** (minden kimenet egy pont)',
		'',
		...calib('h2h'),
		'',
		'**Gólszám 2,5**',
		'',
		...calib('ou25'),
		''
	].join('\n');
}
