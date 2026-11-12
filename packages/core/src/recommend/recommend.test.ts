import { NBSP } from '../format/format';
import {
	blendProbabilities,
	confidenceLevel,
	dataWarnings,
	DEFAULT_RECOMMENDATION_RULES,
	evaluateMarket,
	pickRecommendation,
	type BookmakerOdds
} from './recommend';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const HOUR = 3_600_000;
const books = (rows: number[][]): BookmakerOdds[] => rows.map((odds, i) => ({ bookmaker: `B${i + 1}`, odds }));

describe('blendProbabilities', () => {
	it('w = 0 → piac, w = 1 → modell', () => {
		const m = [0.5, 0.3, 0.2];
		const p = [0.4, 0.3, 0.3];
		blendProbabilities(m, p, 0).forEach((x, i) => expect(x).toBeCloseTo(p[i], 9));
		blendProbabilities(m, p, 1).forEach((x, i) => expect(x).toBeCloseTo(m[i], 9));
	});

	it('köztes súlynál a kettő között van, Σp = 1', () => {
		const out = blendProbabilities([0.6, 0.4], [0.5, 0.5], 0.25);
		expect(sum(out)).toBeCloseTo(1, 12);
		expect(out[0]).toBeGreaterThan(0.5);
		expect(out[0]).toBeLessThan(0.6);
	});

	it('hibás bemenet', () => {
		expect(() => blendProbabilities([0.5, 0.5], [1], 0.5)).toThrow();
		expect(() => blendProbabilities([0.5, 0.5], [0.5, 0.5], 1.5)).toThrow();
	});
});

describe('evaluateMarket', () => {
	const fiveBooks = books([
		[2.0, 1.8],
		[1.95, 1.85],
		[2.1, 1.75],
		[1.98, 1.82],
		[2.02, 1.8]
	]);

	it('a legjobb oddsú irodát és a legnagyobb EV-jű kimenetet adja', () => {
		const e = evaluateMarket([0.6, 0.4], fiveBooks, { ...DEFAULT_RECOMMENDATION_RULES, blendWeight: 1 })!;
		expect(e.outcomeIndex).toBe(0);
		expect(e.odds).toBe(2.1);
		expect(e.bookmaker).toBe('B3');
		expect(e.ev).toBeCloseTo(0.6 * 2.1 - 1, 9);
		expect(e.minOdds).toBeCloseTo(1.05 / 0.6, 9);
		expect(e.accepted).toBe(true);
		expect(e.rejections).toEqual([]);
	});

	it('elutasítja, ha kevés az iroda, blokkolt, vagy kicsi az EV', () => {
		const few = evaluateMarket([0.6, 0.4], fiveBooks.slice(0, 2), { ...DEFAULT_RECOMMENDATION_RULES, blendWeight: 1 })!;
		expect(few.rejections).toContain('kevés iroda');
		const blocked = evaluateMarket([0.6, 0.4], fiveBooks, { ...DEFAULT_RECOMMENDATION_RULES, blendWeight: 1 }, true)!;
		expect(blocked.accepted).toBe(false);
		const flat = evaluateMarket([0.5, 0.5], fiveBooks)!;
		expect(flat.accepted).toBe(false);
		expect(flat.rejections).toContain('EV a küszöb alatt');
	});

	it('odds-tartomány', () => {
		const longshot = books(Array.from({ length: 5 }, () => [1.15, 6.5]));
		const e = evaluateMarket([0.7, 0.3], longshot, { ...DEFAULT_RECOMMENDATION_RULES, blendWeight: 1 })!;
		expect(e.outcomeIndex).toBe(1);
		expect(e.rejections).toContain('odds a tartományon kívül');
	});

	it('érvényes odds nélkül null', () => {
		expect(evaluateMarket([0.5, 0.5], books([[1, 2]]))).toBeNull();
	});
});

describe('pickRecommendation', () => {
	it('az elfogadottak közül a legnagyobb EV', () => {
		const a = { accepted: true, ev: 0.06, id: 'a' };
		const b = { accepted: false, ev: 0.2, id: 'b' };
		const c = { accepted: true, ev: 0.09, id: 'c' };
		expect(pickRecommendation([a, null, b, c])?.id).toBe('c');
		expect(pickRecommendation([b, null])).toBeNull();
	});
});

describe('dataWarnings', () => {
	it('friss, bő adatnál nincs figyelmeztetés', () => {
		expect(dataWarnings({ oddsAgeMs: 2 * HOUR, homeMatches: 20, awayMatches: 20, h2hMatches: 5 })).toEqual([]);
	});

	it('régi odds: 12 h felett figyelmeztet, 36 h felett blokkol', () => {
		expect(dataWarnings({ oddsAgeMs: 17 * HOUR, homeMatches: 20, awayMatches: 20, h2hMatches: 5 })).toEqual([
			{ text: `Az odds 17${NBSP}órás`, blocking: false }
		]);
		expect(dataWarnings({ oddsAgeMs: 40 * HOUR, homeMatches: 20, awayMatches: 20, h2hMatches: 5 })[0].blocking).toBe(true);
	});

	it('kevés idei meccs blokkol, kevés H2H nem', () => {
		const w = dataWarnings({ oddsAgeMs: 0, homeMatches: 3, awayMatches: 20, h2hMatches: 1 });
		expect(w.map((x) => x.blocking)).toEqual([true, false]);
	});
});

describe('confidenceLevel', () => {
	it('magas / közepes / alacsony', () => {
		expect(confidenceLevel({ edge: 0.06, seasonMatches: 25, oddsAgeMs: 2 * HOUR })).toBe('high');
		expect(confidenceLevel({ edge: 0.04, seasonMatches: 25, oddsAgeMs: 17 * HOUR })).toBe('medium');
		expect(confidenceLevel({ edge: 0.02, seasonMatches: 25, oddsAgeMs: 0 })).toBe('low');
		expect(confidenceLevel({ edge: 0.08, seasonMatches: 5, oddsAgeMs: 0 })).toBe('low');
	});
});
