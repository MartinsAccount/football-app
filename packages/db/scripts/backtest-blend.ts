// Piaci kombinálás + EV-küszöb hangolása (I26b, ROADMAP 7.3, docs/plans/model-v1.md): a v0 `elo-poisson@0.1.0` és az M2
// `dixon-coles@1.0.0` valószínűségét a nyitó, marzs nélküli piaci átlaggal keverjük (`logit` / `linear`, súly `w`). Hangolás
// KIZÁRÓLAG a 2023/24-es validáción (walk-forward, tanítóadat 2022 + a meccs előtti 2023): `w` és a módszer a log-loss
// minimuma (1X2 + O/U 2,5), a küszöb a legnagyobb CLV (≥ MIN_BETS tipp). A 2024/25-ös holdoutot csak a végső, egyszeri táblázat
// nézi. 0 élő hívás, nincs DB, determinisztikus. Az élő pipeline (`DEFAULT_RECOMMENDATION_RULES`) NEM változik (7.3 élesítés 🔶).
// Futtatás: `npm run backtest:blend -w @football/db` → `docs/analysis/backtests/2026-11-16-blend.md`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	blendBets,
	blendScores,
	chooseThreshold,
	DEFAULT_RECOMMENDATION_RULES,
	dixonColesWalkForward,
	runBacktest,
	summarizeBets,
	type BacktestMarket,
	type BacktestRecord,
	type BetSummary,
	type BlendMethod,
	type BlendSample,
	type DixonColesWalkForwardOptions,
	type ThresholdCandidate
} from '@football/core';
import { loadBacktestMatches, ROOT } from './backtestData';

