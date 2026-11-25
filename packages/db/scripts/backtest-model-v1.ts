// Modell v1 backtest-riport (I26, ROADMAP 6.2b/6.3, docs/plans/model-v1.md): v0 `elo-poisson@0.1.0`, M1 `elo-logit@1.0.0` és
// M2 `dixon-coles@1.0.0` a zárolt 2024-es holdouton, a piaci nyitó/záró odds mellett (1X2 + O/U 2,5). Hangolás csak 2022–2023-on:
// M1 illesztés 2022–2023; M2 hiperparaméterei (ξ, ridge) rácskereséssel a 2023-as walk-forward validáción (tanítóadat: 2022 +
// a 2023-as meccs előtti meccsek). 0 élő hívás, nincs DB, determinisztikus.
// Futtatás: `npm run backtest:v1 -w @football/db` → `docs/analysis/backtests/2026-11-16-model-v1.md`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	calibrationBuckets,
	dixonColesWalkForward,
	eloLogitSamples,
	fitDixonColes,
	fitOrdinalLogit,
	ordinalLogitProbabilities,
	outcome1x2,
	overUnderOutcome,
	pickValueBet,
	runBacktest,
	summarizeBets,
	summarizeProbabilities,
	type BacktestMarket,
	type BacktestRecord,
	type DixonColesWalkForwardOptions
} from '@football/core';
import { LEAGUE_NAME, loadBacktestMatches, ROOT } from './backtestData';

// A riport dátuma rögzített (a kimenet determinisztikus); új futtatásnál új fájlnév.
const OUT_MD = join(ROOT, 'docs', 'analysis', 'backtests', '2026-11-16-model-v1.md');
const TRAIN = [2022, 2023];
const VALIDATION = 2023;
const HOLDOUT = 2024;
const EV_THRESHOLD = 0.05;
const DC_BASE: DixonColesWalkForwardOptions = { refitDays: 1, windowDays: 730 };
const XI_GRID = [0, 0.001, 0.002, 0.004];
const RIDGE_GRID = [1, 4, 16];

const { matches } = loadBacktestMatches();
const byId = new Map(matches.map((m) => [m.id, m]));
const t0 = Date.now();

// --- M2: hiperparaméter-rács a 2023-as validáción (a holdout itt nem szerepel) ---
const validation = matches.filter((m) => m.season === VALIDATION);
const grid: Array<{ xi: number; ridge: number; ll1x2: number; llOu: number }> = [];
for (const xi of XI_GRID)
	for (const ridge of RIDGE_GRID) {
		const preds = dixonColesWalkForward(
			matches.filter((m) => m.season <= VALIDATION),
			(m) => m.season === VALIDATION,
			{ ...DC_BASE, xi, ridge }
		);
		const s = (market: BacktestMarket) =>
			summarizeProbabilities(
				validation.map((m) => {
					const p = preds.get(m.id)!.probabilities;
					return market === 'h2h'
						? { probabilities: [p.home, p.draw, p.away], outcomeIndex: outcome1x2(m.homeGoals, m.awayGoals) }
						: { probabilities: [p.over25, p.under25], outcomeIndex: overUnderOutcome(m.homeGoals + m.awayGoals, 2.5)! };
				})
			).meanLogLoss!;
		grid.push({ xi, ridge, ll1x2: s('h2h'), llOu: s('ou25') });
		console.log(`rács ξ=${xi} ridge=${ridge}: ${(Date.now() - t0) / 1000}s`);
	}
const best = [...grid].sort((a, b) => a.ll1x2 + a.llOu - (b.ll1x2 + b.llOu))[0];
const dcOptions = { ...DC_BASE, xi: best.xi, ridge: best.ridge };
const endOfTrain = matches.filter((m) => TRAIN.includes(m.season)).reduce((a, m) => (m.kickoff > a ? m.kickoff : a), '');
const trainFit = fitDixonColes(
	matches.filter((m) => TRAIN.includes(m.season)),
	{ ...dcOptions, asOf: new Date(Date.parse(endOfTrain) + 86_400_000).toISOString() }
);

// --- Holdout 2024: walk-forward predikciók ---
const dc = dixonColesWalkForward(matches, (m) => m.season === HOLDOUT, dcOptions);
console.log(`M2 holdout: ${(Date.now() - t0) / 1000}s`);
const { samples } = eloLogitSamples(matches, () => true);
const m1Fit = fitOrdinalLogit(samples.filter((s) => TRAIN.includes(byId.get(s.id)!.season)));
const m1Diff = new Map(samples.map((s) => [s.id, s.diff]));
const v0 = runBacktest(matches, { evalSeasons: [HOLDOUT], evThreshold: EV_THRESHOLD });

