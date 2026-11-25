import { day, m } from '../features/testMatches';
import { createEloState, DEFAULT_ELO_PARAMS, updateElo } from './elo';
import {
	ELO_LOGIT_VERSION,
	eloDiff,
	eloLogitPrediction,
	eloLogitSamples,
	fitOrdinalLogit,
	ordinalLogitLogLoss,
	ordinalLogitProbabilities,
	type OrdinalSample
} from './ordinalLogit';

/** Determinisztikus PRNG (mulberry32) a szintetikus mintához. */
const rng = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const TRUE = { beta: 1.6, cut1: -0.75, cut2: 0.3 };

const synthetic = (n: number, seed: number): OrdinalSample[] => {
	const r = rng(seed);
	return Array.from({ length: n }, () => {
		const diff = (r() - 0.5) * 800;
		const p = ordinalLogitProbabilities(diff, TRUE);
		const u = r();
		return { diff, outcome: u < p.home ? 0 : u < p.home + p.draw ? 1 : 2 };
	});
};

describe('ordinális logit', () => {
	it('valószínűségek: összeg 1, monoton az Elo-különbségben', () => {
		let prevHome = 0;
		for (const diff of [-600, -200, 0, 60, 300, 700]) {
			const p = ordinalLogitProbabilities(diff, TRUE);
			expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
			expect(Math.min(p.home, p.draw, p.away)).toBeGreaterThan(0);
			expect(p.home).toBeGreaterThan(prevHome);
			prevHome = p.home;
		}
		const p0 = ordinalLogitProbabilities(0, TRUE);
		expect(p0.away).toBeCloseTo(1 / (1 + Math.exp(0.75)), 12);
	});

	it('az illesztés visszaadja a generáló paramétereket (seedelt minta)', () => {
		const samples = synthetic(20_000, 42);
		const fit = fitOrdinalLogit(samples);
		expect(fit.converged).toBe(true);
		expect(fit.params.beta).toBeCloseTo(TRUE.beta, 1);
		expect(fit.params.cut1).toBeCloseTo(TRUE.cut1, 1);
		expect(fit.params.cut2).toBeCloseTo(TRUE.cut2, 1);
		// ML: a talált pont log-lossa nem rosszabb a valódi paramétereknél.
		expect(fit.logLoss).toBeLessThanOrEqual(ordinalLogitLogLoss(samples, TRUE) + 1e-12);
	});

	it('determinisztikus: ugyanarra a mintára bitre azonos eredmény', () => {
		const samples = synthetic(3_000, 7);
		expect(fitOrdinalLogit(samples)).toEqual(fitOrdinalLogit(samples));
	});

	it('üres mintára hibát dob', () => {
		expect(() => fitOrdinalLogit([])).toThrow();
	});
});

describe('Elo → logit minták', () => {
	it('walk-forward: a meccs előtti különbség, azonos kezdésnél nincs szivárgás', () => {
		const matches = [m(1, 1, 1, 2, 3, 0), m(2, 1, 3, 4, 0, 0), m(3, 2, 1, 3, 1, 2), m(4, 3, 2, 4, 2, 2)];
		const { samples, elo } = eloLogitSamples(matches);
		expect(samples.map((s) => s.outcome)).toEqual([0, 1, 2, 1]);
		// Első nap: mindenki 1500 → csak a hazai előny.
		expect(samples[0].diff).toBe(DEFAULT_ELO_PARAMS.homeAdvantage);
		expect(samples[1].diff).toBe(DEFAULT_ELO_PARAMS.homeAdvantage);
		const ref = createEloState();
		updateElo(ref, matches[0]);
		updateElo(ref, matches[1]);
		expect(samples[2].diff).toBeCloseTo(eloDiff(ref, matches[2]), 12);
		expect(elo.teams.get(1)!.matches).toBe(2);
	});

	it('include: kihagyott meccs csak bemelegít', () => {
		const matches = [m(1, 1, 1, 2, 3, 0), m(2, 2, 1, 2, 1, 0)];
		const { samples } = eloLogitSamples(matches, (x) => x.id === 2);
		expect(samples).toHaveLength(1);
		expect(samples[0].diff).toBeGreaterThan(DEFAULT_ELO_PARAMS.homeAdvantage);
	});

	it('predikció: verzió és konzisztens valószínűségek', () => {
		const elo = createEloState();
		updateElo(elo, m(1, 1, 1, 2, 2, 0));
		const p = eloLogitPrediction(elo, { kickoff: day(5), homeTeamId: 1, awayTeamId: 2 }, TRUE);
		expect(p.modelVersion).toBe(ELO_LOGIT_VERSION);
		expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
		expect(p.home).toBeGreaterThan(ordinalLogitProbabilities(DEFAULT_ELO_PARAMS.homeAdvantage, TRUE).home);
	});
});
