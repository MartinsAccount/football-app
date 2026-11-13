import type { MarketComparison } from '../backtest/backtest';
import type { CalibrationBucket } from './evaluation';
import { calibrationDotSize, calibrationError, calibrationFlags, ciScale, evaluateGoals, goalsMet, roiInterval } from './goals';
import { evaluationVerdict, verdictTone } from './verdict';

/** A `data/backtest/backtest-v0.json` összesített 1X2 számai (S15, elo-poisson@0.1.0). */
const H2H: MarketComparison = {
	model: { n: 3504, meanBrier: 0.5951297990334402, meanLogLoss: 0.9967514712228431 },
	marketOpening: { n: 3504, meanBrier: 0.5702508239844458, meanLogLoss: 0.9597855992075923 },
	marketClosing: { n: 3504, meanBrier: 0.5684192671473269, meanLogLoss: 0.95703704142978 },
	bets: {
		n: 2553,
		wins: 474,
		losses: 2079,
		voids: 0,
		hitRate: 0.18566392479435959,
		expectedHitRate: 0.2910374383485775,
		profit: -528.45,
		roi: -0.20699177438307875,
		roiStdError: 0.0376004661172228,
		meanClv: 0.010933898528649412,
		clvCount: 2553
	}
};

const b = (lower: number, count: number, meanP: number, hitRate: number): CalibrationBucket => ({
	lower,
	upper: lower + 0.1,
	count,
	meanP,
	hitRate
});
const CALIB_H2H: CalibrationBucket[] = [
	b(0, 47, 0.0855, 0.0638),
	b(0.1, 810, 0.1658, 0.1037),
	b(0.2, 4843, 0.2572, 0.2441),
	b(0.3, 1958, 0.3461, 0.3309),
	b(0.4, 1641, 0.4464, 0.4857),
	b(0.5, 796, 0.5444, 0.603),
	b(0.6, 334, 0.6422, 0.7335),
	b(0.7, 77, 0.7392, 0.7662),
	b(0.8, 6, 0.8245, 1)
];

describe('sikermutatók (DESIGN §8.4)', () => {
	it('a mostani backtest-számokkal 2/5 teljesül (kalibráció, CLV), és az ítélet negatív', () => {
		const goals = evaluateGoals(H2H, CALIB_H2H);
		expect(goals.map((g) => [g.key, g.status])).toEqual([
			['brier', 'fail'],
			['logLoss', 'fail'],
			['calibration', 'ok'],
			['clv', 'ok'],
			['roi', 'fail']
		]);
		expect(goalsMet(goals)).toBe(2);
		const v = evaluationVerdict(H2H, CALIB_H2H);
		expect(v.tone).toBe('negative');
		expect([v.met, v.total]).toEqual([2, 5]);
		expect(v.title).toBe('A modell még nem veri a piacot.');
		expect(v.text).toBe(
			'A value tippek veszteségesek (ROI −21%, a 95%-os sáv is teljesen negatív). A legjobb jel a pozitív CLV (+1,1%).'
		);
	});

	it('a ROI 300 elszámolt tipp alatt tájékoztató', () => {
		const few = { ...H2H, bets: { ...H2H.bets, n: 120, wins: 40, losses: 80, roi: 0.05 } };
		expect(evaluateGoals(few, CALIB_H2H).find((g) => g.key === 'roi')!.status).toBe('info');
	});

	it('hiányzó piaci adatnál és üres kalibrációnál info', () => {
		const cmp = { ...H2H, marketClosing: { n: 0, meanBrier: null, meanLogLoss: null } };
		const goals = evaluateGoals(cmp, []);
		expect(goals.filter((g) => g.status === 'info').map((g) => g.key)).toEqual(['brier', 'logLoss', 'calibration']);
	});

	it('kalibrációs hiba: súlyozott átlag pp-ben', () => {
		expect(calibrationError(CALIB_H2H)).toBeCloseTo(2.8, 1);
		expect(calibrationError([])).toBe(0);
	});
});

