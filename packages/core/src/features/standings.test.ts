import { m } from './testMatches';
import { buildMatchFeatures } from './matchFeatures';
import { defaultZones, motivationDiff, teamMotivation, type Zone } from './motivation';
import { seasonPhase, seasonProgress, tableTier, totalRounds } from './season';
import { deriveStandings, tablePosition, type StandingRow } from './standings';

const ms = [m(1, 1, 1, 2, 2, 0), m(2, 1, 3, 4, 1, 1), m(3, 8, 1, 3, 1, 0), m(4, 8, 2, 4, 3, 1)];
const asOf = '2024-01-10T15:00:00Z';

describe('pont-idejű tabella', () => {
	it('pont → GK → rúgott sorrend', () => {
		const t = deriveStandings(ms, asOf);
		expect(t.map((r) => [r.teamId, r.points, r.goalDiff])).toEqual([
			[1, 6, 3],
			[2, 3, 0],
			[3, 1, -1],
			[4, 1, -2]
		]);
		expect(t[0]).toMatchObject({ position: 1, played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 3, goalsAgainst: 0 });
	});

	it('csak az asOf előtti meccsek; meccs nélküli csapat 0 ponttal; teljes holtverseny teamId szerint', () => {
		const t = deriveStandings(ms, '2024-01-05T00:00:00Z', [5]);
		expect(t.map((r) => r.teamId)).toEqual([1, 3, 4, 5, 2]);
		expect(t[3]).toMatchObject({ teamId: 5, played: 0, points: 0, position: 4 });
	});

	it('tabellahely: pontrés a szomszédokhoz', () => {
		const t = deriveStandings(ms, asOf, [5]);
		expect(tablePosition(t, 2)).toEqual({ position: 2, teamCount: 5, points: 3, played: 2, ppg: 1.5, gapAbove: 3, gapBelow: 2 });
		expect(tablePosition(t, 1)?.gapAbove).toBeNull();
		expect(tablePosition(t, 5)).toMatchObject({ gapBelow: null, ppg: null });
		expect(tablePosition(t, 99)).toBeNull();
	});
});

describe('szezonszakasz és tier', () => {
	it('fordulók, szakasz-határok, tier', () => {
		expect(totalRounds(20)).toBe(38);
		expect(() => totalRounds(1)).toThrow();
		expect([0.2, 0.5, 0.8].map(seasonPhase)).toEqual(['eleje', 'kozepe', 'hajra']);
		expect([4, 5, 16, 17].map((p) => tableTier(p, 20))).toEqual(['felso', 'kozep', 'kozep', 'also']);
		expect(seasonProgress(deriveStandings(ms, asOf))).toBeCloseTo(2 / 6, 12);
		expect(seasonProgress([])).toBe(0);
	});
});

const table = (points: number[], played: number): StandingRow[] =>
	points.map((p, i) => ({
		position: i + 1,
		teamId: i + 1,
		played,
		won: 0,
		drawn: 0,
		lost: 0,
		goalsFor: 0,
		goalsAgainst: 0,
		goalDiff: 0,
		points: p
	}));

describe('motiváció / tét (§3.1)', () => {
	const zones: Zone[] = [
		{ kind: 'cim', from: 1, to: 1 },
		{ kind: 'europa', from: 1, to: 2 },
		{ kind: 'kieses', from: 6, to: 6 }
	];
	const opts = { zones, rounds: 30 };

	it('alap zónák', () => {
		expect(defaultZones(20)).toEqual([
			{ kind: 'cim', from: 1, to: 1 },
			{ kind: 'europa', from: 1, to: 4 },
			{ kind: 'kieses', from: 18, to: 20 }
		]);
	});

	it('a szezon első felében semleges', () => {
		const mo = teamMotivation(table([20, 19, 12, 10, 6, 5], 10), 1, opts)!;
		expect(mo).toMatchObject({ active: false, level: 'semleges', zone: null, remaining: 20 });
		expect(mo.zones[0].state).toBe('kritikus');
	});

	it('eldőlt / élő / kritikus (R = 10, max. 30 pont)', () => {
		const t = table([80, 45, 43, 30, 20, 5], 20);
		const leader = teamMotivation(t, 1, opts)!;
		expect(leader).toMatchObject({ active: true, level: 'semleges', zone: null });
		expect(leader.zones.map((z) => [z.zone.kind, z.gap, z.state])).toEqual([
			['cim', 35, 'eldolt'],
			['europa', 37, 'eldolt'],
			['kieses', 75, 'eldolt']
		]);
		expect(teamMotivation(t, 2, opts)).toMatchObject({ level: 'kritikus', zone: 'europa' });
		expect(teamMotivation(t, 3, opts)!.zones[1]).toMatchObject({ inZone: false, gap: -2, state: 'kritikus' });
		const bottom = teamMotivation(t, 6, opts)!;
		expect(bottom).toMatchObject({ level: 'elo', zone: 'kieses' });
		expect(bottom.zones[2]).toMatchObject({ inZone: true, gap: -15 });
		expect(motivationDiff(teamMotivation(t, 2, opts), leader)).toBe(2);
		expect(motivationDiff(null, bottom)).toBe(-1);
		expect(teamMotivation(t, 99, opts)).toBeNull();
	});

	it('R ≤ 5 → kritikus, R = 0 → eldőlt', () => {
		expect(teamMotivation(table([50, 30, 28, 20, 10, 5], 26), 2, opts)).toMatchObject({ level: 'kritikus', zone: 'europa' });
		expect(teamMotivation(table([50, 49, 48, 20, 10, 9], 30), 2, opts)).toMatchObject({ level: 'semleges', remaining: 0 });
	});
});

describe('buildMatchFeatures', () => {
	it('egy meccs összes feature-e, a hazai csapat szemszögéből', () => {
		const f = buildMatchFeatures({ id: 99, kickoff: asOf, homeTeamId: 2, awayTeamId: 1 }, { seasonMatches: ms });
		expect(f.home.table?.position).toBe(2);
		expect(f.away.table?.position).toBe(1);
		expect(f.home.tier).toBe('felso');
		expect(f.h2h).toMatchObject({ teamId: 2, matches: 1, meanGoalDiff: -2 });
		expect(f.home.venueForm.results).toEqual(['W']);
		expect(f.away.form.results).toEqual(['W', 'W']);
		expect(f.season).toMatchObject({ rounds: 6, phase: 'kozepe' });
		expect(f.league?.matches).toBe(4);
		expect(f.home.motivation?.active).toBe(false);
		expect(f.motivationDiff).toBe(0);
		expect(JSON.parse(JSON.stringify(f)).fixtureId).toBe(99);
	});
});
