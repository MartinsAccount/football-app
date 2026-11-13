import type { MarketComparison } from '../backtest/backtest';
import { formatClv, formatDecimal, formatEv, formatSignedDecimal } from '../format/format';
import type { CalibrationBucket } from './evaluation';
import { evaluateGoals, GoalKey, GoalResult, goalsMet, roiInterval } from './goals';

/** Ítélet-sáv (DESIGN §8.3): tónus, egymondatos cím, 1–2 mondat a legrosszabb és a legjobb mutatóról, a tényleges számokkal. */

export type VerdictTone = 'negative' | 'positive' | 'neutral';

export interface Verdict {
	tone: VerdictTone;
	title: string;
	text: string;
	goals: GoalResult[];
	met: number;
	total: number;
}

export const VERDICT_TITLES: Record<VerdictTone, string> = {
	negative: 'A modell még nem veri a piacot.',
	positive: 'A modell jobb a piacnál.',
	neutral: 'Vegyes kép.'
};

/** A legrosszabb (nem teljesülő) mutató keresési sorrendje: a pénzügyi eredmény előbb, a pontosság utána. */
const WORST_ORDER: readonly GoalKey[] = ['roi', 'logLoss', 'brier', 'calibration', 'clv'];
/** A legjobb (teljesülő) mutató keresési sorrendje: ami a piacon való előnyt mutatja, az előbb. */
const BEST_ORDER: readonly GoalKey[] = ['clv', 'roi', 'logLoss', 'brier', 'calibration'];

const pick = (goals: readonly GoalResult[], order: readonly GoalKey[], status: 'ok' | 'fail') =>
	order.map((k) => goals.find((g) => g.key === k)).find((g): g is GoalResult => !!g && g.status === status);

const worstSentence = (g: GoalResult, cmp: MarketComparison): string => {
	switch (g.key) {
		case 'roi': {
			const { roi, roiStdError } = cmp.bets;
			const ci = roi !== null && roiStdError !== null ? roiInterval(roi, roiStdError) : null;
			const band =
				ci === null
					? ''
					: ci.upper < 0
					? ', a 95%-os sáv is teljesen negatív'
					: `, 95%: ${formatEv(ci.lower)} … ${formatEv(ci.upper)}`;
			return `A value tippek veszteségesek (ROI ${formatEv(g.value!)}${band}).`;
		}
		case 'logLoss':
			return `A modell pontatlanabb a záró piacnál (log-loss ${formatSignedDecimal(g.value!, 3)}).`;
		case 'brier':
			return `A modell Brier-pontszáma rosszabb a záró piacénál (${formatDecimal(g.model!, 3)} vs ${formatDecimal(
				g.market!,
				3
			)}).`;
		case 'calibration':
			return `A modell rosszul kalibrált (átlagos eltérés ${formatDecimal(g.value!, 1)} pp, cél < 5 pp).`;
		case 'clv':
			return `Az ajánláskori odds átlagosan rosszabb a zárónál (CLV ${formatClv(g.value!)}).`;
	}
};

const bestPhrase = (g: GoalResult): string => {
	switch (g.key) {
		case 'clv':
			return `a pozitív CLV (${formatClv(g.value!)})`;
		case 'roi':
			return `a pozitív ROI (${formatEv(g.value!)}, ${formatDecimal(g.n!, 0)} tipp)`;
		case 'logLoss':
			return `a záró piacnál kisebb log-loss (${formatSignedDecimal(g.value!, 3)})`;
		case 'brier':
			return `a záró piacnál jobb Brier (${formatDecimal(g.model!, 3)} vs ${formatDecimal(g.market!, 3)})`;
		case 'calibration':
			return `a jó kalibráció (átlagos eltérés ${formatDecimal(g.value!, 1)} pp)`;
	}
};

/** Az ítélet tónusa: negatív, ha a ROI 95%-os felső határa < 0 vagy a modell Brierje rosszabb a záró piacénál. */
export const verdictTone = (cmp: MarketComparison, goals: readonly GoalResult[]): VerdictTone => {
	const { roi, roiStdError } = cmp.bets;
	const roiBad = roi !== null && roiStdError !== null && roiInterval(roi, roiStdError).upper < 0;
	const brierBad = goals.find((g) => g.key === 'brier')?.status === 'fail';
	if (roiBad || brierBad) return 'negative';
	return goals.every((g) => g.status === 'ok') ? 'positive' : 'neutral';
};

export const evaluationVerdict = (cmp: MarketComparison, calibration: readonly CalibrationBucket[]): Verdict => {
	const goals = evaluateGoals(cmp, calibration);
	const tone = verdictTone(cmp, goals);
	const met = goalsMet(goals);
	const worst = pick(goals, WORST_ORDER, 'fail');
	const best = pick(goals, BEST_ORDER, 'ok');
	const first = worst ? worstSentence(worst, cmp) : 'Minden PRD-cél teljesül.';
	const second = best
		? `${met === 1 ? 'Az egyetlen biztató jel' : 'A legjobb jel'} ${bestPhrase(best)}.`
		: 'Egyik PRD-cél sem teljesül.';
	return { tone, title: VERDICT_TITLES[tone], text: `${first} ${second}`, goals, met, total: goals.length };
};
