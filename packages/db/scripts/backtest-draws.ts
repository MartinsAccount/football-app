// Döntetlen-modell backtest (D1, ROADMAP 12.6, docs/plans/owner-style-and-draws.md B rész): `draw-logreg@1.0.0`.
// Tanítás 2022/23, validáció 2023/24 (λ, EV-küszöb, top-hányad küszöbe), holdout 2024/25 egyszer (végső modell: 2022+2023-on
// újraillesztve a választott λ-val). Jellemzők walk-forward: Dixon–Coles (I26 hiperparaméterek), Elo, döntetlen-történet.
// 0 élő hívás, nincs DB, determinisztikus. Futtatás: `npm run backtest:draws -w @football/db`
// → `docs/analysis/backtests/2026-11-17-draws.md` + a rögzített végső súlyok: `packages/core/src/draw/weights.ts` (D2).
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
	buildDrawSamples,
	chooseThreshold,
	DRAW_FACTOR_KEYS,
	DRAW_MODEL_VERSION,
	drawScores,
	dixonColesWalkForward,
	fitDrawModel,
	predictDraw,
	summarizeBets,
	topShareCutoff,
	type BacktestMatch,
	type BetSummary,
	type DixonColesWalkForwardOptions,
	type DrawModel,
	type DrawSample,
	type DrawScore,
	type EvaluatedBet
} from '@football/core';
import { loadBacktestMatches, ROOT } from './backtestData';

const OUT_MD = join(ROOT, 'docs', 'analysis', 'backtests', '2026-11-17-draws.md');
const OUT_WEIGHTS = join(ROOT, 'packages', 'core', 'src', 'draw', 'weights.ts');
const TRAIN = 2022;
const VALIDATION = 2023;
const HOLDOUT = 2024;
/** I26-ban a 2023-as validáción választott M2-hiperparaméterek (DECISIONS.md, 2026-11-16). */
const DC: DixonColesWalkForwardOptions = { refitDays: 1, windowDays: 730, xi: 0.002, ridge: 4 };
/** Bemelegítés: az első meccsnap után ennyi napig nincs DC-predikció (nincs elég tanítómeccs). */
const WARMUP_DAYS = 28;
const LAMBDAS = [0.1, 1, 3, 10, 30, 100, 1000];
const SHARES = [0.1, 0.2];
const THRESHOLDS = [0, 0.02, 0.05, 0.08, 0.1, 0.15];
const MIN_BETS = 50;

type M = BacktestMatch & { marketOpening1x2?: readonly number[] };
const { matches } = loadBacktestMatches();
const t0 = Date.now();
const firstKickoff = Math.min(...matches.map((m) => Date.parse(m.kickoff)));
const dc = dixonColesWalkForward(matches, (m) => Date.parse(m.kickoff) >= firstKickoff + WARMUP_DAYS * 86_400_000, DC);
console.log(`DC walk-forward: ${(Date.now() - t0) / 1000}s, ${dc.size} predikció`);

const source: M[] = matches.map((m) => ({ ...m, marketOpening1x2: m.odds.h2h?.marketOpening }));
const samples = buildDrawSamples(
	source,
	new Map([...dc].map(([id, p]) => [id, { pDraw: p.probabilities.draw, lambdaHome: p.lambdaHome, lambdaAway: p.lambdaAway }]))
);
const bySeason = (s: number) => samples.filter((x) => x.match.season === s);
const train = bySeason(TRAIN);
const val = bySeason(VALIDATION);
const hold = bySeason(HOLDOUT);

type Prob = (s: DrawSample<M>) => number;
const score = (set: DrawSample<M>[], p: Prob): DrawScore => drawScores(set.map((s) => ({ p: p(s), isDraw: s.isDraw })));
const marketP: Prob = (s) => s.features.pMarket;
const dcP: Prob = (s) => s.features.pModel;
const modelP =
	(model: DrawModel): Prob =>
	(s) =>
		predictDraw(model, s.features).pDraw;

