import { addLeg, assertValidSlip, hasFixture, legOdds, riskLevel, slipTypeName, summarizeSlip, type SlipLeg } from './slip';

const a: SlipLeg = { fixtureId: 1, pModel: 0.6, bestOdds: 1.9 };
const b: SlipLeg = { fixtureId: 2, pModel: 0.5, bestOdds: 2.2, tippmixOdds: 2.1 };

describe('szelvény-matek', () => {
	it('üres szelvény: null', () => {
		expect(summarizeSlip([], 1000)).toBeNull();
	});

	it('szingli: EV, nyeremény, becsült jelzés', () => {
		const s = summarizeSlip([a], 1000)!;
		expect(s.combinedOdds).toBeCloseTo(1.9, 12);
		expect(s.probability).toBeCloseTo(0.6, 12);
		expect(s.ev).toBeCloseTo(0.14, 12);
		expect(s.payout).toBeCloseTo(1900, 9);
		expect(s.expectedProfit).toBeCloseTo(140, 9);
		expect(s.singlesExpectedProfit).toBeCloseTo(140, 9);
		expect(s.minCombinedOdds).toBeCloseTo(1.75, 12);
		expect(s.estimated).toBe(true);
		expect(s.risk).toBe('low');
	});

	it('dupla kötés: Π odds, Π p, beírt Tippmix-odds elsőbbsége', () => {
		const s = summarizeSlip([a, b], 2000)!;
		expect(legOdds(b)).toBe(2.1);
		expect(s.combinedOdds).toBeCloseTo(1.9 * 2.1, 12);
		expect(s.probability).toBeCloseTo(0.3, 12);
		expect(s.ev).toBeCloseTo(0.3 * 3.99 - 1, 12);
		expect(s.minCombinedOdds).toBeCloseTo(1.75 * 2.1, 12);
		expect(s.payout).toBeCloseTo(2000 * 3.99, 9);
		// szingli: (0,6×1,9−1) + (0,5×2,1−1) = 0,14 + 0,05
		expect(s.singlesExpectedProfit).toBeCloseTo(0.19 * 2000, 9);
		expect(s.risk).toBe('medium');
		expect(s.estimated).toBe(true);
		expect(summarizeSlip([{ ...a, tippmixOdds: 1.85 }, b], 1000)!.estimated).toBe(false);
	});

	it('kockázati sávok', () => {
		expect(riskLevel(0.35)).toBe('low');
		expect(riskLevel(0.3499)).toBe('medium');
		expect(riskLevel(0.15)).toBe('medium');
		expect(riskLevel(0.1499)).toBe('high');
	});

	it('egy meccs = egy tipp', () => {
		expect(hasFixture([a], 1)).toBe(true);
		expect(hasFixture([a], 2)).toBe(false);
		expect(() => addLeg([a], { fixtureId: 1, pModel: 0.3, bestOdds: 3.5 })).toThrow();
		expect(addLeg([a], b)).toHaveLength(2);
		expect(() => summarizeSlip([a, { ...a, pModel: 0.2 }], 100)).toThrow();
	});

	it('érvénytelen odds / tét: dob', () => {
		expect(() => assertValidSlip([{ ...a, tippmixOdds: 1 }])).toThrow();
		expect(() => summarizeSlip([a], -1)).toThrow();
	});

	it('szelvénytípus neve', () => {
		expect(slipTypeName(1)).toBe('Szingli');
		expect(slipTypeName(2)).toBe('Dupla kötés');
		expect(slipTypeName(3)).toBe('Hármas kötés');
		expect(slipTypeName(9)).toBe('9-es kötés');
	});
});
