import { computeBestOdds, type BestOddsQuote } from './best';
import { isQuoteStored } from '../storage/storedScope';

const q = (bookmakerId: number, marketId: number, selection: string, odd: number, line: number | null = null): BestOddsQuote => ({
	bookmakerId,
	marketId,
	selection,
	line,
	odd
});

describe('computeBestOdds', () => {
	it('kimenetenként max + iroda, átlag, n_books; vonal külön kulcs; irodánként az első; odd ≤ 1 kimarad', () => {
		const rows = computeBestOdds([
			q(16, 1, 'Home', 2.1),
			q(8, 1, 'Home', 2.3),
			q(8, 1, 'Home', 9.0),
			q(99, 1, 'Home', 2.2),
			q(16, 5, 'Over', 1.9, 2.5),
			q(8, 5, 'Over', 1.4, 3.5),
			q(99, 5, 'Under', 1.0, 2.5)
		]);
		expect(rows).toHaveLength(3);
		expect(rows[0]).toMatchObject({ marketId: 1, selection: 'Home', line: null, maxOdd: 2.3, bookmakerId: 8, nBooks: 3 });
		expect(rows[0].avgOdd).toBeCloseTo(2.2, 10);
		expect(rows[1]).toEqual({ marketId: 5, selection: 'Over', line: 2.5, maxOdd: 1.9, bookmakerId: 16, avgOdd: 1.9, nBooks: 1 });
		expect(rows[2]).toMatchObject({ line: 3.5, maxOdd: 1.4 });
	});

	it('holtversenynél az első iroda; üres bemenet → üres', () => {
		expect(computeBestOdds([q(16, 1, 'Draw', 3), q(8, 1, 'Draw', 3)])[0].bookmakerId).toBe(16);
		expect(computeBestOdds([])).toEqual([]);
	});

	it('a tárolási szűrés nem változtatja a max_odd-ot (a teljes válaszból számol)', () => {
		const all = [q(16, 1, 'Home', 2.1), q(99, 1, 'Home', 2.6), q(16, 1, 'Away', 3.4), q(99, 1, 'Away', 3.1)];
		const scope = { leagueId: 39, followed: true, marketIds: [1], bookmakerIds: [16] };
		const stored = all.filter((x) => isQuoteStored(scope, x.marketId, x.bookmakerId));
		const best = computeBestOdds(all);
		expect(best.map((r) => [r.selection, r.maxOdd, r.bookmakerId])).toEqual([
			['Home', 2.6, 99],
			['Away', 3.4, 16]
		]);
		expect(Math.max(...stored.filter((x) => x.selection === 'Home').map((x) => x.odd))).toBe(2.1);
	});
});
