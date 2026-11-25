import { day, m } from '../features/testMatches';
import { createEloState, eloExpected, eloRatings, goalDiffMultiplier, ratingAt, updateElo } from './elo';
import {
	ELO_POISSON_VERSION,
	eloPoissonPrediction,
	explainEloPoisson,
	leagueGoals,
	predictEloPoisson,
	teamTempo,
	type EloPoissonInput
} from './eloPoisson';
import { dixonColesTau, marketProbabilities, poissonPmf, scoreMatrix } from './poisson';

describe('Elo', () => {
	it('várható eredmény és gólkülönbség-szorzó', () => {
		expect(eloExpected(1500, 1500, 0)).toBe(0.5);
		expect(eloExpected(1500, 1500, 60)).toBeCloseTo(1 / (1 + Math.pow(10, -60 / 400)), 12);
		expect([0, 1, -1, 2, 3, -4].map(goalDiffMultiplier)).toEqual([1, 1, 1, 1.5, 14 / 8, 15 / 8]);
	});

	it('frissítés: zéró összegű, a meglepetés többet ér', () => {
		const s = createEloState();
		updateElo(s, m(1, 1, 1, 2, 0, 1));
		const r1 = s.teams.get(1)!.rating;
		const r2 = s.teams.get(2)!.rating;
		expect(r1 + r2).toBeCloseTo(3000, 9);
		expect(r1 - 1500).toBeCloseTo(-20 * eloExpected(1500, 1500, 60), 9);
		expect(s.teams.get(2)!.matches).toBe(1);
	});

	it('pont-idejű; szezonszünet-visszahúzás; feljutó eltolás', () => {
		const ms = [m(1, 1, 1, 2, 3, 0), m(2, 5, 1, 2, 3, 0)];
		expect(eloRatings(ms, day(5)).teams.get(1)!.matches).toBe(1);
		const s = eloRatings(ms, day(6));
		const r = s.teams.get(1)!.rating;
		const later = Date.parse(day(5)) + 100 * 86_400_000;
		expect(ratingAt(s, 1, later)).toBeCloseTo(r + (1500 - r) / 3, 9);
		expect(ratingAt(s, 1, Date.parse(day(6)))).toBe(r);
		expect(ratingAt(s, 9, Date.parse(day(6)))).toBe(1500);
		expect(ratingAt(s, 9, later)).toBe(1450);
	});
});

describe('Poisson / Dixon–Coles', () => {
	it('pmf és τ', () => {
		expect(poissonPmf(0, 1.5)).toBeCloseTo(Math.exp(-1.5), 12);
		expect(poissonPmf(2, 1.5)).toBeCloseTo((Math.exp(-1.5) * 1.5 * 1.5) / 2, 12);
		expect(() => poissonPmf(-1, 1)).toThrow();
		expect(() => poissonPmf(1, 0)).toThrow();
		expect(dixonColesTau(0, 0, 1, 1, 0)).toBe(1);
		expect(dixonColesTau(1, 1, 1, 1, -0.1)).toBeCloseTo(1.1, 12);
		expect(dixonColesTau(2, 0, 1, 1, -0.1)).toBe(1);
	});

	it('mátrix: normált, a piacok konzisztensek', () => {
		const p = marketProbabilities(scoreMatrix(1.6, 1.1, -0.08));
		expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
		expect(p.over25 + p.under25).toBeCloseTo(1, 12);
		expect(p.over15).toBeGreaterThan(p.over25);
		expect(p.over25).toBeGreaterThan(p.over35);
		expect(p.over35 + p.under35).toBeCloseTo(1, 12);
		const m = scoreMatrix(1.6, 1.1, -0.08);
		const atLeast = (n: number) => m.reduce((s, row, i) => s + row.reduce((t, v, j) => t + (i + j >= n ? v : 0), 0), 0);
		expect(p.over15).toBeCloseTo(atLeast(2), 12);
		expect(p.over35).toBeCloseTo(atLeast(4), 12);
		expect(p.home).toBeGreaterThan(p.away);
		const sym = marketProbabilities(scoreMatrix(1.3, 1.3));
		expect(sym.home).toBeCloseTo(sym.away, 12);
	});

	it('negatív ρ több döntetlent ad', () => {
		const plain = marketProbabilities(scoreMatrix(1.4, 1.2, 0)).draw;
		expect(marketProbabilities(scoreMatrix(1.4, 1.2, -0.1)).draw).toBeGreaterThan(plain);
	});
});

