import { blend, blendBets, blendScores, chooseThreshold, linearBlend, type BlendSample, type ThresholdCandidate } from './blend';
import type { BetSummary } from '../evaluation/evaluation';

const sum = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

describe('linearBlend / blend', () => {
	it('w = 0 a piac, w = 1 a modell, közte lineáris', () => {
		const m = [0.5, 0.3, 0.2];
		const k = [0.4, 0.3, 0.3];
		expect(linearBlend(m, k, 0)).toEqual(k);
		expect(linearBlend(m, k, 1)).toEqual(m);
		const mid = linearBlend(m, k, 0.5);
		expect(mid[0]).toBeCloseTo(0.45, 12);
		expect(sum(mid)).toBeCloseTo(1, 12);
	});

	it('logit-keverés normált, és a két végpont közé esik', () => {
		const p = blend('logit', [0.6, 0.4], [0.5, 0.5], 0.5);
		expect(sum(p)).toBeCloseTo(1, 12);
		expect(p[0]).toBeGreaterThan(0.5);
		expect(p[0]).toBeLessThan(0.6);
	});

	it('hibás súlyra és eltérő hosszra dob', () => {
		expect(() => linearBlend([0.5, 0.5], [0.5, 0.5], 1.2)).toThrow();
		expect(() => linearBlend([0.5, 0.5], [0.3, 0.3, 0.4], 0.5)).toThrow();
	});
});

// A modell túl magabiztos a hazaira; a piac pontosabb. A megtehető odds = marzs nélküli piac.
const samples: BlendSample[] = [0, 0, 1, 0, 1, 1].map((outcomeIndex) => ({
	pModel: [0.8, 0.2],
	pMarket: [0.5, 0.5],
	outcomeIndex,
	odds: { taken: [2, 2], takenClosing: [1.9, 2.1] }
}));

describe('blendScores / blendBets', () => {
	it('a piac felé keverés javítja a log-losst, ha a modell túlbecsül', () => {
		const ll = (w: number) => blendScores(samples, 'linear', w).meanLogLoss!;
		expect(ll(0)).toBeLessThan(ll(0.5));
		expect(ll(0.5)).toBeLessThan(ll(1));
	});

	it('a küszöb a kevert EV-re vonatkozik', () => {
		// w = 1: p = 0,8 · 2 − 1 = 0,6 EV; w = 0,1: p = 0,53 → EV 0,06; w = 0: EV 0.
		expect(blendBets(samples, 'linear', 1, 0.05)).toHaveLength(6);
		expect(blendBets(samples, 'linear', 0.1, 0.05)).toHaveLength(6);
		expect(blendBets(samples, 'linear', 0.1, 0.1)).toHaveLength(0);
		const bets = blendBets(samples, 'linear', 1, 0.05);
		expect(bets[0]).toMatchObject({ selection: 0, odds: 2, closingOdds: 1.9 });
		expect(bets.filter((b) => b.outcome === 'win')).toHaveLength(3);
	});
});

describe('chooseThreshold', () => {
	const s = (n: number, meanClv: number | null, roi: number | null): BetSummary => ({
		n,
		wins: 0,
		losses: 0,
		voids: 0,
		hitRate: null,
		expectedHitRate: null,
		profit: 0,
		roi,
		roiStdError: null,
		meanClv,
		clvCount: n
	});
	const c = (threshold: number, summary: BetSummary): ThresholdCandidate => ({ threshold, summary });

	it('a mintaméret-feltételt teljesítők közül a legnagyobb CLV-jűt választja', () => {
		const pick = chooseThreshold([c(0, s(500, -0.02, -0.1)), c(0.05, s(200, 0.01, -0.05)), c(0.1, s(40, 0.05, 0.2))], 100);
		expect(pick?.threshold).toBe(0.05);
	});

	it('CLV-döntetlennél a ROI, majd a kisebb küszöb dönt', () => {
		expect(chooseThreshold([c(0, s(200, 0.01, -0.1)), c(0.05, s(150, 0.01, 0))], 100)?.threshold).toBe(0.05);
		expect(chooseThreshold([c(0.05, s(200, 0.01, 0)), c(0.02, s(150, 0.01, 0))], 100)?.threshold).toBe(0.02);
	});

	it('null, ha egyik sem éri el a mintaméretet', () => {
		expect(chooseThreshold([c(0.1, s(10, 0.05, 0))], 100)).toBeNull();
	});
});