/** Flat 1 egység a Bet365 nyitó X-oddson, CLV a Bet365 záró X-oddhoz. */
const drawBet = (s: DrawSample<M>, p: number): EvaluatedBet | null => {
	const taken = s.match.odds.h2h?.taken?.[1];
	if (!(taken && taken > 1)) return null;
	const closing = s.match.odds.h2h?.takenClosing?.[1];
	return { odds: taken, outcome: s.isDraw ? 'win' : 'loss', p, closingOdds: closing && closing > 1 ? closing : null };
};
const betsWhere = (set: DrawSample<M>[], p: Prob, take: (s: DrawSample<M>, p: number) => boolean) =>
	set.flatMap((s) => {
		const q = p(s);
		const b = take(s, q) ? drawBet(s, q) : null;
		return b ? [b] : [];
	});
const evOf = (s: DrawSample<M>, p: number) => p * (s.match.odds.h2h?.taken?.[1] ?? 0) - 1;

// --- Hangolás: λ a validációs log-loss minimuma (tanítás: 2022) ---
const grid = LAMBDAS.map((lambda) => {
	const model = fitDrawModel(train, { lambda });
	return { lambda, model, val: score(val, modelP(model)) };
});
const best = [...grid].sort((a, b) => a.val.logLoss! - b.val.logLoss! || b.lambda - a.lambda)[0];
const valModel = best.model;
// EV-küszöb a validáción (a 2022-es modellel): a legnagyobb CLV, ≥ MIN_BETS tipp.
const thresholdRows = THRESHOLDS.map((threshold) => ({
	threshold,
	summary: summarizeBets(betsWhere(val, modelP(valModel), (s, p) => evOf(s, p) >= threshold))
}));
const chosenThreshold = chooseThreshold(thresholdRows, MIN_BETS);

// --- Végső modell: 2022 + 2023, a választott λ-val; top-hányad küszöbe a 2023-as p(X) eloszlásból ---
const finalModel = fitDrawModel([...train, ...val], { lambda: best.lambda });
const finalP = modelP(finalModel);
const cutoffs = (p: Prob) => SHARES.map((share) => ({ share, cut: topShareCutoff(val.map(p), share) }));
const cutsModel = cutoffs(finalP);
const cutsMarket = cutoffs(marketP);
const cutsDc = cutoffs(dcP);

// --- Riport ---
const f4 = (x: number | null) => (x === null ? '–' : x.toFixed(4).replace('.', ','));
const pct = (x: number | null, d = 1) => (x === null ? '–' : `${(x * 100).toFixed(d).replace('.', ',')}%`);
const num = (x: number) => String(x).replace('.', ',');
const betCells = (s: BetSummary) =>
	`${s.n} | ${pct(s.hitRate)} | ${pct(s.expectedHitRate)} | ${pct(s.roi)}${
		s.roiStdError === null ? '' : ` ± ${pct(s.roiStdError)}`
	} | ${pct(s.meanClv, 2)}`;
const scoreRow = (label: string, s: DrawScore) =>
	`| ${label} | ${s.n} | ${f4(s.logLoss)} | ${f4(s.brier)} | ${pct(s.meanP)} | ${pct(s.drawRate)} |`;

const holdScores = {
	market: score(hold, marketP),
	dc: score(hold, dcP),
	model: score(hold, finalP),
	valModel: score(hold, modelP(valModel))
};
const holdBets: Array<{ label: string; s: BetSummary }> = [
	{ label: 'minden meccs X-re', s: summarizeBets(betsWhere(hold, marketP, () => true)) },
	...SHARES.flatMap((share, i) => [
		{
			label: `felső ${pct(share, 0)} – \`${DRAW_MODEL_VERSION}\` p(X) ≥ ${pct(cutsModel[i].cut)}`,
			s: summarizeBets(betsWhere(hold, finalP, (_, p) => p >= cutsModel[i].cut))
		},
		{
			label: `felső ${pct(share, 0)} – piaci p(X) ≥ ${pct(cutsMarket[i].cut)}`,
			s: summarizeBets(betsWhere(hold, marketP, (_, p) => p >= cutsMarket[i].cut))
		},
		{
			label: `felső ${pct(share, 0)} – Dixon–Coles p(X) ≥ ${pct(cutsDc[i].cut)}`,
			s: summarizeBets(betsWhere(hold, dcP, (_, p) => p >= cutsDc[i].cut))
		}
	]),
	...(chosenThreshold
		? [
				{
					label: `érték: \`${DRAW_MODEL_VERSION}\` EV ≥ ${pct(chosenThreshold.threshold, 0)}`,
					s: summarizeBets(betsWhere(hold, finalP, (s, p) => evOf(s, p) >= chosenThreshold.threshold))
				}
		  ]
		: [])
];

