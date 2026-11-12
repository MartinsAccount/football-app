import { BETS_TYPES } from '../constants/betTypes';
import { Bookmaker } from '../odds/types';
import { analyzeBookmakers } from './analyzeBookmakers';

const bookmaker = (id: number, name: string, bets: { name: BETS_TYPES; values: [string, string][] }[]): Bookmaker => ({
	id,
	name,
	bets: bets.map((bet, i) => ({
		id: i + 1,
		name: bet.name as any,
		values: bet.values.map(([value, odd]) => ({ value, odd }))
	}))
});

describe('analyzeBookmakers', () => {
	describe('3 kimenetelű (1X2)', () => {
		const books = [
			bookmaker(1, 'Unibet', [
				{
					name: BETS_TYPES.Vegeredmeny,
					values: [
						['Home', '2.10'],
						['Draw', '3.40'],
						['Away', '3.60']
					]
				}
			]),
			bookmaker(2, 'Bet365', [
				{
					name: BETS_TYPES.Vegeredmeny,
					values: [
						['Home', '2.25'],
						['Draw', '3.30'],
						['Away', '3.90']
					]
				}
			])
		];

		it('kimenetelenként a legmagasabb oddsot választja, irodával együtt', () => {
			const result = analyzeBookmakers(books, BETS_TYPES.Vegeredmeny);

			expect(result.name).toBe(BETS_TYPES.Vegeredmeny);
			expect(result.highestOdds).toEqual([
				{ name: 'Home', odd: 2.25, bookmaker: 'Bet365' },
				{ name: 'Draw', odd: 3.4, bookmaker: 'Unibet' },
				{ name: 'Away', odd: 3.9, bookmaker: 'Bet365' }
			]);
		});

		it('az arány Σ 1/odd_max, 3 tizedesre kerekítve', () => {
			// 1/2.25 + 1/3.4 + 1/3.9 = 0.4444 + 0.2941 + 0.2564 = 0.995
			expect(analyzeBookmakers(books, BETS_TYPES.Vegeredmeny).arbitrage).toBe(0.995);
		});
	});

	describe('2 kimenetelű', () => {
		it('BTTS: nincs arbitrázs, ha a legjobb oddsok összege > 1', () => {
			const books = [
				bookmaker(1, 'A', [
					{
						name: BETS_TYPES.MindketCsapatGol,
						values: [
							['Yes', '1.80'],
							['No', '1.95']
						]
					}
				]),
				bookmaker(2, 'B', [
					{
						name: BETS_TYPES.MindketCsapatGol,
						values: [
							['Yes', '1.85'],
							['No', '1.90']
						]
					}
				])
			];

			const result = analyzeBookmakers(books, BETS_TYPES.MindketCsapatGol);

			expect(result.highestOdds!.map((o) => [o.name, o.odd, o.bookmaker])).toEqual([
				['Yes', 1.85, 'B'],
				['No', 1.95, 'A']
			]);
			expect(result.arbitrage).toBe(1.053); // 1/1.85 + 1/1.95
		});

		it('a vártnál több kimenetel nem okoz hibát, a többlet nem számít', () => {
			const books = [
				bookmaker(1, 'A', [
					{
						name: BETS_TYPES.HazaiVagyVendeg,
						values: [
							['Home', '2.10'],
							['Away', '2.10'],
							['Extra', '9.00']
						]
					}
				])
			];

			const result = analyzeBookmakers(books, BETS_TYPES.HazaiVagyVendeg);

			expect(result.highestOdds).toHaveLength(2);
			expect(result.arbitrage).toBe(0.952);
		});
	});

	describe('gólvonalas (Over/Under)', () => {
		const books = [
			bookmaker(1, 'A', [
				{
					name: BETS_TYPES.GolokSzama,
					values: [
						['Over 1.5', '1.30'],
						['Over 2.5', '2.05'],
						['Under 2.5', '1.80'],
						['Over 3.5', '3.40'],
						['Under 3.5', '1.30']
					]
				}
			]),
			bookmaker(2, 'B', [
				{
					name: BETS_TYPES.GolokSzama,
					values: [
						['Under 2.5', '2.00'],
						['Over 2.5', '1.95']
					]
				}
			])
		];

		it('csak a kért vonal Over/Under értékeit nézi, a sorrendtől függetlenül', () => {
			const result = analyzeBookmakers(books, BETS_TYPES.GolokSzama, 2.5);

			expect(result.highestOdds).toEqual([
				{ name: 'Over 2.5', odd: 2.05, bookmaker: 'A' },
				{ name: 'Under 2.5', odd: 2.0, bookmaker: 'B' }
			]);
			expect(result.arbitrage).toBe(0.988); // 1/2.05 + 1/2.0 → arbitrázs
		});

		it('ha egy iroda nem ad oddsot a vonalra, az nem számít', () => {
			const result = analyzeBookmakers(books, BETS_TYPES.GolokSzama, 3.5);

			expect(result.highestOdds!.map((o) => o.bookmaker)).toEqual(['A', 'A']);
			expect(result.arbitrage).toBe(1.063); // 1/3.4 + 1/1.3
		});
	});

	describe('hiányzó adat', () => {
		it('ha egyik iroda sem kínálja a típust, az arány Infinity (nincs arbitrázs)', () => {
			const books = [bookmaker(1, 'A', [{ name: BETS_TYPES.Vegeredmeny, values: [['Home', '2']] }])];

			expect(analyzeBookmakers(books, BETS_TYPES.MindketCsapatGol).arbitrage).toBe(Infinity);
			expect(analyzeBookmakers([], BETS_TYPES.Vegeredmeny).arbitrage).toBe(Infinity);
		});

		it('nem támogatott típusnál null az eredmény', () => {
			expect(analyzeBookmakers([], BETS_TYPES.PontosVegeredmeny)).toEqual({
				name: BETS_TYPES.PontosVegeredmeny,
				highestOdds: null,
				arbitrage: null
			});
		});
	});
});
