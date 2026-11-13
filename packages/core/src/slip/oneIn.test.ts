import { hungarianOrdinal, oneInN, oneInText } from './oneIn';
import { summarizeSlip } from './slip';
import { formatFt, formatOdds, formatPercent } from '../format/format';

describe('„minden N-edik” (oneInText)', () => {
	it('magyar sorszámnevek', () => {
		expect([2, 3, 9, 10, 11, 12, 15, 20, 21, 22, 30, 45, 99, 100].map(hungarianOrdinal)).toEqual([
			'második',
			'harmadik',
			'kilencedik',
			'tizedik',
			'tizenegyedik',
			'tizenkettedik',
			'tizenötödik',
			'huszadik',
			'huszonegyedik',
			'huszonkettedik',
			'harmincadik',
			'negyvenötödik',
			'kilencvenkilencedik',
			'századik'
		]);
		expect(hungarianOrdinal(250)).toBe('250.');
	});

	it('N = round(1 / esély)', () => {
		expect(oneInN(0.357)).toBe(3);
		expect(oneInText(0.357)).toBe('kb. minden harmadik ilyen szelvény nyer');
		expect(oneInText(0.8)).toBe('a legtöbb ilyen szelvény nyer');
		expect(oneInText(0)).toBe('ilyen szelvény szinte sosem nyer');
		expect(oneInText(0.004)).toBe('kb. minden 250. ilyen szelvény nyer');
	});
});

describe('CHANGES 2. „Kész, ha” – szelvény-számok', () => {
	it('szingli 3,00 odds, 1 000 Ft tét → 3 000 Ft', () => {
		const s = summarizeSlip([{ fixtureId: 1, pModel: 0.357, bestOdds: 3 }], 1000)!;
		expect(formatFt(s.payout)).toBe('3 000 Ft');
	});

	it('dupla 3,00 × 3,23 → 9,69, esély 12%, kb. minden kilencedik', () => {
		const s = summarizeSlip(
			[
				{ fixtureId: 1, pModel: 0.357, bestOdds: 3 },
				{ fixtureId: 2, pModel: 0.327, bestOdds: 3.23 }
			],
			1000
		)!;
		expect(formatOdds(s.combinedOdds)).toBe('9,69');
		expect(formatPercent(s.probability)).toBe('12%');
		expect(oneInText(s.probability)).toContain('kb. minden kilencedik');
		expect(s.risk).toBe('high');
	});
});