const ll = holdScores;
const beatsMarket = ll.model.logLoss! < ll.market.logLoss!;
const topModel = holdBets[1].s;
const topMarket = holdBets[2].s;
const topExamples = [...hold]
	.map((s) => ({ s, pred: predictDraw(finalModel, s.features) }))
	.sort((a, b) => b.pred.pDraw - a.pred.pDraw || a.s.match.id - b.s.match.id)
	.slice(0, 3);

const md = [
	'# Backtest: döntetlen-modell (`draw-logreg@1.0.0`)',
	'',
	'> Generált fájl (`npm run backtest:draws -w @football/db`), kézzel ne szerkeszd. Terv: `docs/plans/owner-style-and-draws.md` (B rész, D1).',
	'',
	'## Protokoll',
	'',
	`- Adat: football-data.co.uk CSV, top 5 liga, 2022/23–2024/25 (0 élő hívás). Minta: ${samples.length} meccs (tanítás ${train.length}, validáció ${val.length}, holdout ${hold.length}); az első ${WARMUP_DAYS} nap bemelegítés (nincs DC-illesztés).`,
	`- Jellemzők (meccs előtti, walk-forward): piaci fair p(X) (nyitó \`Avg*\`, arányos marzs-levonás), Dixon–Coles p(X) és λ_h + λ_v (ξ = ${num(
		DC.xi!
	)}/nap, ridge = ${
		DC.ridge
	}, napi újraillesztés), |Elo-különbség + hazai előny|, a két csapat döntetlen-aránya (10 pszeudo-meccsel a liga felé húzva), a liga döntetlen-aránya (50 pszeudo-meccsel 26% felé).`,
	'- Modell: L2-logreg, `logit p(X) = β0 + β1·logit(p_piac) + Σ β_j·tényező_j`; a konstans és a piac nincs büntetve, a tényezők igen (λ → ∞ = kalibrált piac).',
	`- Hangolás csak a 2023/24-es validáción: λ ∈ {${LAMBDAS.map(num).join(
		'; '
	)}} a validációs log-loss minimuma (2022-n tanítva); EV-küszöb a legnagyobb CLV (≥ ${MIN_BETS} tipp). Végső modell: 2022 + 2023 a választott λ-val; a „felső N%” küszöbe a 2023-as p(X)-eloszlás kvantilise (a holdoutból nem számol).`,
	'- Tipp: flat 1 egység a Bet365 nyitó X-oddson, CLV a Bet365 záró X-oddhoz (`B365CD`). A 2024/25-ös holdoutot csak a végső táblázatok nézik (egyszer).',
	'',
	'## Konklúzió',
	'',
	beatsMarket
		? `- Log-loss: a modell (${f4(ll.model.logLoss)}) a holdouton **jobb** a nyitó piacnál (${f4(
				ll.market.logLoss
		  )}), a különbség ${f4(ll.market.logLoss! - ll.model.logLoss!)}.`
		: `- Log-loss: a modell (${f4(ll.model.logLoss)}) a holdouton **nem veri** a nyitó piacot (${f4(
				ll.market.logLoss
		  )}). A döntetlen-valószínűségben a piac a jobb becslő; a tényezők legfeljebb kalibrálnak.`,
	`- A gólmodell (Dixon–Coles) önmagában ${f4(ll.dc.logLoss)} log-losst ad, ${
		ll.dc.logLoss! < ll.market.logLoss! ? 'jobbat' : 'rosszabbat'
	}, mint a piac.`,
	`- Felső 10% (modell): ${topModel.n} tipp, találat ${pct(topModel.hitRate)}, ROI ${pct(topModel.roi)} ± ${pct(
		topModel.roiStdError
	)}, CLV ${pct(topModel.meanClv, 2)}; ugyanez a piaci p(X) szerint: találat ${pct(topMarket.hitRate)}, ROI ${pct(
		topMarket.roi
	)}.`,
	`- Csak 2022-n tanítva a modell holdout log-lossa ${f4(ll.valModel.logLoss)} (${
		ll.valModel.logLoss! < ll.market.logLoss! ? 'jobb' : 'rosszabb'
	}, mint a piac); a ${f4(
		Math.abs(ll.market.logLoss! - ll.model.logLoss!)
	)} eltérés a végső modellnél kicsi, és nagyrészt a piac szezonális szint-hibájának (átl. p(X) vs. tényleges arány) kalibrálásából jön, nem a tényezőkből.`,
	`- ${
		(topModel.roi ?? 0) - 2 * (topModel.roiStdError ?? 0) > 0
			? 'A felső hányad ROI-ja két standard hibán túl pozitív – érdemes élesben is mérni.'
			: `**Kimutatható előny nincs:** a felső hányadok ROI-ja a ±2 standard hibán belül van (a ${pct(
					topModel.roiStdError
			  )} hiba nagyobb a hozamnál), és ${
					(topMarket.roi ?? 0) >= (topModel.roi ?? 0)
						? 'a puszta piaci p(X) szerinti rangsor legalább olyan jó'
						: 'a piaci rangsor csak kicsivel gyengébb'
			  }. A pozitív CLV a „minden meccs” soron is megvan (${pct(
					holdBets[0].s.meanClv,
					2
			  )}): a Bet365 nyitó X-oddsa általában rövidül, ez nem a modell érdeme.`
	}`,
	'- Az együtthatók a piachoz képesti **korrekciók**, nem önálló hatások (pl. a pozitív Elo-súly: adott piaci p(X) mellett a nagyobb erőkülönbségű meccsek kicsit gyakrabban végződtek döntetlennel). Javaslat: a döntetlen-figyelő (D2/D3) rangsorolásra és magyarázatra jó, értéktippnek nem igazolt; a rangsor alapja lehet maga a piaci p(X) is.',
	'',
	'## Holdout 2024/25: valószínűségi pontosság (X igen/nem)',
	'',
	'| Változat | n | log-loss | Brier | átl. p(X) | tényleges X-arány |',
	'|---|--:|--:|--:|--:|--:|',
	scoreRow('piac nyitó (fair)', ll.market),
	scoreRow('Dixon–Coles p(X)', ll.dc),
	scoreRow(`\`${DRAW_MODEL_VERSION}\` (2022, λ = ${num(best.lambda)})`, ll.valModel),
	scoreRow(`\`${DRAW_MODEL_VERSION}\` végső (2022 + 2023, λ = ${num(best.lambda)})`, ll.model),
	'',
	'## Holdout 2024/25: X-tippek (flat, Bet365 nyitó)',
	'',
	'| Szabály | tipp | találat | várt találat | ROI | CLV |',
	'|---|--:|--:|--:|--:|--:|',
	...holdBets.map((b) => `| ${b.label} | ${betCells(b.s)} |`),
	'',
	'## Végső modell együtthatói',
	'',
	'| Oszlop | β |',
	'|---|--:|',
	`| konstans | ${f4(finalModel.weights[0])} |`,
	`| logit(p_piac) | ${f4(finalModel.weights[1])} |`,
	...DRAW_FACTOR_KEYS.map((k, i) => `| ${k} | ${f4(finalModel.weights[2 + i])} |`),
	'',
	'Tényező-skálák: `model` = logit(p_DC) − logit(p_piac); `elo` = |Elo-különbség| / 100; `goals` = λ_h + λ_v − 2,7; `teams` = (csapat-arány − liga-arány)·10; `league` = (liga-arány − 26%)·10.',
	'',
	'## Példa: a holdout 3 legnagyobb p(X)-ű meccse (magyarázattal)',
	'',
	...topExamples.flatMap(({ s, pred }) => [
		`- ${s.match.kickoff.slice(0, 10)} ${s.match.league} #${s.match.id}: p(X) ${pct(pred.pDraw)} (piac ${pct(pred.pMarket)}), ${
			s.isDraw ? 'döntetlen lett' : 'nem lett döntetlen'
		}`,
		...pred.factors.map((f) => `  - ${f.label}: ${f.detail} (${f.contribution >= 0 ? '+' : ''}${f4(f.contribution)} log-odds)`)
	]),
	'',
	'## Validáció 2023/24: λ-rács (tanítás 2022)',
	'',
	'| λ | log-loss | Brier | |',
	'|--:|--:|--:|---|',
	...grid.map((g) => `| ${num(g.lambda)} | ${f4(g.val.logLoss)} | ${f4(g.val.brier)} | ${g === best ? '← választott' : ''} |`),
	`| piac | ${f4(score(val, marketP).logLoss)} | ${f4(score(val, marketP).brier)} | |`,
	'',
	'## Validáció 2023/24: EV-küszöb (2022-es modell)',
	'',
	'| Küszöb | tipp | találat | várt találat | ROI | CLV | |',
	'|--:|--:|--:|--:|--:|--:|---|',
	...thresholdRows.map(
		(r) => `| ${pct(r.threshold, 0)} | ${betCells(r.summary)} | ${r === chosenThreshold ? '← választott' : ''} |`
	),
	chosenThreshold ? '' : `\nEgyik küszöb sem adott ${MIN_BETS} tippet CLV-vel → a holdouton nincs értéktipp-sor.`,
	''
].join('\n');

