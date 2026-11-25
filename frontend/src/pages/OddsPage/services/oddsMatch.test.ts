import type { FixtureDto, OddsSnapshotDto } from '@football/contract';
import { mapLimit, toOddsMatch } from './oddsMatch';

const fixture = (over: Partial<FixtureDto> = {}): FixtureDto => ({
	id: 10,
	leagueId: 39,
	season: 2021,
	kickoffAt: '2021-09-26T13:00:00.000Z',
	status: 'FT',
	homeTeamId: 1,
	awayTeamId: 2,
	goalsHome: 2,
	goalsAway: 1,
	...over
});

const snapshot = (quotes: OddsSnapshotDto['quotes']): OddsSnapshotDto => ({
	id: 1,
	fixtureId: 10,
	capturedAt: '2021-09-25T10:00:00.000Z',
	source: 'legacy-json',
	kind: 'legacy',
	quotes
});

const q = (bookmakerId: number, selection: string, odd: number, marketId = 1, line: number | null = null) => ({
	bookmakerId,
	marketId,
	selection,
	line,
	odd
});

describe('toOddsMatch', () => {
	it('az első teljes 1X2 fogadóiroda oddsait és a gólokat adja', () => {
		const m = toOddsMatch(
			fixture(),
			snapshot([
				q(16, 'Home', 1.8),
				q(16, 'Away', 4.2),
				q(8, 'Home', 1.9),
				q(8, 'Draw', 3.5),
				q(16, 'Draw', 3.6),
				q(5, 'Over', 1.9, 5, 2.5)
			])
		);
		expect(m).toEqual({ fixtureId: 10, leagueId: 39, goals: { home: 2, away: 1 }, odds: { home: 1.8, draw: 3.6, away: 4.2 } });
	});

	it('null, ha nincs eredmény, pillanatkép vagy teljes 1X2', () => {
		const full = [q(1, 'Home', 2), q(1, 'Draw', 3), q(1, 'Away', 4)];
		expect(toOddsMatch(fixture({ goalsHome: null, ftHome: null }), snapshot(full))).toBeNull();
		expect(toOddsMatch(fixture(), null)).toBeNull();
		expect(toOddsMatch(fixture(), snapshot([q(1, 'Home', 2), q(1, 'Away', 4)]))).toBeNull();
	});

	it('a ft-gólokra esik vissza', () => {
		const m = toOddsMatch(
			fixture({ goalsHome: null, goalsAway: null, ftHome: 0, ftAway: 0 }),
			snapshot([q(1, 'Home', 2), q(1, 'Draw', 3), q(1, 'Away', 4)])
		);
		expect(m?.goals).toEqual({ home: 0, away: 0 });
	});
});

describe('mapLimit', () => {
	it('sorrendtartó, és legfeljebb `limit` futás párhuzamos', async () => {
		let running = 0;
		let peak = 0;
		const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
			running++;
			peak = Math.max(peak, running);
			await new Promise((r) => setTimeout(r, 1));
			running--;
			return n * 10;
		});
		expect(out).toEqual([10, 20, 30, 40, 50]);
		expect(peak).toBe(2);
	});
});
