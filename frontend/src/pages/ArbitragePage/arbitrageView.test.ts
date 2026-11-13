import { describe, expect, it } from 'vitest';
import { scanMarket, type ArbitrageSnapshot } from '@football/core';
import {
	arbitrageHeadChips,
	arbitrageRows,
	arbitrageTiles,
	defaultFilter,
	formatMarginPct,
	historicalNotice,
	parseTotalStake
} from './arbitrageView';

const H2H = ['Home', 'Draw', 'Away'];
const q = (bookmaker: string, outcome: string, odds: number) => ({ bookmaker, outcome, odds });

const snap: ArbitrageSnapshot = {
	generatedAt: '2025-04-12T07:00:00.000Z',
	now: '2025-04-12T07:00:00.000Z',
	source: 'teszt',
	markets: [
		{
			key: 'h2h',
			label: 'Végeredmény',
			outcomes: [
				{ key: 'Home', label: 'Hazai' },
				{ key: 'Draw', label: 'Döntetlen' },
				{ key: 'Away', label: 'Vendég' }
			]
		},
		{
			key: 'ou25',
			label: 'Gólok 2,5',
			outcomes: [
				{ key: 'Over', label: 'Több' },
				{ key: 'Under', label: 'Kevesebb' }
			]
		}
	],
	bookmakers: ['A', 'B'],
	fixtures: [
		{
			fixtureId: 1,
			league: 'L',
			kickoff: '2025-04-12T14:00:00.000Z',
			home: 'H1',
			away: 'A1',
			oddsAt: 'x',
			opportunities: [
				scanMarket('h2h', H2H, [q('A', 'Home', 2.6), q('B', 'Draw', 3.9), q('B', 'Away', 3.5)]), // Σ ≈ 0,927 arb
				scanMarket('ou25', ['Over', 'Under'], [q('A', 'Over', 2), q('B', 'Under', 1.97)]) // Σ ≈ 1,008 közeli
			]
		},
		{
			fixtureId: 2,
			league: 'L',
			kickoff: '2025-04-13T14:00:00.000Z',
			home: 'H2',
			away: 'A2',
			oddsAt: 'x',
			opportunities: [
				scanMarket('h2h', H2H, [q('A', 'Home', 2), q('A', 'Draw', 3), q('A', 'Away', 3)]), // Σ ≈ 1,167 távoli
				scanMarket('ou25', ['Over', 'Under'], [q('A', 'Over', 2)]) // nincs lefedés
			]
		},
		{
			fixtureId: 3,
			league: 'L',
			kickoff: '2025-04-13T16:00:00.000Z',
			home: 'H3',
			away: 'A3',
			oddsAt: 'x',
			opportunities: [
				// Σ ≈ 0,99973 < 1, de 10 Ft-os tétekkel a legrosszabb kifizetés < összes tét (Monza–Napoli eset) → „Közeli”
				scanMarket('h2h', H2H, [q('C', 'Home', 16.5), q('C', 'Draw', 6.1), q('C', 'Away', 1.29)])
			]
		}
	]
};

describe('formatMarginPct', () => {
	it('előjel és 2 tizedes', () => {
		expect(formatMarginPct(0.0034)).toBe('+0,34%');
		expect(formatMarginPct(-0.012)).toBe('−1,20%');
		expect(formatMarginPct(0)).toBe('0,00%');
	});
});

describe('arbitrageRows', () => {
	it('alapszűrő: van arb → csak az arb', () => {
		const f = defaultFilter(snap);
		expect(f.band).toBe('arb');
		const rows = arbitrageRows(snap, f, 10000);
		expect(rows.map((r) => r.key)).toEqual(['1-h2h']);
		expect(rows[0].legs.map((l) => [l.outcome, l.bookmaker])).toEqual([
			['Hazai', 'A'],
			['Döntetlen', 'B'],
			['Vendég', 'B']
		]);
		expect(rows[0].positive).toBe(true);
		expect(rows[0].profit.startsWith('+')).toBe(true);
	});
	it('közeli: arb + közeli, Σ szerint növekvő', () => {
		const rows = arbitrageRows(snap, { band: 'near', market: 'all', bookmaker: 'all' }, 10000);
		expect(rows.map((r) => r.key)).toEqual(['1-h2h', '3-h2h', '1-ou25']);
		expect(rows[2].positive).toBe(false);
	});
	it('Σ < 1, de a kerekítés után negatív kifizetés → „Közeli” címke, az arb-szűrőben nincs', () => {
		const rows = arbitrageRows(snap, { band: 'near', market: 'all', bookmaker: 'C' }, 10000);
		expect(rows.map((r) => [r.key, r.band, r.bandLabel, r.profitPositive])).toEqual([['3-h2h', 'near', 'Közeli', false]]);
		expect(rows[0].profit.startsWith('−')).toBe(true);
		expect(arbitrageRows(snap, { band: 'arb', market: 'all', bookmaker: 'C' }, 10000)).toEqual([]);
	});
	it('mind: lefedés nélküli piac kimarad; piac- és irodaszűrő', () => {
		expect(arbitrageRows(snap, { band: 'all', market: 'all', bookmaker: 'all' }, 10000)).toHaveLength(4);
		expect(arbitrageRows(snap, { band: 'all', market: 'ou25', bookmaker: 'all' }, 10000).map((r) => r.key)).toEqual(['1-ou25']);
		expect(arbitrageRows(snap, { band: 'all', market: 'all', bookmaker: 'B' }, 10000).map((r) => r.key)).toEqual([
			'1-h2h',
			'1-ou25'
		]);
	});
});

describe('arbitrageTiles', () => {
	it('darabszámok és legjobb hozam', () => {
		const t = arbitrageTiles(snap);
		expect(t.map((x) => x.value).slice(0, 3)).toEqual(['3', '1', '2']);
		expect(t[3].positive).toBe(true);
	});
});

describe('parseTotalStake', () => {
	it('szóközös és érvénytelen bemenet', () => {
		expect(parseTotalStake('10 000')).toBe(10000);
		expect(parseTotalStake('50')).toBeNull();
		expect(parseTotalStake('abc')).toBeNull();
	});
});

describe('arbitrageHeadChips', () => {
	it('forrás és darabszámok a pillanatképből', () => {
		expect(arbitrageHeadChips(snap)).toEqual([
			'Irodák közötti árkülönbségek',
			'teszt',
			`${snap.fixtures.length} meccs`,
			'2 piac',
			`${snap.bookmakers.length} iroda`
		]);
	});
});

describe('historicalNotice', () => {
	it('szezon és „nyitó” a forrásmezőből, beégetés nélkül', () => {
		expect(historicalNotice('football-data CSV (2024/25, nyitó odds)')).toBe(
			'Történeti adat: 2024/25 nyitó oddsok – nem megtehető fogadás'
		);
		expect(historicalNotice('football-data CSV (2023/24, záró odds)')).toBe(
			'Történeti adat: 2023/24 záró oddsok – nem megtehető fogadás'
		);
		expect(historicalNotice('teszt')).toBe('Történeti adat – nem megtehető fogadás');
	});
});