mkdirSync(dirname(OUT_MD), { recursive: true });
writeFileSync(OUT_MD, md);
// D2: a szerver ezt a rögzített modellt használja (futás közben nem illeszt).
const weightsTs = [
	'// Generált fájl (`npm run backtest:draws -w @football/db`), kézzel ne szerkeszd.',
	`// A \`${DRAW_MODEL_VERSION}\` végső modellje: ${TRAIN}/${TRAIN + 1} + ${VALIDATION}/${
		VALIDATION + 1
	} (football-data.co.uk CSV, top 5 liga), λ = ${best.lambda}`,
	`// (a ${VALIDATION}/${VALIDATION + 1}-as validáción választva). Riport: docs/analysis/backtests/2026-11-17-draws.md.`,
	"import type { DrawModel } from './model';",
	'',
	'export const DRAW_MODEL_FITTED: DrawModel = {',
	`\tversion: '${finalModel.version}',`,
	`\tlambda: ${finalModel.lambda},`,
	'\t// [konstans, logit(p_piac), ...DRAW_FACTOR_KEYS]',
	'\tweights: [',
	finalModel.weights.map((w) => `\t\t${String(w)}`).join(',\n'),
	'\t],',
	`\ttrainSize: ${finalModel.trainSize},`,
	`\tconverged: ${finalModel.converged}`,
	'};',
	''
].join('\n');
writeFileSync(OUT_WEIGHTS, weightsTs);
execFileSync('npx', ['prettier', '--write', OUT_WEIGHTS], { cwd: ROOT, stdio: 'ignore', shell: true });
console.log(`→ ${OUT_MD}, ${OUT_WEIGHTS} (${(Date.now() - t0) / 1000}s)`);
console.log(`λ=${best.lambda} holdout LL modell=${f4(ll.model.logLoss)} piac=${f4(ll.market.logLoss)} dc=${f4(ll.dc.logLoss)}`);
for (const b of holdBets)
	console.log(`${b.label}: n=${b.s.n} hit=${pct(b.s.hitRate)} roi=${pct(b.s.roi)} clv=${pct(b.s.meanClv, 2)}`);