describe('elo-poisson@0.1.0', () => {
	const base: EloPoissonInput = {
		homeRating: 1500,
		awayRating: 1500,
		leagueHomeGoals: 1.5,
		leagueAwayGoals: 1.2,
		homeTempo: 1,
		awayTempo: 1
	};

	it('λ: Elo-fölény és tempó', () => {
		const eq = predictEloPoisson(base);
		expect(eq.lambdaHome).toBeCloseTo(1.5, 12);
		expect(eq.lambdaAway).toBeCloseTo(1.2, 12);
		const strong = predictEloPoisson({ ...base, homeRating: 1700 });
		expect(strong.lambdaHome).toBeCloseTo(1.5 * Math.exp(0.3), 12);
		expect(strong.probabilities.home).toBeGreaterThan(eq.probabilities.home);
		expect(predictEloPoisson({ ...base, homeTempo: 1.3, awayTempo: 1.3 }).probabilities.over25).toBeGreaterThan(
			eq.probabilities.over25
		);
	});

	it('indoklás: abláció, rangsor, szöveg', () => {
		const ex = explainEloPoisson({ ...base, homeRating: 1600, homeTempo: 1.2, awayTempo: 1.1 });
		expect(ex.map((c) => c.factor)).toHaveLength(3);
		expect(ex[0].factor).toBe('elo');
		const elo = ex[0];
		expect(elo.deltaPp.home).toBeGreaterThan(0);
		expect(elo.deltaPp.home + elo.deltaPp.draw + elo.deltaPp.away).toBeCloseTo(0, 9);
		expect(elo.text).toMatch(/^A hazai csapat 100 Elo-ponttal erősebb \(\+\d+ pp a hazai győzelemre\)\.$/);
		expect(ex.find((c) => c.factor === 'tempo')!.text).toMatch(/^Gólgazdag csapatok: \+\d+ pp/);
		expect(explainEloPoisson(base).find((c) => c.factor === 'elo')!.text).toBe('A két csapat Elo-ereje közel azonos.');
		expect(explainEloPoisson(base).find((c) => c.factor === 'homeAdvantage')!.deltaPp.home).toBeGreaterThan(0);
	});

	it('ligaátlag és tempó shrinkage-dzsel', () => {
		const ms = [m(1, 1, 1, 2, 4, 2), m(2, 2, 3, 4, 0, 0)];
		const lg = leagueGoals(ms, day(3));
		expect(lg.matches).toBe(2);
		expect(lg.homeGoals).toBeCloseTo((4 + 50 * 1.5) / 52, 12);
		expect(lg.awayGoals).toBeCloseTo((2 + 50 * 1.2) / 52, 12);
		const t = teamTempo(ms, 1, day(3), 2.5);
		expect(t.matches).toBe(1);
		expect(t.tempo).toBeCloseTo((6 + 25) / (11 * 2.5), 12);
		expect(teamTempo(ms, 9, day(3), 2.5).tempo).toBe(1);
	});

	it('meccs-predikció: pont-idejű, verzió, bemenet-snapshot', () => {
		const ms = [m(1, 1, 1, 2, 3, 0), m(2, 2, 3, 4, 1, 1), m(3, 3, 1, 3, 2, 0), m(4, 9, 1, 2, 0, 5)];
		const p = eloPoissonPrediction({ id: 99, kickoff: day(5), homeTeamId: 1, awayTeamId: 2 }, { history: ms });
		expect(p.modelVersion).toBe(ELO_POISSON_VERSION);
		expect(p.inputs.homeMatches).toBe(2);
		expect(p.inputs.leagueMatches).toBe(3);
		expect(p.inputs.homeRating).toBeGreaterThan(p.inputs.awayRating);
		expect(p.probabilities.home).toBeGreaterThan(p.probabilities.away);
		expect(p.explanation.find((c) => c.factor === 'elo')!.deltaPp.home).toBeGreaterThan(0);
		const pre = eloRatings(ms, day(5));
		expect(eloPoissonPrediction({ id: 99, kickoff: day(5), homeTeamId: 1, awayTeamId: 2 }, { history: ms, elo: pre })).toEqual(p);
	});
});
