import { describe, expect, it } from 'vitest';
import {
	buildDrawSamples,
	createDrawHistory,
	DEFAULT_DRAW_HISTORY_OPTIONS,
	drawFeatureVector,
	leagueDrawRate,
	logit,
	recordDrawResult,
	teamDrawRate,
	type DrawFeatures,
	type DrawSourceMatch
} from './features';
import { drawScores, fitDrawModel, predictDraw, topShareCutoff } from './model';
import { sigmoid } from '../profile/logreg';

// Determinisztikus PRNG (mulberry32).
const rng = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const base: DrawFeatures = {
	pMarket: 0.27,
	pModel: 0.27,
	eloGap: 0,
	expectedGoals: 2.7,
	teamDrawRate: 0.26,
	leagueDrawRate: 0.26
};

const synth = (n: number, seed: number, modelEffect: number) => {
	const r = rng(seed);
	return Array.from({ length: n }, () => {
		const pMarket = 0.18 + r() * 0.16;
		const pModel = Math.min(0.45, Math.max(0.1, pMarket + (r() - 0.5) * 0.12));
		const f: DrawFeatures = { ...base, pMarket, pModel, eloGap: r() * 300, expectedGoals: 2 + r() * 1.6 };
		const pTrue = sigmoid(logit(pMarket) + modelEffect * (logit(pModel) - logit(pMarket)));
		return { features: f, isDraw: (r() < pTrue ? 1 : 0) as 0 | 1 };
	});
};

describe('drawFeatureVector', () => {
	it('referencia-jellemzőknél csak a konstans és a piaci logit nem nulla', () => {
		const x = drawFeatureVector(base);
		expect(x[0]).toBe(1);
		expect(x[1]).toBeCloseTo(logit(0.27), 12);
		expect(x.slice(2).every((v) => Math.abs(v) < 1e-12)).toBe(true);
	});
});

describe('döntetlen-történet', () => {
	it('üres történetnél a liga a referencia, a csapat a liga felé húzott arány', () => {
		const h = createDrawHistory();
		expect(leagueDrawRate(h, 'E0')).toBeCloseTo(0.26, 12);
		recordDrawResult(h, {
			id: 1,
			kickoff: '2022-08-01T12:00:00Z',
			homeTeamId: 1,
			awayTeamId: 2,
			homeGoals: 1,
			awayGoals: 1,
			league: 'E0'
		});
		const k = DEFAULT_DRAW_HISTORY_OPTIONS.teamPrior;
		const lg = leagueDrawRate(h, 'E0');
		expect(lg).toBeCloseTo((1 + 50 * 0.26) / 51, 12);
		expect(teamDrawRate(h, 1, 'E0')).toBeCloseTo((1 + k * lg) / (1 + k), 12);
		expect(teamDrawRate(h, 3, 'E0')).toBeCloseTo(lg, 12);
	});
});

describe('buildDrawSamples', () => {
	const odds = [2.5, 3.2, 3.0];
	const m = (id: number, day: number, h: number, a: number, hg: number, ag: number): DrawSourceMatch => ({
		id,
		kickoff: `2022-08-${String(day).padStart(2, '0')}T12:00:00Z`,
		homeTeamId: h,
		awayTeamId: a,
		homeGoals: hg,
		awayGoals: ag,
		league: 'E0',
		season: 2022,
		marketOpening1x2: odds
	});
	const pred = { pDraw: 0.28, lambdaHome: 1.4, lambdaAway: 1.1 };

	it('az azonos kezdésű meccsek egymás eredményét nem látják, a későbbiek igen', () => {
		const ms = [m(1, 1, 1, 2, 0, 0), m(2, 1, 3, 4, 2, 2), m(3, 8, 1, 3, 1, 0)];
		const s = buildDrawSamples(ms, new Map(ms.map((x) => [x.id, pred])));
		expect(s).toHaveLength(3);
		expect(s[0].features.leagueDrawRate).toBeCloseTo(0.26, 12);
		expect(s[1].features.leagueDrawRate).toBeCloseTo(0.26, 12);
		expect(s[2].features.leagueDrawRate).toBeGreaterThan(0.26);
		expect(s[2].features.teamDrawRate).toBeGreaterThan(s[2].features.leagueDrawRate);
		expect(s[0].isDraw).toBe(1);
		expect(s[2].isDraw).toBe(0);
		expect(s[0].features.expectedGoals).toBeCloseTo(2.5, 12);
		expect(s[0].features.eloGap).toBeCloseTo(60, 9); // azonos Elo + hazai előny
		expect(s[0].features.pMarket).toBeGreaterThan(0.29);
	});

	it('modell-predikció vagy odds nélkül nincs minta', () => {
		const ms = [m(1, 1, 1, 2, 0, 0), { ...m(2, 2, 3, 4, 1, 0), marketOpening1x2: undefined }];
		expect(buildDrawSamples(ms, new Map([[2, pred]]))).toHaveLength(0);
	});
});

describe('fitDrawModel / predictDraw', () => {
	it('visszaadja a valódi modell-hatást, és a tényezők magyarul, hozzájárulás szerint rendezve jönnek', () => {
		const model = fitDrawModel(synth(6000, 7, 1), { lambda: 1 });
		expect(model.converged).toBe(true);
		expect(model.weights[1]).toBeGreaterThan(0.7); // piaci logit
		expect(model.weights[2]).toBeGreaterThan(0.5); // gólmodell-eltérés
		const p = predictDraw(model, { ...base, pModel: 0.35 });
		expect(p.pDraw).toBeGreaterThan(p.pMarket);
		expect(p.factors[0].key).toBe('model');
		expect(p.factors[0].label).toBe('Gólmodell (Dixon–Coles)');
		expect(p.factors[0].detail).toContain('35,0%');
		for (let i = 1; i < p.factors.length; i++)
			expect(Math.abs(p.factors[i - 1].contribution)).toBeGreaterThanOrEqual(Math.abs(p.factors[i].contribution));
	});

	it('erős büntetésnél a tényezők eltűnnek, a kimenet a (kalibrált) piac', () => {
		const model = fitDrawModel(synth(4000, 3, 0), { lambda: 1e9 });
		expect(model.weights.slice(2).every((w) => Math.abs(w) < 1e-4)).toBe(true);
		expect(predictDraw(model, base).pDraw).toBeCloseTo(0.27, 1);
	});
});

describe('drawScores / topShareCutoff', () => {
	it('log-loss, Brier, kalibráció', () => {
		const s = drawScores([
			{ p: 0.5, isDraw: 1 },
			{ p: 0.5, isDraw: 0 }
		]);
		expect(s.logLoss).toBeCloseTo(Math.log(2), 12);
		expect(s.brier).toBeCloseTo(0.25, 12);
		expect(s.meanP).toBe(0.5);
		expect(s.drawRate).toBe(0.5);
		expect(drawScores([]).logLoss).toBeNull();
	});
	it('a felső hányad küszöbe', () => {
		const ps = [0.1, 0.4, 0.2, 0.3, 0.25, 0.35, 0.15, 0.22, 0.28, 0.31];
		expect(topShareCutoff(ps, 0.1)).toBe(0.4);
		expect(topShareCutoff(ps, 0.2)).toBe(0.35);
		expect(topShareCutoff([], 0.1)).toBe(Infinity);
	});
});
