import { describe, expect, it } from 'vitest';
import { scoreMatrix } from './poisson';
import {
	DIXON_COLES_VERSION,
	dixonColesPredict,
	dixonColesWalkForward,
	fitDixonColes,
	type DixonColesMatch
} from './dixonColesFit';

/** Determinisztikus PRNG (mulberry32) a szintetikus mintához. */
const rng = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const N_TEAMS = 12;
const TRUE = {
	intercept: 0.1,
	homeAdvantage: 0.25,
	rho: -0.12,
	attack: Array.from({ length: N_TEAMS }, (_, i) => (i - (N_TEAMS - 1) / 2) * 0.06),
	defence: Array.from({ length: N_TEAMS }, (_, i) => (((i * 5) % N_TEAMS) - (N_TEAMS - 1) / 2) * 0.05)
};

const iso = (dayIndex: number) => new Date(Date.UTC(2022, 0, 1) + dayIndex * 86_400_000).toISOString();

/** `rounds` dupla körmérkőzés a valódi Dixon–Coles eloszlásból mintavételezve. */
const synthetic = (rounds: number, seed: number): DixonColesMatch[] => {
	const r = rng(seed);
	const out: DixonColesMatch[] = [];
	let d = 0;
	for (let k = 0; k < rounds; k++)
		for (let h = 0; h < N_TEAMS; h++)
			for (let a = 0; a < N_TEAMS; a++) {
				if (h === a) continue;
				const lh = Math.exp(TRUE.intercept + TRUE.homeAdvantage + TRUE.attack[h] + TRUE.defence[a]);
				const la = Math.exp(TRUE.intercept + TRUE.attack[a] + TRUE.defence[h]);
				const mx = scoreMatrix(lh, la, TRUE.rho);
				let u = r();
				let x = 0;
				let y = 0;
				search: for (x = 0; x < mx.length; x++)
					for (y = 0; y < mx.length; y++) {
						u -= mx[x][y];
						if (u <= 0) break search;
					}
				out.push({ id: out.length + 1, kickoff: iso(d++), homeTeamId: h + 1, awayTeamId: a + 1, homeGoals: x, awayGoals: y });
			}
	return out;
};

const center = (xs: number[]) => {
	const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
	return xs.map((x) => x - mean);
};

describe('Dixon–Coles ML-illesztés', () => {
	const sample = synthetic(12, 7);
	const asOf = iso(sample.length + 1);
	const fit = fitDixonColes(sample, { asOf, xi: 0, ridge: 1e-4 });

	it('visszanyeri a paramétereket szintetikus mintán (γ, ρ, centrált att/def)', () => {
		expect(fit.converged).toBe(true);
		expect(fit.matches).toBe(sample.length);
		expect(fit.params.leagues._.homeAdvantage).toBeCloseTo(TRUE.homeAdvantage, 1);
		expect(Math.abs(fit.params.rho - TRUE.rho)).toBeLessThan(0.06);
		const att = center(Array.from({ length: N_TEAMS }, (_, i) => fit.params.teams[String(i + 1)].attack));
		const def = center(Array.from({ length: N_TEAMS }, (_, i) => fit.params.teams[String(i + 1)].defence));
		const tAtt = center(TRUE.attack);
		const tDef = center(TRUE.defence);
		for (let i = 0; i < N_TEAMS; i++) {
			expect(Math.abs(att[i] - tAtt[i])).toBeLessThan(0.12);
			expect(Math.abs(def[i] - tDef[i])).toBeLessThan(0.12);
		}
		// A teljes gólszint (μ + átlagos att + átlagos def) is visszajön.
		const level = (p: typeof fit.params) => {
			const ts = Object.values(p.teams);
			return p.leagues._.intercept + ts.reduce((s, t) => s + t.attack + t.defence, 0) / ts.length;
		};
		expect(level(fit.params)).toBeCloseTo(TRUE.intercept, 1);
	});

	it('determinisztikus, és a meleg indítás ugyanoda konvergál', () => {
		expect(fitDixonColes(sample, { asOf, xi: 0, ridge: 1e-4 })).toEqual(fit);
		const warm = fitDixonColes(sample, { asOf, xi: 0, ridge: 1e-4, init: fit.params });
		expect(warm.params.rho).toBeCloseTo(fit.params.rho, 5);
		expect(warm.params.teams['3'].attack).toBeCloseTo(fit.params.teams['3'].attack, 5);
	});

	it('nem lát a jövőbe: az asOf utáni (és azonos idejű) meccs nem számít', () => {
		const future: DixonColesMatch = { id: 99_999, kickoff: asOf, homeTeamId: 1, awayTeamId: 2, homeGoals: 9, awayGoals: 0 };
		expect(fitDixonColes([...sample, future], { asOf, xi: 0, ridge: 1e-4 })).toEqual(fit);
	});

	it('az időbeli súly a friss formát erősebben veszi', () => {
		// A 13-as csapat régen sokat kapott, a végén sokat rúg.
		const extra: DixonColesMatch[] = [];
		for (let k = 0; k < 20; k++)
			extra.push({ id: 10_000 + k, kickoff: iso(k), homeTeamId: 13, awayTeamId: 1 + (k % N_TEAMS), homeGoals: 0, awayGoals: 3 });
		for (let k = 0; k < 20; k++)
			extra.push({
				id: 20_000 + k,
				kickoff: iso(sample.length - 20 + k),
				homeTeamId: 13,
				awayTeamId: 1 + (k % N_TEAMS),
				homeGoals: 3,
				awayGoals: 0
			});
		const data = [...sample, ...extra];
		const flat = fitDixonColes(data, { asOf, xi: 0, ridge: 1 });
		const decayed = fitDixonColes(data, { asOf, xi: 0.01, ridge: 1 });
		expect(decayed.params.teams['13'].attack).toBeGreaterThan(flat.params.teams['13'].attack);
	});

	it('predikció: a piacok összege 1, hazai előny, ismeretlen csapat = ligaátlag', () => {
		const p = dixonColesPredict(fit.params, 999, 998).probabilities;
		expect(p.home + p.draw + p.away).toBeCloseTo(1, 10);
		expect(p.over25 + p.under25).toBeCloseTo(1, 10);
		expect(p.home).toBeGreaterThan(p.away);
		const strong = dixonColesPredict(fit.params, N_TEAMS, 1);
		expect(strong.lambdaHome).toBeGreaterThan(strong.lambdaAway);
		expect(DIXON_COLES_VERSION).toBe('dixon-coles@1.0.0');
	});

	it('walk-forward: csak a kezdés előtti meccsekből, a megadott meccsekre', () => {
		const preds = dixonColesWalkForward(sample, (m) => m.id > sample.length - 30, { xi: 0, ridge: 1e-4, refitDays: 10 });
		expect(preds.size).toBe(30);
		const last = sample[sample.length - 1];
		const direct = fitDixonColes(sample, { asOf: sample[sample.length - 30].kickoff, xi: 0, ridge: 1e-4 });
		expect(preds.get(sample.length - 29)!.lambdaHome).toBeCloseTo(
			dixonColesPredict(direct.params, sample[sample.length - 30].homeTeamId, sample[sample.length - 30].awayTeamId).lambdaHome,
			4
		);
		expect(preds.has(last.id)).toBe(true);
	});

	it('üres tanítóminta: hiba', () => {
		expect(() => fitDixonColes(sample, { asOf: iso(0) })).toThrow();
	});
});
