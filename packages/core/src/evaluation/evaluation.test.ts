import {
	brierScore,
	bttsOutcome,
	marketResultIndex,
	calibrationBuckets,
	closingLineValue,
	flatProfit,
	isVoidStatus,
	logLoss,
	outcome1x2,
	overUnderOutcome,
	settleBet,
	summarizeBets,
	summarizeProbabilities
} from './evaluation';

describe('kimenetel', () => {
	it('1X2 index és O/U push', () => {
		expect(outcome1x2(2, 1)).toBe(0);
		expect(outcome1x2(1, 1)).toBe(1);
		expect(outcome1x2(0, 3)).toBe(2);
		expect(overUnderOutcome(3, 2.5)).toBe(0);
		expect(overUnderOutcome(2, 2.5)).toBe(1);
		expect(overUnderOutcome(2, 2)).toBeNull();
	});

	it('BTTS index és piac-id szerinti eredmény-index', () => {
		expect(bttsOutcome(1, 1)).toBe(0);
		expect(bttsOutcome(2, 0)).toBe(1);
		expect(bttsOutcome(0, 0)).toBe(1);
		expect(marketResultIndex(8, null, 0, 3)).toBe(1);
		expect(marketResultIndex(8, null, 2, 1)).toBe(0);
		expect(marketResultIndex(8, 2.5, 2, 1)).toBeUndefined();
		expect(marketResultIndex(1, null, 2, 1)).toBe(0);
		expect(marketResultIndex(5, 2, 1, 1)).toBeNull();
		expect(marketResultIndex(5, null, 1, 1)).toBeUndefined();
		expect(marketResultIndex(12, null, 1, 1)).toBeUndefined();
	});

	it('elszámolás: win / loss / void, void státuszok', () => {
		expect(settleBet(0, 0)).toBe('win');
		expect(settleBet(0, 2)).toBe('loss');
		expect(settleBet(1, null)).toBe('void');
		expect(isVoidStatus('PST')).toBe(true);
		expect(isVoidStatus('FT')).toBe(false);
	});

	it('flat profit', () => {
		expect(flatProfit('win', 2.5)).toBeCloseTo(1.5, 12);
		expect(flatProfit('loss', 2.5)).toBe(-1);
		expect(flatProfit('void', 2.5)).toBe(0);
		expect(() => flatProfit('win', 1)).toThrow();
	});
});

describe('valószínűségi mutatók', () => {
	it('Brier: kézzel számolt érték, határesetek', () => {
		// (0.5−1)² + 0.3² + 0.2² = 0.25 + 0.09 + 0.04
		expect(brierScore([0.5, 0.3, 0.2], 0)).toBeCloseTo(0.38, 12);
		expect(brierScore([1, 0, 0], 0)).toBe(0);
		expect(brierScore([0, 1, 0], 0)).toBe(2);
	});

	it('log-loss: −ln p, 0 vágása', () => {
		expect(logLoss([0.5, 0.3, 0.2], 1)).toBeCloseTo(-Math.log(0.3), 12);
		expect(Number.isFinite(logLoss([1, 0], 1))).toBe(true);
		expect(() => logLoss([0.5, 0.5], 2)).toThrow();
	});

	it('CLV', () => {
		expect(closingLineValue(2.2, 2.0)).toBeCloseTo(0.1, 12);
		expect(closingLineValue(1.8, 2.0)).toBeCloseTo(-0.1, 12);
		expect(closingLineValue(2.2, null)).toBeNull();
	});
});

describe('kalibráció', () => {
	it('10%-os vödrök, üres kimarad, p = 1 az utolsóba', () => {
		const buckets = calibrationBuckets([
			{ p: 0.55, hit: true },
			{ p: 0.58, hit: false },
			{ p: 0.6, hit: true },
			{ p: 1, hit: true }
		]);
		expect(buckets).toHaveLength(3);
		expect(buckets[0]).toMatchObject({ count: 2, hitRate: 0.5 });
		expect(buckets[0].lower).toBeCloseTo(0.5, 12);
		expect(buckets[0].meanP).toBeCloseTo(0.565, 12);
		expect(buckets[1]).toMatchObject({ count: 1, hitRate: 1 });
		expect(buckets[1].lower).toBeCloseTo(0.6, 12);
		expect(buckets[2]).toMatchObject({ count: 1, upper: 1 });
	});
});

describe('összesítés', () => {
	it('tippek: profit, ROI, várt találat, CLV, void kihagyva', () => {
		const s = summarizeBets([
			{ odds: 2.0, outcome: 'win', p: 0.55, closingOdds: 1.9 },
			{ odds: 3.0, outcome: 'loss', p: 0.35, closingOdds: 3.2 },
			{ odds: 2.5, outcome: 'void', p: 0.4 },
			{ odds: 1.5, outcome: 'win', p: 0.7 }
		]);
		expect(s).toMatchObject({ n: 4, wins: 2, losses: 1, voids: 1, clvCount: 2 });
		expect(s.profit).toBeCloseTo(0.5, 12);
		expect(s.roi).toBeCloseTo(0.5 / 3, 12);
		expect(s.hitRate).toBeCloseTo(2 / 3, 12);
		expect(s.expectedHitRate).toBeCloseTo((0.55 + 0.35 + 0.7) / 3, 12);
		expect(s.meanClv).toBeCloseTo((2 / 1.9 - 1 + 3 / 3.2 - 1) / 2, 12);
		expect(s.roiStdError).toBeGreaterThan(0);
	});

	it('üres lista', () => {
		expect(summarizeBets([])).toMatchObject({ n: 0, roi: null, hitRate: null, roiStdError: null, meanClv: null });
		expect(summarizeProbabilities([])).toEqual({ n: 0, meanBrier: null, meanLogLoss: null });
	});

	it('predikciók: átlag Brier és log-loss', () => {
		const s = summarizeProbabilities([
			{ probabilities: [0.5, 0.3, 0.2], outcomeIndex: 0 },
			{ probabilities: [0.5, 0.5], outcomeIndex: 1 }
		]);
		expect(s.meanBrier).toBeCloseTo((0.38 + 0.5) / 2, 12);
		expect(s.meanLogLoss).toBeCloseTo(Math.log(2), 12);
	});
});
