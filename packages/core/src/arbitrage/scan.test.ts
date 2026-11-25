import { describe, expect, it } from 'vitest';
import { BETS_TYPES } from '../constants/betTypes';
import type { Bookmaker } from '../odds/types';
import { analyzeBookmakers } from './analyzeBookmakers';
import {
	arbitrageBand,
	arbitrageStakes,
	arbitrageSum,
	reviveArbitrageSnapshot,
	roundedBand,
	scanMarket,
	type ArbitrageQuote
} from './scan';

const H2H = ['Home', 'Draw', 'Away'];
const q = (bookmaker: string, outcome: string, odds: number): ArbitrageQuote => ({ bookmaker, outcome, odds });

describe('arbitrageSum', () => {
	it('Σ 1/odds', () => {
		expect(arbitrageSum([2, 2])).toBeCloseTo(1, 10);
		expect(arbitrageSum([2.1, 2.1])).toBeCloseTo(0.952381, 6);
	});
	it('hiányzó vagy ≤ 1 odds → Infinity', () => {
		expect(arbitrageSum([])).toBe(Infinity);
		expect(arbitrageSum([2, 0])).toBe(Infinity);
		expect(arbitrageSum([2, 1])).toBe(Infinity);
	});
});

describe('arbitrageBand', () => {
	it('sávok', () => {
		expect(arbitrageBand(0.99)).toBe('arb');
		expect(arbitrageBand(1)).toBe('near');
		expect(arbitrageBand(1.019)).toBe('near');
		expect(arbitrageBand(1.02)).toBe('far');
		expect(arbitrageBand(Infinity)).toBe('far');
	});
});

describe('arbitrageStakes', () => {
	it('egyenlő kifizetés minden kimenetelre', () => {
		const odds = [2.2, 3.6, 4.5];
		const { stakes, payout, profit } = arbitrageStakes(odds, 10000);
		expect(stakes.reduce((a, s) => a + s, 0)).toBeCloseTo(10000, 6);
		stakes.forEach((s, i) => expect(s * odds[i]).toBeCloseTo(payout, 6));
		expect(payout).toBeCloseTo(10000 / arbitrageSum(odds), 6);
		expect(profit).toBeCloseTo(payout - 10000, 6);
	});
	it('kerekítéssel a legrosszabb kimenetel számít', () => {
		const odds = [2.1, 2.1];
		const r = arbitrageStakes(odds, 1000, 100);
		expect(r.stakes).toEqual([500, 500]);
		expect(r.worstPayout).toBeCloseTo(1050, 6);
		expect(r.profit).toBeCloseTo(50, 6);
	});
	it('nincs teljes lefedés vagy tét → nullák', () => {
		expect(arbitrageStakes([2, 0], 1000).stakes).toEqual([0, 0]);
		expect(arbitrageStakes([2, 2], 0).payout).toBe(0);
	});
});

describe('roundedBand (S29: címke a kerekített kifizetésből)', () => {
	it('Σ < 1, de a kerekítés után negatív kifizetés → nem „arb”, hanem „near”', () => {
		const odds = [16.5, 6.1, 1.29]; // Σ ≈ 0,99973 (Monza–Napoli, nyitó)
		expect(arbitrageSum(odds)).toBeLessThan(1);
		const r = arbitrageStakes(odds, 10000, 10);
		expect(r.worstPayout).toBeLessThan(r.staked);
		expect(r.band).toBe('near');
		expect(roundedBand(odds, 10000, 10)).toBe('near');
	});
	it('Σ < 1 és a kerekített tétekkel is nyereség → „arb”', () => {
		const odds = [2.6, 3.9, 3.5]; // Σ ≈ 0,927
		const r = arbitrageStakes(odds, 10000, 10);
		expect(r.staked).toBe(r.stakes.reduce((a, s) => a + s, 0));
		expect(r.worstPayout).toBeGreaterThanOrEqual(r.staked);
		expect(r.band).toBe('arb');
	});
	it('kerekítés nélkül a sum-alapú sáv marad', () => {
		expect(roundedBand([16.5, 6.1, 1.29], 10000, 0)).toBe('arb');
		expect(roundedBand([2, 1.97], 10000, 10)).toBe('near');
		expect(roundedBand([2, 3, 3], 10000, 10)).toBe('far');
		expect(roundedBand([2, 0], 10000, 10)).toBe('far');
	});
});

