import { teamForm } from './form';
import { headToHead } from './h2h';
import { homeAwaySplit, leagueHomeAdvantage } from './homeAway';
import { day, m } from './testMatches';
import { playedBefore } from './types';

describe('forma', () => {
	const ms = [m(3, 3, 1, 4, 0, 1), m(1, 1, 1, 2, 2, 0), m(2, 2, 3, 1, 1, 1), m(4, 2, 2, 3, 5, 0)];

	it('pont-idejű, legfrissebb elöl, exponenciális súlyozás', () => {
		const f = teamForm(ms, 1, day(4));
		expect(f.matches).toBe(3);
		expect(f.results).toEqual(['L', 'D', 'W']);
		expect(f.ppg).toBeCloseTo((0 + 0.8 * 1 + 0.64 * 3) / 2.44, 12);
		expect(f.goalDiff).toBeCloseTo((-1 + 0 + 0.64 * 2) / 2.44, 12);
	});

	it('decay = 1: sima átlag; az asOf-kori meccs kimarad', () => {
		expect(teamForm(ms, 1, day(4), { decay: 1 }).ppg).toBeCloseTo(4 / 3, 12);
		expect(teamForm(ms, 1, day(3)).results).toEqual(['D', 'W']);
	});

	it('helyszín-szűrés, ablak, üres eset', () => {
		expect(teamForm(ms, 1, day(4), { venue: 'home' }).results).toEqual(['L', 'W']);
		expect(teamForm(ms, 1, day(4), { venue: 'away' }).results).toEqual(['D']);
		expect(teamForm(ms, 1, day(4), { n: 1 }).results).toEqual(['L']);
		expect(teamForm(ms, 9, day(4))).toMatchObject({ matches: 0, ppg: null, results: [] });
	});

	it('hibás paraméter', () => {
		expect(() => teamForm(ms, 1, day(4), { n: 0 })).toThrow();
		expect(() => teamForm(ms, 1, day(4), { decay: 0 })).toThrow();
		expect(() => playedBefore(ms, 'nem dátum')).toThrow();
	});
});

describe('H2H', () => {
	const ms = [m(1, 1, 1, 2, 2, 0), m(2, 2, 2, 1, 1, 1), m(3, 3, 2, 1, 3, 0), m(4, 4, 1, 3, 9, 0)];

	it('átlag GK a csapat szemszögéből + shrinkage', () => {
		const h = headToHead(ms, 1, 2, day(5));
		expect(h).toMatchObject({ matches: 3, wins: 1, draws: 1, losses: 1 });
		expect(h.meanGoalDiff).toBeCloseTo(-1 / 3, 12);
		expect(h.shrunkGoalDiff).toBeCloseTo(-1 / 9, 12);
		expect(h.recent.map((x) => x.id)).toEqual([3, 2, 1]);
	});

	it('limit és üres eset', () => {
		expect(headToHead(ms, 1, 2, day(5), { limit: 2 }).meanGoalDiff).toBeCloseTo(-1.5, 12);
		expect(headToHead(ms, 2, 3, day(5))).toMatchObject({ matches: 0, meanGoalDiff: null, shrunkGoalDiff: 0 });
	});
});

describe('hazai / vendég', () => {
	const ms = [m(1, 1, 1, 2, 2, 0), m(2, 2, 2, 1, 1, 1), m(3, 3, 2, 1, 3, 0)];

	it('csapat hazai és vendég bontása', () => {
		const s = homeAwaySplit(ms, 1, day(5));
		expect(s.home).toEqual({ matches: 1, ppg: 3, goalsFor: 2, goalsAgainst: 0 });
		expect(s.away).toEqual({ matches: 2, ppg: 0.5, goalsFor: 0.5, goalsAgainst: 2 });
		expect(homeAwaySplit(ms, 1, day(1)).home.ppg).toBeNull();
	});

	it('liga hazai előnye', () => {
		const l = leagueHomeAdvantage(ms, day(5))!;
		expect(l.goalAdvantage).toBeCloseTo(5 / 3, 12);
		expect(l.homeWinRate).toBeCloseTo(2 / 3, 12);
		expect(l.drawRate).toBeCloseTo(1 / 3, 12);
		expect(l.awayWinRate).toBe(0);
		expect(leagueHomeAdvantage(ms, day(1))).toBeNull();
	});
});
