import { estimateDailyCalls, estimateLeagueCallsPerRound, estimateOddsStorage } from './budget';

describe('hívásbecslés', () => {
	it('egy top liga fordulója ≈ 7–9 hívás (§6.2)', () => {
		const c = estimateLeagueCallsPerRound();
		expect(c).toMatchObject({ fixtures: 1, standings: 1, earlyOdds: 1, lateOdds: 2.5, injuries: 1, results: 1, predictions: 0 });
		expect(c.total).toBeGreaterThanOrEqual(7);
		expect(c.total).toBeLessThanOrEqual(9);
	});

	it('lapozás és kötegek, predikciók', () => {
		const c = estimateLeagueCallsPerRound({
			fixturesPerRound: 21,
			matchDaysPerRound: 3,
			predictionCandidates: 4,
			resultPasses: 2
		});
		expect(c).toMatchObject({ earlyOdds: 3, injuries: 2, results: 4, predictions: 4 });
		expect(c.total).toBe(1 + 1 + 3 + 3 + 2 + 4 + 4);
		expect(() => estimateLeagueCallsPerRound({ fixturesPerRound: -1 })).toThrow();
	});

	it('5 liga a §6.3 táblázat nagyságrendjében', () => {
		const d = estimateDailyCalls(Array.from({ length: 5 }, () => ({})));
		expect(d.perRound).toBeCloseTo(37.5, 12);
		expect(d.dailyAverage).toBeGreaterThan(6);
		expect(d.dailyAverage).toBeLessThan(10);
		expect(d.peakDay).toBeCloseTo(22.5, 12);
		expect(d.remainingAverage).toBeGreaterThan(85);
		expect(d.overLimit).toBe(false);
	});

	it('túl sok liga: a csúcsnap túllépi a keretet', () => {
		expect(estimateDailyCalls(Array.from({ length: 25 }, () => ({}))).overLimit).toBe(true);
	});
});

describe('tárhelybecslés', () => {
	it('5 liga, 5 iroda, 3 piac, nyitó + záró ≈ 10–20 MB/szezon (§4.1)', () => {
		const s = estimateOddsStorage({ fixturesPerSeason: 1750, snapshotsPerFixture: 2, bookmakers: 5, outcomes: 7 });
		expect(s.rows).toBe(122_500);
		expect(s.bytes / 1024 / 1024).toBeGreaterThan(10);
		expect(s.bytes / 1024 / 1024).toBeLessThan(20);
		expect(s.seasonsInLimit).toBeGreaterThan(25);
	});

	it('megszorítás nélkül ≈ 150–250 MB/szezon (§4)', () => {
		const s = estimateOddsStorage({ fixturesPerSeason: 1750, snapshotsPerFixture: 3, bookmakers: 1, outcomes: 250 });
		expect(s.bytes / 1024 / 1024).toBeGreaterThan(150);
		expect(s.bytes / 1024 / 1024).toBeLessThan(250);
		expect(estimateOddsStorage({ fixturesPerSeason: 0, snapshotsPerFixture: 2, bookmakers: 5, outcomes: 7 }).seasonsInLimit).toBe(
			Infinity
		);
	});
});
