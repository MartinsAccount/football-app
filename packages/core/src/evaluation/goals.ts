import type { MarketComparison } from '../backtest/backtest';
import type { CalibrationBucket } from './evaluation';

/**
 * PRD 9. fejezet sikermutatói (DESIGN §8.4) és a Kiértékelés oldal mérő-segédei. Tiszta függvények, formázás nélkül:
 * a nézet a `value`/`model`/`market` számokat formázza.
 */

export type GoalKey = 'brier' | 'logLoss' | 'calibration' | 'clv' | 'roi';
/** `info` = „tájékoztató”: a cél még nem értelmezhető (kevés tipp vagy hiányzó adat). */
export type GoalStatus = 'ok' | 'fail' | 'info';

export interface GoalResult {
	key: GoalKey;
	status: GoalStatus;
	/**
	 * A „most” érték: brier/logLoss → modell − záró piac (kisebb = jobb); calibration → átlagos eltérés pp-ben;
	 * clv/roi → arány (0.011 = +1,1%). `null`, ha nincs adat.
	 */
	value: number | null;
	/** Brier/log-loss: a modell és a záró piac abszolút értéke. */
	model?: number;
	market?: number;
	/** ROI/CLV: a tippek száma, amire a mutató vonatkozik. */
	n?: number;
}

/** A ROI ennyi elszámolt tipp alatt csak tájékoztató (DESIGN §8.4). */
export const ROI_MIN_BETS = 300;
/** Kalibrációs cél: átlagos eltérés ennél kisebb (pp). */
export const CALIBRATION_GOAL_PP = 5;
/** Kalibrációs sáv kiemelése: |eltérés| legalább ennyi pp … */
export const CALIBRATION_FLAG_PP = 5;
/** … és legalább ennyi minta; alatta „kis minta”. */
export const CALIBRATION_MIN_N = 30;
/** 95%-os normál kvantilis. */
export const Z95 = 1.96;

export const GOAL_ORDER: readonly GoalKey[] = ['brier', 'logLoss', 'calibration', 'clv', 'roi'];

/** Súlyozott átlagos kalibrációs eltérés (|becsült − tényleges|, pp); üres listára 0. */
export const calibrationError = (buckets: readonly CalibrationBucket[]): number => {
	const n = buckets.reduce((s, b) => s + b.count, 0);
	return n ? (buckets.reduce((s, b) => s + b.count * Math.abs(b.meanP - b.hitRate), 0) / n) * 100 : 0;
};

const scoreGoal = (key: 'brier' | 'logLoss', model: number | null, market: number | null): GoalResult =>
	model === null || market === null
		? { key, status: 'info', value: null }
		: { key, status: model <= market ? 'ok' : 'fail', value: model - market, model, market };

const ratioGoal = (key: 'clv' | 'roi', value: number | null, n: number, minN = 1): GoalResult => {
	if (value === null || n < minN) return { key, status: 'info', value, n };
	return { key, status: value > 0 ? 'ok' : 'fail', value, n };
};

/** Az 5 PRD-cél egy piac összevetéséből (Brier és log-loss a záró piachoz) és a kalibrációs vödrökből. */
export const evaluateGoals = (cmp: MarketComparison, calibration: readonly CalibrationBucket[]): GoalResult[] => {
	const { model, marketClosing: closing, bets } = cmp;
	const settled = bets.wins + bets.losses;
	const calibErr = calibration.length ? calibrationError(calibration) : null;
	return [
		scoreGoal('brier', model.meanBrier, closing.meanBrier),
		scoreGoal('logLoss', model.meanLogLoss, closing.meanLogLoss),
		calibErr === null
			? { key: 'calibration', status: 'info', value: null }
			: { key: 'calibration', status: calibErr < CALIBRATION_GOAL_PP ? 'ok' : 'fail', value: calibErr },
		ratioGoal('clv', bets.meanClv, bets.clvCount),
		ratioGoal('roi', bets.roi, settled, ROI_MIN_BETS)
	];
};

export const goalsMet = (goals: readonly GoalResult[]): number => goals.filter((g) => g.status === 'ok').length;

export interface RoiInterval {
	lower: number;
	upper: number;
}

/** 95%-os konfidencia-intervallum: ROI ± 1,96·SE. */
export const roiInterval = (roi: number, se: number): RoiInterval => ({ lower: roi - Z95 * se, upper: roi + Z95 * se });

export interface CiScale {
	/** Pozíciók a sáv szélességének %-ában (0–100): intervallum eleje/vége, a pont és a nulla. */
	from: number;
	to: number;
	at: number;
	zero: number;
}

/**
 * Az `.oe-ci` skálája: a tartományt az intervallum és a 0 együtt adja (+ 25% ráhagyás mindkét oldalon), így a nulla-jel
 * negatív, pozitív és a nullát átfedő intervallumnál is a helyén van.
 */
export const ciScale = (interval: RoiInterval, at: number, padding = 0.25): CiScale => {
	const lo = Math.min(interval.lower, 0, at);
	const hi = Math.max(interval.upper, 0, at);
	const span = hi - lo || 0.1;
	const min = lo - span * padding;
	const width = span * (1 + 2 * padding);
	const pos = (x: number) => ((x - min) / width) * 100;
	return { from: pos(interval.lower), to: pos(interval.upper), at: pos(at), zero: pos(0) };
};

/** Kalibrációs pont átmérője px-ben: `8 + √n / 4,5` (DESIGN §6). */
export const calibrationDotSize = (n: number): number => 8 + Math.sqrt(Math.max(0, n)) / 4.5;

export interface CalibrationRowFlags {
	/** Tényleges − becsült, pp. */
	deviationPp: number;
	/** Kiemelendő: |eltérés| ≥ 5 pp és n ≥ 30. */
	flag: boolean;
	/** Kis minta: n < 30 (nem mérvadó). */
	lowN: boolean;
}

export const calibrationFlags = (bucket: CalibrationBucket): CalibrationRowFlags => {
	const deviationPp = (bucket.hitRate - bucket.meanP) * 100;
	const lowN = bucket.count < CALIBRATION_MIN_N;
	return { deviationPp, lowN, flag: !lowN && Math.abs(deviationPp) >= CALIBRATION_FLAG_PP };
};
