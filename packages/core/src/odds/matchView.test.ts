import { describe, expect, it } from 'vitest';
import { oddsHistoryMarkets, type IHistorySnapshot } from './history';
import { bookmakerName, matchResultText, peakPoint, selectionResult, sparkline, withoutAggregateQuotes } from './matchView';

describe('withoutAggregateQuotes', () => {
	const snap: IHistorySnapshot = {
		capturedAt: '2025-04-10T11:30:00Z',
		quotes: [
			{ bookmakerId: 8, marketId: 1, selection: 'Home', odd: 2.0 },
			{ bookmakerId: 900002, marketId: 1, selection: 'Home', odd: 2.2 },
			{ bookmakerId: 900002, marketId: 5, line: 2.5, selection: 'Over', odd: 1.9 }
		]
	};

	it('drops aggregate quotes only where a real bookmaker quoted the same market', () => {
		const [s] = withoutAggregateQuotes([snap]);
		expect(s.quotes.map((q) => q.bookmakerId)).toEqual([8, 900002]);
		const [m1] = oddsHistoryMarkets([s]);
		expect(m1.rows[0].points[0].bookmakerId).toBe(8);
	});
});

describe('bookmakerName', () => {
	it('prefers given names, then the catalogue, then a fallback', () => {
		expect(bookmakerName(8, new Map([[8, 'B365']]))).toBe('B365');
		expect(bookmakerName(8)).toBe('Bet365');
		expect(bookmakerName(123)).toBe('Iroda #123');
	});
});

describe('selectionResult', () => {
	it('settles 1X2, draw-no-bet, totals, BTTS and double chance', () => {
		expect(selectionResult(1, null, 'Home', 2, 1)).toBe('win');
		expect(selectionResult(1, null, 'Draw', 2, 1)).toBe('loss');
		expect(selectionResult(2, null, 'Away', 1, 1)).toBe('void');
		expect(selectionResult(5, 2.5, 'Over', 2, 1)).toBe('win');
		expect(selectionResult(5, 2.5, 'Under', 2, 1)).toBe('loss');
		expect(selectionResult(5, 3, 'Over', 2, 1)).toBe('void');
		expect(selectionResult(8, null, 'Yes', 2, 0)).toBe('loss');
		expect(selectionResult(12, null, 'Draw/Away', 0, 0)).toBe('win');
		expect(selectionResult(99, null, 'Home', 1, 0)).toBeNull();
		expect(selectionResult(5, null, 'Over', 1, 0)).toBeNull();
	});
});

describe('matchResultText', () => {
	it('formats the score, half-time and winner', () => {
		expect(matchResultText({ status: 'FT', goalsHome: 5, goalsAway: 2, htHome: 2, htAway: 2 })).toBe(
			'5–2 (félidő 2–2) · hazai győzelem'
		);
		expect(matchResultText({ status: 'FT', goalsHome: 1, goalsAway: 1 })).toBe('1–1 · döntetlen');
		expect(matchResultText({ status: 'NS', goalsHome: null, goalsAway: null })).toBeNull();
	});
});

describe('peakPoint', () => {
	it('returns the highest odd, the earlier one on ties', () => {
		const p = (odd: number, capturedAt: string) => ({ capturedAt, odd, bookmakerId: 1, bookmakerCount: 1 });
		expect(peakPoint({ points: [p(2, 'a'), p(2.4, 'b'), p(2.4, 'c')] }).capturedAt).toBe('b');
	});
});

describe('sparkline', () => {
	it('maps odds to the box, higher odds higher up', () => {
		expect(sparkline([2, 3], 100, 20, 2)).toEqual({
			points: '2,18 98,2',
			dots: [
				{ x: 2, y: 18 },
				{ x: 98, y: 2 }
			]
		});
	});

	it('draws a flat midline for one point or no movement', () => {
		expect(sparkline([2.5], 100, 20).points).toBe('0,10 100,10');
		expect(sparkline([2, 2], 100, 20).points).toBe('0,10 100,10');
		expect(sparkline([], 100, 20).points).toBe('');
	});
});