type Model = { name: string; markets: BacktestMarket[]; probs: (r: BacktestRecord) => Partial<Record<BacktestMarket, number[]>> };
const MODELS: Model[] = [
	{ name: '`elo-poisson@0.1.0` (v0)', markets: ['h2h', 'ou25'], probs: (r) => r.model },
	{
		name: '`elo-logit@1.0.0` (M1)',
		markets: ['h2h'],
		probs: (r) => {
			const p = ordinalLogitProbabilities(m1Diff.get(r.id)!, m1Fit.params);
			return { h2h: [p.home, p.draw, p.away] };
		}
	},
	{
		name: '`dixon-coles@1.0.0` (M2)',
		markets: ['h2h', 'ou25'],
		probs: (r) => {
			const p = dc.get(r.id)!.probabilities;
			return { h2h: [p.home, p.draw, p.away], ou25: [p.over25, p.under25] };
		}
	}
];

// --- Riport ---
const f4 = (x: number | null) => (x === null ? '–' : x.toFixed(4).replace('.', ','));
const pct = (x: number | null, d = 1) => (x === null ? '–' : `${(x * 100).toFixed(d).replace('.', ',')}%`);
const MARKET_LABEL: Record<BacktestMarket, string> = { h2h: '1X2', ou25: 'Gólszám 2,5' };
const paired = (rs: readonly BacktestRecord[], market: BacktestMarket) =>
	rs.filter((r) => r.marketOpening[market] && r.marketClosing[market]);
const summary = (rs: readonly BacktestRecord[], market: BacktestMarket, pick: (r: BacktestRecord) => number[]) =>
	summarizeProbabilities(rs.map((r) => ({ probabilities: pick(r), outcomeIndex: r.outcome[market] })));

const probTable = (market: BacktestMarket) => {
	const rs = paired(v0, market);
	const rows = [
		...MODELS.filter((m) => m.markets.includes(market)).map((m) => ({
			name: m.name,
			s: summary(rs, market, (r) => m.probs(r)[market]!)
		})),
		{ name: 'piac nyitó', s: summary(rs, market, (r) => r.marketOpening[market]!) },
		{ name: 'piac záró', s: summary(rs, market, (r) => r.marketClosing[market]!) }
	];
	return [
		`**${MARKET_LABEL[market]}** (páros n = ${rs.length})`,
		'',
		'| Modell | log-loss | Brier |',
		'|---|--:|--:|',
		...rows.map((x) => `| ${x.name} | ${f4(x.s.meanLogLoss)} | ${f4(x.s.meanBrier)} |`),
		''
	];
};

const betTable = () => {
	const lines = [
		'| Modell | Piac | tippek | találat | várt | profit (egység) | ROI | CLV |',
		'|---|---|--:|--:|--:|--:|--:|--:|'
	];
	for (const m of MODELS)
		for (const market of m.markets) {
			const bets = v0.flatMap((r) => {
				const b = pickValueBet(m.probs(r)[market]!, byId.get(r.id)!.odds[market], r.outcome[market], EV_THRESHOLD);
				return b ? [b] : [];
			});
			const s = summarizeBets(bets);
			const se = s.roiStdError === null ? '' : ` ± ${pct(s.roiStdError)}`;
			lines.push(
				`| ${m.name} | ${MARKET_LABEL[market]} | ${s.n} | ${pct(s.hitRate)} | ${pct(s.expectedHitRate)} | ${s.profit
					.toFixed(2)
					.replace('.', ',')} | ${pct(s.roi)}${se} | ${pct(s.meanClv, 2)} |`
			);
		}
	return lines;
};

const leagueTable = (market: BacktestMarket) => {
	const models = MODELS.filter((m) => m.markets.includes(market));
	const leagues = [...new Set(v0.map((r) => r.league))].sort();
	return [
		`**${MARKET_LABEL[market]}** – log-loss ligánként`,
		'',
		`| Liga | n | ${models.map((m) => m.name).join(' | ')} | piac záró |`,
		`|---|--:|${models.map(() => '--:|').join('')}--:|`,
		...leagues.map((l) => {
			const rs = paired(
				v0.filter((r) => r.league === l),
				market
			);
			const cells = models.map((m) => f4(summary(rs, market, (r) => m.probs(r)[market]!).meanLogLoss));
			const closing = f4(summary(rs, market, (r) => r.marketClosing[market]!).meanLogLoss);
			return `| ${LEAGUE_NAME[l] ?? l} | ${rs.length} | ${cells.join(' | ')} | ${closing} |`;
		}),
		''
	];
};

const calibTable = (market: BacktestMarket) => [
	`**${MARKET_LABEL[market]}** (M2, minden kimenet egy pont)`,
	'',
	'| Vödör | n | átlag p | gyakoriság |',
	'|---|--:|--:|--:|',
	...calibrationBuckets(v0.flatMap((r) => MODELS[2].probs(r)[market]!.map((p, i) => ({ p, hit: r.outcome[market] === i })))).map(
		(b) => `| ${pct(b.lower, 0)}–${pct(b.upper, 0)} | ${b.count} | ${pct(b.meanP)} | ${pct(b.hitRate)} |`
	),
	''
];

const ll = (market: BacktestMarket, pick: (r: BacktestRecord) => number[] | undefined) =>
	summary(paired(v0, market), market, (r) => pick(r)!).meanLogLoss!;
const gap = (market: BacktestMarket) =>
	ll(market, (r) => MODELS[2].probs(r)[market]) - ll(market, (r) => r.marketClosing[market]);
