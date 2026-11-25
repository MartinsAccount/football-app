import { describe, expect, it } from 'vitest';
import type { MatchResult } from '../features/types';
import { fitLogisticRegression } from './logreg';
import { favouritePick, namedProfileFeatures, PROFILE_FEATURE_COUNT, profileFeatures } from './features';
import { buildOwnerProfile, crossValidateProfile, imitatePick, MIN_PROFILE_SAMPLES } from './profile';
import type { ProfileSample, QuizPick, QuizQuestion } from './types';

// Determinisztikus PRNG (mulberry32).
const rng = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const RESULTS: MatchResult[] = ['W', 'D', 'L'];

const makeQuestions = (n: number, seed = 1): QuizQuestion[] => {
	const r = rng(seed);
	return Array.from({ length: n }, (_, i) => {
		const ph = 0.2 + r() * 0.55;
		const pd = 0.22 + r() * 0.08;
		const pa = Math.max(0.08, 1 - ph - pd);
		const m = 1.06;
		const po = 0.35 + r() * 0.3;
		const form = () => Array.from({ length: 5 }, () => RESULTS[Math.floor(r() * 3)]);
		return {
			fixtureId: 1000 + i,
			league: { id: 39, name: 'Premier League' },
			kickoff: `2023-0${1 + (i % 9)}-15T15:00:00Z`,
			home: { id: 1, name: 'Hazai', form: form(), tablePosition: 1 + Math.floor(r() * 20) },
			away: { id: 2, name: 'Vendég', form: form(), tablePosition: 1 + Math.floor(r() * 20) },
			odds1x2: { home: 1 / (ph * m), draw: 1 / (pd * m), away: 1 / (pa * m) },
			oddsOu25: i % 4 === 3 ? null : { over: 1 / (po * m), under: 1 / ((1 - po) * m) }
		};
	});
};

const answerAll = (qs: QuizQuestion[], pick: (q: QuizQuestion) => QuizPick | 'skip'): ProfileSample[] =>
	qs.map((q) => ({ question: q, answer: { fixtureId: q.fixtureId, pick: pick(q) } }));

/** Mindig a hazai favoritot rakja; ha a hazai nem favorit, kihagyja. */
const homeFavouriteFan = (q: QuizQuestion): QuizPick | 'skip' => (favouritePick(q) === '1' ? '1' : 'skip');

describe('profileFeatures', () => {
	const [q] = makeQuestions(1);
	it('a PROFILE_FEATURES sorrendjében, egy odds-sávval', () => {
		const x = profileFeatures(q, '1');
		expect(x).toHaveLength(PROFILE_FEATURE_COUNT);
		const named = namedProfileFeatures(q, '1');
		expect(named.pick_home).toBe(1);
		expect(named.odds_band_0 + named.odds_band_1 + named.odds_band_2 + named.odds_band_3).toBe(1);
	});
	it('favorit / esélytelen jelölés és tabella-előny', () => {
		const fixed: QuizQuestion = {
			...q,
			odds1x2: { home: 1.6, draw: 4, away: 6 },
			home: { ...q.home, form: ['W', 'W', 'W', 'W', 'W'], tablePosition: 2 },
			away: { ...q.away, form: ['L', 'L', 'L', 'L', 'L'], tablePosition: 18 }
		};
		const h = namedProfileFeatures(fixed, '1');
		expect(h.favourite).toBe(1);
		expect(h.underdog).toBe(0);
		expect(h.odds_band_1).toBe(1);
		expect(h.form_edge).toBe(1);
		expect(h.table_edge).toBeCloseTo(16 / 20);
		const a = namedProfileFeatures(fixed, '2');
		expect(a.underdog).toBe(1);
		expect(a.form_edge).toBe(-1);
		expect(namedProfileFeatures(fixed, 'X').balanced_draw).toBeGreaterThan(0);
	});
	it('O/U opció odds nélkül hibát dob', () => {
		expect(() => profileFeatures({ ...q, oddsOu25: null }, 'over')).toThrow();
	});
});

describe('fitLogisticRegression', () => {
	it('determinisztikus és megtalálja az irányt', () => {
		const X = [
			[1, 0],
			[1, 1],
			[1, 0],
			[1, 1],
			[1, 1]
		];
		const y = [0, 1, 0, 1, 0];
		const a = fitLogisticRegression(X, y, { lambda: 0.1 });
		const b = fitLogisticRegression(X, y, { lambda: 0.1 });
		expect(a.converged).toBe(true);
		expect(a.weights).toEqual(b.weights);
		expect(a.weights[1]).toBeGreaterThan(0);
	});
});

describe('buildOwnerProfile', () => {
	it(`${MIN_PROFILE_SAMPLES} válasz alatt „kevés adat”`, () => {
		const samples = answerAll(makeQuestions(MIN_PROFILE_SAMPLES - 1), () => '1');
		const p = buildOwnerProfile(samples);
		expect(p.status).toBe('kevés adat');
		expect(p.traits).toEqual([]);
		expect(imitatePick(p, samples[0].question)).toBeNull();
	});

	it('a hazai-favorit-rajongót felismeri', () => {
		const samples = answerAll(makeQuestions(150, 7), homeFavouriteFan);
		const p = buildOwnerProfile(samples);
		expect(p.status).toBe('ok');
		expect(p.answered).toBeGreaterThanOrEqual(MIN_PROFILE_SAMPLES);
		expect(p.traits).toHaveLength(3);
		expect(p.traits.some((t) => /^Kedveled (a hazai győzelmet|a favoritokat)$/.test(t))).toBe(true);
		const w = Object.fromEntries(p.weights.map((x) => [x.key, x.weight]));
		expect(w.pick_home).toBeGreaterThan(w.pick_away);
		expect(w.favourite).toBeGreaterThan(0);

		const fav: QuizQuestion = { ...samples[0].question, odds1x2: { home: 1.5, draw: 4.2, away: 6.5 } };
		const im = imitatePick(p, fav)!;
		expect(im.pick).toBe('1');
		expect(im.factors.length).toBeGreaterThan(0);
	});

	it('az over-rajongót is (gólpiac)', () => {
		const samples = answerAll(makeQuestions(120, 3), (q) => (q.oddsOu25 ? 'over' : 'skip'));
		const p = buildOwnerProfile(samples);
		expect(p.traits[0]).toBe('Kedveled a 2,5 gól feletti tippet');
	});
});

describe('crossValidateProfile', () => {
	it('a mindig-over válaszolónál veri a favorit-baseline-t', () => {
		const samples = answerAll(makeQuestions(120, 5), (q) => (q.oddsOu25 ? 'over' : 'skip'));
		const cv = crossValidateProfile(samples);
		expect(cv.status).toBe('ok');
		expect(cv.evaluated).toBe(90);
		expect(cv.agreement).toBeGreaterThan(0.9);
		expect(cv.baselineAgreement).toBe(0);
	});
	it('a hazai-favorit-rajongónál legalább a baseline szintjén', () => {
		const cv = crossValidateProfile(answerAll(makeQuestions(150, 11), homeFavouriteFan));
		expect(cv.agreement).toBeGreaterThanOrEqual(0.9);
		expect(cv.baselineAgreement).toBe(1);
	});
	it('kevés adatnál nem értékel', () => {
		expect(crossValidateProfile(answerAll(makeQuestions(5), () => '1')).status).toBe('kevés adat');
	});
});