const OUT_MD = join(ROOT, 'docs', 'analysis', 'backtests', '2026-11-16-blend.md');
const VALIDATION = 2023;
const HOLDOUT = 2024;
const MARKETS: BacktestMarket[] = ['h2h', 'ou25'];
/** I26-ban a 2023-as validáción választott M2-hiperparaméterek (DECISIONS.md, 2026-11-16). */
const DC: DixonColesWalkForwardOptions = { refitDays: 1, windowDays: 730, xi: 0.002, ridge: 4 };
const WEIGHTS = [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
const METHODS: BlendMethod[] = ['logit', 'linear'];
const THRESHOLDS = [0, 0.02, 0.03, 0.05, 0.08, 0.1, 0.15];
const MIN_BETS = 100;
const RAW_THRESHOLD = 0.05;

const { matches } = loadBacktestMatches();
const byId = new Map(matches.map((m) => [m.id, m]));
const t0 = Date.now();

const paired = (rs: readonly BacktestRecord[], market: BacktestMarket) =>
	rs.filter((r) => r.marketOpening[market] && r.marketClosing[market]);
const v0Val = runBacktest(matches, { evalSeasons: [VALIDATION] });
const v0Hold = runBacktest(matches, { evalSeasons: [HOLDOUT] });
const dcVal = dixonColesWalkForward(
	matches.filter((m) => m.season <= VALIDATION),
	(m) => m.season === VALIDATION,
	DC
);
console.log(`M2 validáció: ${(Date.now() - t0) / 1000}s`);
const dcHold = dixonColesWalkForward(matches, (m) => m.season === HOLDOUT, DC);
console.log(`M2 holdout: ${(Date.now() - t0) / 1000}s`);

type Probs = (r: BacktestRecord, market: BacktestMarket) => number[];
const dcProbs =
	(preds: typeof dcVal): Probs =>
	(r, market) => {
		const p = preds.get(r.id)!.probabilities;
		return market === 'h2h' ? [p.home, p.draw, p.away] : [p.over25, p.under25];
	};
interface Model {
	name: string;
	val: { records: BacktestRecord[]; probs: Probs };
	hold: { records: BacktestRecord[]; probs: Probs };
}
const MODELS: Model[] = [
	{
		name: '`elo-poisson@0.1.0` (v0)',
		val: { records: v0Val, probs: (r, k) => r.model[k] },
		hold: { records: v0Hold, probs: (r, k) => r.model[k] }
	},
	{
		name: '`dixon-coles@1.0.0` (M2)',
		val: { records: v0Val, probs: dcProbs(dcVal) },
		hold: { records: v0Hold, probs: dcProbs(dcHold) }
	}
];

const samplesOf = (set: Model['val'], market: BacktestMarket): BlendSample[] =>
	paired(set.records, market).map((r) => ({
		pModel: set.probs(r, market),
		pMarket: r.marketOpening[market]!,
		outcomeIndex: r.outcome[market],
		odds: byId.get(r.id)!.odds[market]
	}));
const pooledBets = (s: Record<BacktestMarket, BlendSample[]>, method: BlendMethod, w: number, threshold: number) =>
	MARKETS.flatMap((k) => blendBets(s[k], method, w, threshold));

// --- Hangolás a validáción ---
interface Tuned {
	model: Model;
	grid: Array<{ method: BlendMethod; w: number; ll: Record<BacktestMarket, number> }>;
	method: BlendMethod;
	w: number;
	thresholds: Array<ThresholdCandidate & { byMarket: Record<BacktestMarket, BetSummary> }>;
	threshold: number;
	thresholdFallback: boolean;
	joint: { w: number; threshold: number; summary: BetSummary } | null;
	jointByW: Array<{ w: number; best: { threshold: number; summary: BetSummary } | null }>;
}
const tuned: Tuned[] = MODELS.map((model) => {
	const val = { h2h: samplesOf(model.val, 'h2h'), ou25: samplesOf(model.val, 'ou25') };
	const grid = METHODS.flatMap((method) =>
		WEIGHTS.map((w) => ({
			method,
			w,
			ll: { h2h: blendScores(val.h2h, method, w).meanLogLoss!, ou25: blendScores(val.ou25, method, w).meanLogLoss! }
		}))
	);
	// Döntetlennél (pl. w = 0, ahol a két módszer azonos) a kisebb w, majd az élő `logit` nyer.
	const best = [...grid].sort(
		(a, b) =>
			Math.round((a.ll.h2h + a.ll.ou25 - (b.ll.h2h + b.ll.ou25)) * 1e9) ||
			a.w - b.w ||
			(a.method === 'logit' ? -1 : b.method === 'logit' ? 1 : 0)
	)[0];
	// Alternatíva: (w > 0, küszöb) együtt a legnagyobb CLV-re (logit keverés, mint élőben) – megmutatja, ad-e a modell CLV-t.
	const joint = chooseThreshold(
		WEIGHTS.filter((w) => w > 0).flatMap((w) =>
			THRESHOLDS.map((threshold) => ({ w, threshold, summary: summarizeBets(pooledBets(val, 'logit', w, threshold)) }))
		),
		MIN_BETS
	);
	const thresholds = THRESHOLDS.map((threshold) => ({
		threshold,
		summary: summarizeBets(pooledBets(val, best.method, best.w, threshold)),
		byMarket: {
			h2h: summarizeBets(blendBets(val.h2h, best.method, best.w, threshold)),
			ou25: summarizeBets(blendBets(val.ou25, best.method, best.w, threshold))
		}
	}));
	const chosen = chooseThreshold(thresholds, MIN_BETS);
	return {
		model,
		grid,
		method: best.method,
		w: best.w,
		thresholds,
		threshold: chosen?.threshold ?? RAW_THRESHOLD,
		thresholdFallback: !chosen,
		joint,
		jointByW: WEIGHTS.filter((w) => w > 0).map((w) => ({
			w,
			best: chooseThreshold(
				THRESHOLDS.map((threshold) => ({ threshold, summary: summarizeBets(pooledBets(val, 'logit', w, threshold)) })),
				MIN_BETS
			)
		}))
	};
});

// --- Riport ---
const f4 = (x: number | null) => (x === null ? '–' : x.toFixed(4).replace('.', ','));
const pct = (x: number | null, d = 1) => (x === null ? '–' : `${(x * 100).toFixed(d).replace('.', ',')}%`);
const num = (x: number) => String(x).replace('.', ',');
const MARKET_LABEL: Record<BacktestMarket, string> = { h2h: '1X2', ou25: 'Gólszám 2,5' };
const METHOD_LABEL: Record<BlendMethod, string> = { logit: 'logit', linear: 'lineáris' };
const betCells = (s: BetSummary) =>
	`${s.n} | ${pct(s.roi)}${s.roiStdError === null ? '' : ` ± ${pct(s.roiStdError)}`} | ${pct(s.meanClv, 2)}`;

const gridTable = (t: Tuned) => [
	`**${t.model.name}** – validáció 2023/24, log-loss (1X2 + O/U 2,5 összege; \`w\` = a modell súlya)`,
	'',
	`| w | ${METHODS.map((m) => `${METHOD_LABEL[m]} 1X2 | ${METHOD_LABEL[m]} O/U | ${METHOD_LABEL[m]} Σ`).join(' | ')} |`,
	`|--:|${METHODS.map(() => '--:|--:|--:|').join('')}`,
	...WEIGHTS.map((w) => {
		const cells = METHODS.map((method) => {
			const g = t.grid.find((x) => x.method === method && x.w === w)!;
			const mark = method === t.method && w === t.w ? ' ←' : '';
			return `${f4(g.ll.h2h)} | ${f4(g.ll.ou25)} | ${f4(g.ll.h2h + g.ll.ou25)}${mark}`;
		});
		return `| ${num(w)} | ${cells.join(' | ')} |`;
	}),
	''
];

const thresholdTable = (t: Tuned) => [
	`**${t.model.name}** – validáció 2023/24, ${METHOD_LABEL[t.method]} keverés, w = ${num(t.w)}`,
	'',
	'| Küszöb | 1X2 tipp | 1X2 ROI | 1X2 CLV | O/U tipp | O/U ROI | O/U CLV | együtt tipp | együtt ROI | együtt CLV | |',
	'|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|---|',
	...t.thresholds.map(
		(c) =>
			`| ${pct(c.threshold, 0)} | ${betCells(c.byMarket.h2h)} | ${betCells(c.byMarket.ou25)} | ${betCells(c.summary)} | ${
				c.threshold === t.threshold ? '← választott' : ''
			} |`
	),
	''
];

const jointTable = (t: Tuned) => [
	`**${t.model.name}** – validáció 2023/24, logit keverés: w-nként a legnagyobb CLV-jű küszöb (≥ ${MIN_BETS} tipp, két piac együtt)`,
	'',
	'| w | küszöb | tipp | ROI | CLV | |',
	'|--:|--:|--:|--:|--:|---|',
	...t.jointByW.map((j) =>
		j.best
			? `| ${num(j.w)} | ${pct(j.best.threshold, 0)} | ${betCells(j.best.summary)} | ${
					t.joint && t.joint.w === j.w ? '← CLV-alternatíva' : ''
			  } |`
			: `| ${num(j.w)} | – | – | – | – | |`
	),
	''
];

const holdoutRows = (t: Tuned) => {
	const hold = { h2h: samplesOf(t.model.hold, 'h2h'), ou25: samplesOf(t.model.hold, 'ou25') };
	const row = (label: string, method: BlendMethod, w: number, threshold: number) => {
		const cells = MARKETS.map((k) => {
			const s = blendScores(hold[k], method, w);
			return `${f4(s.meanLogLoss)} | ${f4(s.meanBrier)} | ${betCells(summarizeBets(blendBets(hold[k], method, w, threshold)))}`;
		});
		return `| ${t.model.name} ${label} | ${cells.join(' | ')} |`;
	};
	return [
		row(`nyers (w = 1, küszöb ${pct(RAW_THRESHOLD, 0)})`, 'logit', 1, RAW_THRESHOLD),
		row(`kombinált (${METHOD_LABEL[t.method]}, w = ${num(t.w)}, küszöb ${pct(t.threshold, 0)})`, t.method, t.w, t.threshold),
		...(t.joint
			? [
					row(
						`CLV-alternatíva (logit, w = ${num(t.joint.w)}, küszöb ${pct(t.joint.threshold, 0)})`,
						'logit',
						t.joint.w,
						t.joint.threshold
					)
			  ]
			: [])
	];
};
const marketRow = () => {
	const hold = { h2h: samplesOf(MODELS[0].hold, 'h2h'), ou25: samplesOf(MODELS[0].hold, 'ou25') };
	const cells = MARKETS.map((k) => {
		const s = blendScores(hold[k], 'linear', 0);
		return `${f4(s.meanLogLoss)} | ${f4(s.meanBrier)} | ${betCells(
			summarizeBets(blendBets(hold[k], 'linear', 0, RAW_THRESHOLD))
		)}`;
	});
	return `| piac nyitó (w = 0, küszöb ${pct(RAW_THRESHOLD, 0)}) | ${cells.join(' | ')} |`;
};
const closingCells = MARKETS.map((k) => {
	const s = blendScores(
		paired(v0Hold, k).map((r) => ({ pModel: r.marketClosing[k]!, pMarket: r.marketClosing[k]!, outcomeIndex: r.outcome[k] })),
		'linear',
		1
	);
	return `${f4(s.meanLogLoss)} | ${f4(s.meanBrier)} | – | – | –`;
});

const live = DEFAULT_RECOMMENDATION_RULES;
const md = [
	'# Backtest: piaci kombinálás (`w`) + EV-küszöb',
	'',
	'> Generált fájl (`npm run backtest:blend -w @football/db`), kézzel ne szerkeszd. Terv: `docs/plans/model-v1.md` (I26b).',
	'',
	'## Protokoll',
	'',
	'- Adat: football-data.co.uk CSV, top 5 liga, 2022/23–2024/25 (0 élő hívás). **Hangolás csak a 2023/24-es validáción**; a 2024/25-ös holdout zárolt, csak a végső táblázat nézi (egyszer).',
	`- Modellek: v0 \`elo-poisson@0.1.0\` (fix paraméterek) és M2 \`dixon-coles@1.0.0\` (ξ = ${num(DC.xi!)}/nap, ridge = ${
		DC.ridge
	}, I26 validáció), walk-forward. Az M1 kimarad: a β/c1/c2 2022–2023-on illesztett, a 2023-as validáció neki in-sample.`,
	'- Piaci valószínűség: a nyitó átlag-odds (`Avg*`) arányos marzs-levonással. Keverés: `logit` = `logit(p) = w·logit(p_m) + (1−w)·logit(p_piac)`, renormálva (az élő `evaluateMarket` ezt használja); `lineáris` = `w·p_m + (1−w)·p_piac`.',
	`- \`w\` és módszer: a validációs 1X2 + O/U 2,5 log-loss összegének minimuma (rács w = 0; 0,1; …; 1). Küszöb: a ${THRESHOLDS.map(
		(x) => pct(x, 0)
	).join(
		' / '
	)} közül a legnagyobb átlagos CLV, legalább ${MIN_BETS} tippel (két piac együtt); döntetlennél a ROI. Tipp: flat 1 egység a Bet365 nyitón, CLV a Bet365 záróhoz, meccsenként és piaconként a legnagyobb EV-jű kimenet (a §5 többi szűrője – min. eltérés, odds-tartomány, irodaszám – itt nincs).`,
	`- Élő pipeline: változatlan (\`blendWeight\` = ${num(live.blendWeight)}, \`evThreshold\` = ${pct(
		live.evThreshold,
		0
	)}); az átállás 🔶 a tulajdonosé.`,
	'',
	'## Javaslat (validáció alapján)',
	'',
	...tuned.map(
		(t) =>
			`- ${t.model.name}: **${METHOD_LABEL[t.method]} keverés, w = ${num(t.w)}, EV-küszöb ${pct(t.threshold, 0)}**${
				t.thresholdFallback ? ` (egyik küszöb sem adott ${MIN_BETS} tippet CLV-vel → alapérték)` : ''
			}.${
				t.w === 0
					? ' A modell a validáción nem ad információt a nyitó piachoz (a log-loss w = 0-nál a legkisebb); w = 0 mellett a tipp csak a Bet365 és a piaci átlag eltéréséből jön, és az élő §5 `minEdge` szűrő minden ajánlást elutasítana.'
					: ''
			}`
	),
	'',
	'## Holdout 2024/25 (egyszeri, végső)',
	'',
	'| Változat | 1X2 LL | 1X2 Brier | 1X2 tipp | 1X2 ROI | 1X2 CLV | O/U LL | O/U Brier | O/U tipp | O/U ROI | O/U CLV |',
	'|---|--:|--:|--:|--:|--:|--:|--:|--:|--:|--:|',
	...tuned.flatMap(holdoutRows),
	marketRow(),
	`| piac záró | ${closingCells.join(' | ')} |`,
	'',
	'## Validáció 2023/24: keverési rács',
	'',
	...tuned.flatMap(gridTable),
	'## Validáció 2023/24: EV-küszöb a választott keveréssel',
	'',
	...tuned.flatMap(thresholdTable),
	'## Validáció 2023/24: CLV-alapú (w, küszöb) rács',
	'',
	...tuned.flatMap(jointTable)
].join('\n');

mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, md);
console.log(`→ ${OUT_MD} (${(Date.now() - t0) / 1000}s)`);
for (const t of tuned) console.log(`${t.model.name}: ${t.method} w=${t.w} küszöb=${t.threshold}`);
