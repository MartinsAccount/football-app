import { bestOdds, consensusFairProbabilities, fairProbabilities, impliedProbabilities, overround } from './market';

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

describe('piaci baseline', () => {
	it('implikált valószínűség = 1/odds', () => {
		expect(impliedProbabilities([2, 4])).toEqual([0.5, 0.25]);
	});

	it('margin: Σ(1/odds) − 1', () => {
		expect(overround([1.9, 1.9])).toBeCloseTo(0.0526, 4);
		expect(overround([2.1, 2.1])).toBeLessThan(0); // arbitrázs
	});

	it('fair valószínűség: Σp = 1 és arányos', () => {
		const p = fairProbabilities([2.0, 3.4, 4.0]);
		expect(sum(p)).toBeCloseTo(1, 12);
		// 1/2 : 1/3.4 : 1/4 aránya marad
		expect(p[0] / p[2]).toBeCloseTo(2, 12);
		expect(p[0]).toBeCloseTo(0.5 / (0.5 + 1 / 3.4 + 0.25), 12);
	});

	it('margin nélküli piacon a fair p = implikált p', () => {
		expect(fairProbabilities([2, 2])).toEqual([0.5, 0.5]);
	});

	it('konszenzus 2-es tömegre (Double Chance): Σp = 2, arányos margin-mentesítés', () => {
		const p = consensusFairProbabilities([[1.25, 1.33, 1.5]], 2);
		expect(sum(p)).toBeCloseTo(2, 12);
		expect(p[0] / p[2]).toBeCloseTo(1.5 / 1.25, 12);
		for (const x of p) expect(x).toBeLessThan(1);
	});

	it('konszenzus: irodánkénti fair p átlaga, Σp = 1', () => {
		const p = consensusFairProbabilities([
			[2, 2],
			[1.5, 3]
		]);
		expect(p[0]).toBeCloseTo((0.5 + 2 / 3) / 2, 12);
		expect(sum(p)).toBeCloseTo(1, 12);
	});

	it('legjobb odds kimenetenként, iroda indexszel', () => {
		expect(
			bestOdds([
				[1.8, 3.5, 4.2],
				[1.85, 3.4, 4.2],
				[1.75, 3.6, 4.0]
			])
		).toEqual([
			{ odds: 1.85, bookmakerIndex: 1 },
			{ odds: 3.6, bookmakerIndex: 2 },
			{ odds: 4.2, bookmakerIndex: 0 }
		]);
	});

	it('hibás bemenet: dob', () => {
		expect(() => fairProbabilities([1.5])).toThrow();
		expect(() => fairProbabilities([1, 2])).toThrow();
		expect(() => consensusFairProbabilities([])).toThrow();
		expect(() => bestOdds([[2, 2], [2]])).toThrow();
	});
});