describe('ítélet-tónus (DESIGN §8.3)', () => {
	const good: MarketComparison = {
		...H2H,
		model: { n: 3504, meanBrier: 0.56, meanLogLoss: 0.95 },
		bets: { ...H2H.bets, roi: 0.04, roiStdError: 0.01, meanClv: 0.02 }
	};

	it('minden cél teljesül → pozitív, a szöveg a tényleges számokból', () => {
		const v = evaluationVerdict(good, CALIB_H2H);
		expect(v.tone).toBe('positive');
		expect(v.met).toBe(5);
		expect(v.text).toBe('Minden PRD-cél teljesül. A legjobb jel a pozitív CLV (+2,0%).');
	});

	it('Brier jó, ROI-sáv átfedi a nullát, de a CLV negatív → semleges', () => {
		const mixed = { ...good, bets: { ...good.bets, roi: 0.01, roiStdError: 0.02, meanClv: -0.005 } };
		const v = evaluationVerdict(mixed, CALIB_H2H);
		expect(v.tone).toBe('neutral');
		expect(v.title).toBe('Vegyes kép.');
		expect(v.text).toBe(
			'Az ajánláskori odds átlagosan rosszabb a zárónál (CLV −0,5%). A legjobb jel a pozitív ROI (+1%, 2 553 tipp).'
		);
	});

	it('rosszabb Brier önmagában is negatív', () => {
		const brierBad = { ...good, model: { ...good.model, meanBrier: 0.58 } };
		expect(verdictTone(brierBad, evaluateGoals(brierBad, CALIB_H2H))).toBe('negative');
	});
});

describe('ROI-intervallum és skála', () => {
	it('±1,96·SE', () => {
		const ci = roiInterval(-0.207, 0.0376);
		expect(ci.lower).toBeCloseTo(-0.2807, 4);
		expect(ci.upper).toBeCloseTo(-0.1333, 4);
	});

	it('negatív intervallum: a nulla jobbra, minden a 0–100 tartományban', () => {
		const s = ciScale(roiInterval(-0.207, 0.0376), -0.207);
		expect(s.from).toBeLessThan(s.at);
		expect(s.at).toBeLessThan(s.to);
		expect(s.to).toBeLessThan(s.zero);
		expect(Math.min(...Object.values(s))).toBeGreaterThanOrEqual(0);
		expect(Math.max(...Object.values(s))).toBeLessThanOrEqual(100);
	});

	it('pozitív intervallum: a nulla balra', () => {
		const s = ciScale({ lower: 0.02, upper: 0.08 }, 0.05);
		expect(s.zero).toBeLessThan(s.from);
		expect(s.from).toBeLessThan(s.at);
		expect(s.at).toBeLessThan(s.to);
		expect(s.to).toBeLessThanOrEqual(100);
	});

	it('a nullát átfedő intervallum: a nulla a sávon belül', () => {
		const s = ciScale({ lower: -0.03, upper: 0.05 }, 0.01);
		expect(s.from).toBeLessThan(s.zero);
		expect(s.zero).toBeLessThan(s.to);
		expect(s.zero).toBeCloseTo(((0.03 + 0.02) / 0.12) * 100, 6);
	});
});

describe('kalibrációs pontok', () => {
	it('pontméret 8 + √n / 4,5', () => {
		expect(calibrationDotSize(0)).toBe(8);
		expect(calibrationDotSize(81)).toBe(10);
		expect(calibrationDotSize(4843)).toBeCloseTo(23.46, 2);
	});

	it('kiemelés |eltérés| ≥ 5 pp és n ≥ 30 esetén; n < 30 kis minta', () => {
		expect(calibrationFlags(CALIB_H2H[1])).toMatchObject({ flag: true, lowN: false });
		expect(calibrationFlags(CALIB_H2H[1]).deviationPp).toBeCloseTo(-6.21, 2);
		expect(calibrationFlags(CALIB_H2H[4])).toMatchObject({ flag: false, lowN: false });
		expect(calibrationFlags(CALIB_H2H[8])).toMatchObject({ flag: false, lowN: true });
	});
});
