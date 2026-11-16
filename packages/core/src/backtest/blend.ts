// Piaci kombinálás (`w`) és EV-küszöb hangolása (I26b, ROADMAP 7.3, strategy.md §4.5): a modell és a nyitó, marzs nélküli piaci
// valószínűség keverése, valószínűségi pontosság és értéktippek egy rácsponton. Tiszta függvények; a hangolás a hívó (backtest-
// script) dolga, kizárólag validációs adaton.
import { blendProbabilities } from '../recommend/recommend';
import { summarizeBets, summarizeProbabilities, type BetSummary, type ProbabilisticSummary } from '../evaluation/evaluation';
import { pickValueBet, type BacktestMarketOdds } from './backtest';

/** `logit`: log-lineáris (logit-térben, renormálva – az élő `evaluateMarket` ezt használja); `linear`: `w·p_m + (1−w)·p_piac`. */
export type BlendMethod = 'logit' | 'linear';

/** Lineáris keverés kimenetenként (Σp = 1 marad, ha mindkét bemenet normált). */
export const linearBlend = (pModel: readonly number[], pMarket: readonly number[], w: number): number[] => {
	if (pModel.length !== pMarket.length) throw new Error('A modell és a piac kimenetszáma eltér.');
	if (!(w >= 0 && w <= 1)) throw new Error(`A súly a [0, 1] tartományba essen: ${w}`);
	return pModel.map((p, i) => w * p + (1 - w) * pMarket[i]);
};

export const blend = (method: BlendMethod, pModel: readonly number[], pMarket: readonly number[], w: number): number[] =>
	method === 'logit' ? blendProbabilities(pModel, pMarket, w) : linearBlend(pModel, pMarket, w);

export interface BlendSample {
	pModel: readonly number[];
	/** Nyitó, marzs nélküli piaci valószínűség (ugyanabban a kimenet-sorrendben). */
	pMarket: readonly number[];
	outcomeIndex: number;
	/** A megtehető (`taken`) és a CLV-hez tartozó (`takenClosing`) odds. */
	odds?: BacktestMarketOdds;
}

/** Log-loss és Brier a kevert valószínűségeken. */
export const blendScores = (samples: readonly BlendSample[], method: BlendMethod, w: number): ProbabilisticSummary =>
	summarizeProbabilities(
		samples.map((s) => ({ probabilities: blend(method, s.pModel, s.pMarket, w), outcomeIndex: s.outcomeIndex }))
	);

/** Értéktippek a kevert valószínűségből: a legnagyobb EV-jű kimenet, ha `EV ≥ küszöb` (flat tét, CLV a záróhoz). */
export const blendBets = (samples: readonly BlendSample[], method: BlendMethod, w: number, threshold: number) =>
	samples.flatMap((s) => {
		const bet = pickValueBet(blend(method, s.pModel, s.pMarket, w), s.odds, s.outcomeIndex, threshold);
		return bet ? [bet] : [];
	});

export interface ThresholdCandidate {
	threshold: number;
	summary: BetSummary;
}

/**
 * EV-küszöb választása: a legalább `minBets` tippet adó küszöbök közül a legnagyobb átlagos CLV-jű (döntetlennél a nagyobb ROI,
 * majd a kisebb küszöb). A CLV stabilabb jel, mint a ROI (strategy.md §6). `null`, ha egyik sem éri el a mintaméretet.
 */
export const chooseThreshold = <T extends ThresholdCandidate>(candidates: readonly T[], minBets: number): T | null =>
	candidates
		.filter((c) => c.summary.n >= minBets && c.summary.meanClv !== null)
		.reduce<T | null>((best, c) => {
			if (!best) return c;
			const d = c.summary.meanClv! - best.summary.meanClv!;
			if (d !== 0) return d > 0 ? c : best;
			const r = (c.summary.roi ?? -Infinity) - (best.summary.roi ?? -Infinity);
			if (r !== 0) return r > 0 ? c : best;
			return c.threshold < best.threshold ? c : best;
		}, null);