describe('scanMarket', () => {
	it('kimenetelenként a legjobb odds, iroda és tét-arány', () => {
		const r = scanMarket('h2h', H2H, [
			q('A', 'Home', 2.5),
			q('B', 'Home', 2.6),
			q('A', 'Draw', 3.9),
			q('B', 'Draw', 3.4),
			q('C', 'Away', 3.5),
			q('A', 'Away', 3.1)
		]);
		expect(r.legs.map((l) => [l.outcome, l.bookmaker, l.odds])).toEqual([
			['Home', 'B', 2.6],
			['Draw', 'A', 3.9],
			['Away', 'C', 3.5]
		]);
		expect(r.sum).toBeCloseTo(1 / 2.6 + 1 / 3.9 + 1 / 3.5, 10);
		expect(r.band).toBe('arb');
		expect(r.margin).toBeCloseTo(1 / r.sum - 1, 10);
		expect(r.legs.reduce((a, l) => a + l.stakeShare, 0)).toBeCloseTo(1, 10);
		expect(r.bookmakerCount).toBe(3);
	});
	it('egyenlő oddsnál az első iroda marad', () => {
		const r = scanMarket('ou25', ['Over', 'Under'], [q('A', 'Over', 2), q('B', 'Over', 2), q('B', 'Under', 1.8)]);
		expect(r.legs[0].bookmaker).toBe('A');
	});
	it('hiányzó kimenetel → nincs láb, sum Infinity', () => {
		const r = scanMarket('h2h', H2H, [q('A', 'Home', 2), q('A', 'Away', 3)]);
		expect(r.legs).toEqual([]);
		expect(r.sum).toBe(Infinity);
		expect(r.band).toBe('far');
	});
	it('a régi analyzeBookmakers-szel azonos eredmény ugyanazon az adaton (ROADMAP 8.1)', () => {
		const books: Bookmaker[] = [
			['Unibet', [2.4, 3.5, 3.0]],
			['Bet365', [2.55, 3.3, 2.9]],
			['Bwin', [2.5, 3.6, 3.2]]
		].map(([name, odds], id) => ({
			id,
			name: name as string,
			bets: [
				{
					id: 1,
					name: 'Match Winner',
					values: H2H.map((value, i) => ({ value, odd: String((odds as number[])[i]) }))
				}
			]
		}));
		const legacy = analyzeBookmakers(books, BETS_TYPES.Vegeredmeny);
		const quotes = books.flatMap((b) => b.bets[0].values.map((v) => q(b.name, v.value, Number(v.odd))));
		const next = scanMarket('h2h', H2H, quotes);
		expect(Number(next.sum.toFixed(3))).toBe(legacy.arbitrage);
		expect(next.legs.map((l) => [l.bookmaker, l.odds])).toEqual(legacy.highestOdds!.map((h) => [h.bookmaker, h.odd]));
	});
});

describe('reviveArbitrageSnapshot', () => {
	it('a JSON null sum → Infinity', () => {
		const raw = JSON.parse(
			JSON.stringify({
				generatedAt: 'x',
				now: 'x',
				source: 'x',
				markets: [],
				bookmakers: [],
				fixtures: [
					{
						fixtureId: 1,
						league: 'L',
						kickoff: 'k',
						home: 'H',
						away: 'A',
						oddsAt: 'o',
						opportunities: [scanMarket('h2h', H2H, [])]
					}
				]
			})
		);
		expect(raw.fixtures[0].opportunities[0].sum).toBeNull();
		expect(reviveArbitrageSnapshot(raw).fixtures[0].opportunities[0].sum).toBe(Infinity);
	});
});