const vsV0 = (market: BacktestMarket) => ll(market, (r) => MODELS[2].probs(r)[market]) - ll(market, (r) => r.model[market]);
const signed = (x: number) => `${x > 0 ? '+' : '−'}${f4(Math.abs(x))}`;

const leaguesFit = Object.entries(trainFit.params.leagues)
	.map(([k, v]) => `${LEAGUE_NAME[k] ?? k} ${f4(Math.exp(v.homeAdvantage))}`)
	.join(', ');

const md = [
	'# Backtest: modell v1 (v0 · M1 · M2) vs. piaci baseline',
	'',
	'> Generált fájl (`npm run backtest:v1 -w @football/db`), kézzel ne szerkeszd. Terv és protokoll: `docs/plans/model-v1.md`.',
	'',
	'## Protokoll',
	'',
	'- Adat: football-data.co.uk CSV, top 5 liga, 2022/23–2024/25 (0 élő hívás). **Holdout: 2024/25, zárolt** (hangolásra nem használt).',
	`- v0 \`elo-poisson@0.1.0\`: fix paraméterek, walk-forward Elo/tempó (változatlan). M1 \`elo-logit@1.0.0\`: β, c1, c2 illesztve 2022–2023-on (n = ${
		samples.filter((s) => TRAIN.includes(byId.get(s.id)!.season)).length
	}), az Elo walk-forward léptetve.`,
	`- M2 \`dixon-coles@1.0.0\`: ML-illesztés (támadó/védő erő csapatonként, μ és hazai előny ligánként, közös ρ), időbeli súly \`exp(−ξ·nap)\`, ridge az att/def-en, ablak ${DC_BASE.windowDays} nap. Walk-forward: ${DC_BASE.refitDays} naponta újraillesztve, mindig csak a kezdés előtti meccsekből (az erősségek a holdout alatt is frissülnek, a hiperparaméterek nem).`,
	`- M2 hiperparaméterei: rácskeresés a 2023/24-es validáción (walk-forward, tanítóadat a 2022/23 + a meccs előtti 2023/24), cél: 1X2 + O/U 2,5 log-loss összege. Választás: **ξ = ${best.xi}/nap, ridge = ${best.ridge}**.`,
	`- Mérőszám: átlag log-loss és többosztályos Brier, páros minta (nyitó + záró átlag-odds is van); baseline: piaci nyitó (\`Avg*\`) / záró (\`AvgC*\`), arányos marzs-levonással. Értéktipp: \`p · odds − 1 ≥ ${pct(
		EV_THRESHOLD,
		0
	)}\`, flat 1 egység a Bet365 nyitón, CLV a Bet365 záróhoz.`,
	'- Ismert torzítás: a „nyitó” odds a CSV-letöltés pillanatáé; a kezdés napra kerekítve; a feljutó csapat első meccsein M2-ben ligaátlag (nincs másodosztályos adat).',
	'',
	'## Összegzés',
	'',
	`- 1X2: M2 log-lossa ${signed(vsV0('h2h'))} a v0-hoz és ${signed(gap('h2h'))} a záró piachoz képest.`,
	`- Gólszám 2,5: M2 log-lossa ${signed(vsV0('ou25'))} a v0-hoz és ${signed(gap('ou25'))} a záró piachoz képest.`,
	'- Élesítés (6.5 🔶 shadow → live) a tulajdonos döntése; a predikció-pipeline változatlanul a v0-t futtatja.',
	'',
	'## Holdout 2024/25: valószínűségi pontosság',
	'',
	...probTable('h2h'),
	...probTable('ou25'),
	'## Értéktippek (holdout)',
	'',
	...betTable(),
	'',
	'## Ligánként (holdout)',
	'',
	...leagueTable('h2h'),
	...leagueTable('ou25'),
	'## Kalibráció (M2, holdout)',
	'',
	...calibTable('h2h'),
	...calibTable('ou25'),
	'## M2 hiperparaméter-rács (validáció 2023/24, log-loss)',
	'',
	'| ξ (/nap) | ridge | 1X2 | O/U 2,5 | összeg | |',
	'|--:|--:|--:|--:|--:|---|',
	...grid.map(
		(g) =>
			`| ${String(g.xi).replace('.', ',')} | ${g.ridge} | ${f4(g.ll1x2)} | ${f4(g.llOu)} | ${f4(g.ll1x2 + g.llOu)} | ${
				g === best ? '← választott' : ''
			} |`
	),
	'',
	'## M2 illesztés a tanítóidőszak végén (2022–2023)',
	'',
	`- n = ${trainFit.matches} meccs, ${trainFit.iterations} iteráció, konvergált: ${trainFit.converged ? 'igen' : 'nem'}; ρ = ${f4(
		trainFit.params.rho
	)}.`,
	`- Hazai előny (gólszorzó, \`exp(γ)\`): ${leaguesFit}.`,
	''
].join('\n');

mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, md);
console.log(`→ ${OUT_MD} (${(Date.now() - t0) / 1000}s)`);
