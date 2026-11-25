import { describe, expect, it } from 'vitest';
import { formatOddsChange, formatOddsPath, marketLabel, oddsHistoryMarkets, oddsMove, type IHistorySnapshot } from './history';

const open: IHistorySnapshot = {
	capturedAt: '2024-05-01T10:00:00Z',
	kind: 'opening_csv',
	quotes: [
		{ bookmakerId: 1, marketId: 1, selection: 'Away', odd: 3.5 },
		{ bookmakerId: 1, marketId: 1, selection: 'Home', odd: 2.0 },
		{ bookmakerId: 2, marketId: 1, selection: 'Home', odd: 2.1 },
		{ bookmakerId: 1, marketId: 1, selection: 'Draw', odd: 3.3 },
		{ bookmakerId: 1, marketId: 5, selection: 'Under', line: 2.5, odd: 1.9 },
		{ bookmakerId: 1, marketId: 5, selection: 'Over', line: 2.5, odd: 1.95 }
	]
};
const close: IHistorySnapshot = {
	capturedAt: '2024-05-03T10:00:00Z',
	kind: 'closing_csv',
	quotes: [
		{ bookmakerId: 1, marketId: 1, selection: 'Home', odd: 1.8 },
		{ bookmakerId: 3, marketId: 1, selection: 'Home', odd: 1.85 },
		{ bookmakerId: 1, marketId: 1, selection: 'Draw', odd: 3.3 },
		{ bookmakerId: 1, marketId: 1, selection: 'Away', odd: 4.2 },
		{ bookmakerId: 2, marketId: 1, selection: 'Away', odd: 0 }
	]
};

describe('oddsHistoryMarkets', () => {
	it('kimenetenként a legjobb odd időrendben, nyitó → legutóbbi változással', () => {
		// szándékosan fordított sorrendben adjuk: időrendbe kell tennie
		const [result, ou] = oddsHistoryMarkets([close, open]);
		expect(result.label).toBe('Végeredmény');
		expect(result.rows.map((r) => r.selection)).toEqual(['Home', 'Draw', 'Away']);
		const [home, draw, away] = result.rows;
		expect(home.points.map((p) => [p.odd, p.bookmakerId, p.bookmakerCount, p.kind])).toEqual([
			[2.1, 2, 2, 'opening_csv'],
			[1.85, 3, 2, 'closing_csv']
		]);
		expect(home.opening).toBe(2.1);
		expect(home.latest).toBe(1.85);
		expect(home.change).toBeCloseTo(1.85 / 2.1 - 1);
		expect(home.move).toBe('down');
		expect(draw.move).toBe('flat');
		expect(away.move).toBe('up');
		expect(away.points[1].bookmakerCount).toBe(1); // a 0-s odd kimarad
		expect(ou.label).toBe('Gólszám 2,5');
		expect(ou.rows.map((r) => r.outcomeLabel)).toEqual(['Felett', 'Alatt']);
		expect(ou.rows[0].points).toHaveLength(1);
		expect(ou.rows[0].change).toBe(0);
	});

	it('üres bemenet → üres lista', () => {
		expect(oddsHistoryMarkets([])).toEqual([]);
	});
});

describe('formázók', () => {
	it('piac-címke, mozgás, változás', () => {
		expect(marketLabel(99)).toBe('Piac #99');
		expect(oddsMove(0.004)).toBe('flat');
		expect(formatOddsChange(0.052)).toBe('+5,2%');
		expect(formatOddsChange(-0.1)).toBe('−10,0%');
		expect(formatOddsPath({ opening: 2.1, latest: 2.25 })).toBe('2,10 → 2,25');
	});
});
