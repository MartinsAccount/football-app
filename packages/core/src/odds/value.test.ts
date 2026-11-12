import { DEFAULT_EV_THRESHOLD, edgePp, expectedValue, minOdds } from './value';

describe('érték-képletek', () => {
	it('EV = p × odds − 1', () => {
		expect(expectedValue(0.55, 2)).toBeCloseTo(0.1, 12);
		expect(expectedValue(0.5, 1.9)).toBeCloseTo(-0.05, 12);
	});

	it('edge egész pp-ben', () => {
		expect(edgePp(0.61, 0.54)).toBe(7);
		expect(edgePp(0.5, 0.534)).toBe(-3);
	});

	it('min. odds alapból 5% küszöbbel', () => {
		expect(DEFAULT_EV_THRESHOLD).toBe(0.05);
		expect(minOdds(0.5)).toBeCloseTo(2.1, 12);
		expect(minOdds(0.5, 0)).toBeCloseTo(2, 12);
		// min. oddson az EV pont a küszöb
		expect(expectedValue(0.4, minOdds(0.4))).toBeCloseTo(0.05, 12);
	});

	it('érvénytelen valószínűség: dob', () => {
		expect(() => expectedValue(0, 2)).toThrow();
		expect(() => minOdds(1.2)).toThrow();
	});
});
