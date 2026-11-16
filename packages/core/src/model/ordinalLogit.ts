// M1 (strategy.md §4.2, ROADMAP 6.1): ordinális (kumulatív) logit az Elo-különbségen → 1X2. Külön modellverzió (`elo-logit@1.0.0`),
// a v0 (`elo-poisson`) mellett; még nem élesített (shadow → live: 🔶 6.5). Terv: docs/plans/model-v1.md.
// Kimenet-sorrend a modellben: vendég (0) < döntetlen (1) < hazai (2); kifelé `{ home, draw, away }`.
//   x = (R_h + H − R_a) / 400,  P(vendég) = σ(c1 − βx),  P(vendég ∪ döntetlen) = σ(c2 − βx),  c1 < c2.
// Az illesztés maximum likelihood, Newton-lépésekkel visszalépő vonalkereséssel; véletlen nincs → determinisztikus.
import { outcome1x2 } from '../evaluation/evaluation';
import type { PlayedMatch } from '../features/types';
import { createEloState, DEFAULT_ELO_PARAMS, ratingAt, updateElo, type EloParams, type EloState } from './elo';

export const ELO_LOGIT_VERSION = 'elo-logit@1.0.0';

export interface OrdinalLogitParams {
	/** Meredekség a skálázott Elo-különbségen (x = diff / 400). */
	beta: number;
	/** Küszöb: vendég | döntetlen. */
	cut1: number;
	/** Küszöb: döntetlen | hazai (cut2 > cut1). */
	cut2: number;
}

/** Egy tanítóminta: a meccs előtti Elo-különbség (hazai előnnyel, Elo-pontban) és az 1X2 kimenet (0 hazai, 1 döntetlen, 2 vendég). */
export interface OrdinalSample {
	diff: number;
	outcome: 0 | 1 | 2;
}

export interface Probabilities1x2 {
	home: number;
	draw: number;
	away: number;
}

const sigmoid = (t: number) => (t >= 0 ? 1 / (1 + Math.exp(-t)) : Math.exp(t) / (1 + Math.exp(t)));
const logit = (p: number) => Math.log(p / (1 - p));
const EPS = 1e-12;

/** 1X2 valószínűségek egy Elo-különbségből (Elo-pont, a hazai előnnyel együtt). */
export const ordinalLogitProbabilities = (diff: number, params: OrdinalLogitParams): Probabilities1x2 => {
	const z = (params.beta * diff) / 400;
	const fa = sigmoid(params.cut1 - z);
	const fad = sigmoid(params.cut2 - z);
	return { home: 1 - fad, draw: Math.max(0, fad - fa), away: fa };
};

/** Átlagos negatív log-likelihood (= átlagos log-loss) a mintákon. */
export const ordinalLogitLogLoss = (samples: readonly OrdinalSample[], params: OrdinalLogitParams): number => {
	let sum = 0;
	for (const s of samples) {
		const p = ordinalLogitProbabilities(s.diff, params);
		sum -= Math.log(Math.max(EPS, [p.home, p.draw, p.away][s.outcome]));
	}
	return sum / samples.length;
};

type Vec3 = [number, number, number];

/** A log-likelihood (összeg) és gradiense (β, c1, c2) szerint. */
const logLikGrad = (samples: readonly OrdinalSample[], [beta, c1, c2]: Vec3): { ll: number; g: Vec3 } => {
	let ll = 0;
	const g: Vec3 = [0, 0, 0];
	for (const s of samples) {
		const x = s.diff / 400;
		const a = c1 - beta * x;
		const b = c2 - beta * x;
		const fa = sigmoid(a);
		const fb = sigmoid(b);
		if (s.outcome === 2) {
			// vendég: log F(a)
			ll += Math.log(Math.max(EPS, fa));
			g[1] += 1 - fa;
			g[0] -= x * (1 - fa);
		} else if (s.outcome === 0) {
			// hazai: log(1 − F(b))
			ll += Math.log(Math.max(EPS, 1 - fb));
			g[2] -= fb;
			g[0] += x * fb;
		} else {
			const d = Math.max(EPS, fb - fa);
			ll += Math.log(d);
			const da = (-fa * (1 - fa)) / d;
			const db = (fb * (1 - fb)) / d;
			g[1] += da;
			g[2] += db;
			g[0] -= x * (da + db);
		}
	}
	return { ll, g };
};

/** 3×3 lineáris rendszer (Gauss, részleges főelem-kiválasztással); szingulárisnál `null`. */
const solve3 = (m: number[][], v: Vec3): Vec3 | null => {
	const a = m.map((row, i) => [...row, v[i]]);
	for (let c = 0; c < 3; c++) {
		let p = c;
		for (let r = c + 1; r < 3; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
		if (Math.abs(a[p][c]) < 1e-14) return null;
		[a[c], a[p]] = [a[p], a[c]];
		for (let r = 0; r < 3; r++) {
			if (r === c) continue;
			const f = a[r][c] / a[c][c];
			for (let k = c; k < 4; k++) a[r][k] -= f * a[c][k];
		}
	}
	return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
};

export interface OrdinalLogitFit {
	params: OrdinalLogitParams;
	/** Átlagos log-loss a tanítómintán. */
	logLoss: number;
	iterations: number;
	converged: boolean;
}

/**
 * Maximum likelihood illesztés. Kezdőpont: β = 1, a küszöbök a tapasztalati gyakoriságokból (véletlen nincs, ugyanarra a mintára
 * mindig ugyanaz az eredmény). Newton-irány numerikus Hesse-mátrixszal (az analitikus gradiens központi differenciája);
 * ha az nem emelkedő irány, gradiens-lépés. Visszalépő vonalkeresés, a `cut1 < cut2` feltétel megtartásával.
 */
export const fitOrdinalLogit = (
	samples: readonly OrdinalSample[],
	options: { maxIterations?: number; tolerance?: number } = {}
): OrdinalLogitFit => {
	if (samples.length === 0) throw new Error('fitOrdinalLogit: üres minta');
	const maxIt = options.maxIterations ?? 100;
	const tol = options.tolerance ?? 1e-8;
	const n = samples.length;
	const freq = [0, 0, 0];
	for (const s of samples) freq[s.outcome]++;
	const pAway = Math.min(0.98, Math.max(0.01, freq[2] / n));
	const pAwayDraw = Math.min(0.99, Math.max(pAway + 0.005, (freq[2] + freq[1]) / n));
	let theta: Vec3 = [1, logit(pAway), logit(pAwayDraw)];
	let cur = logLikGrad(samples, theta);
	let it = 0;
	let converged = false;
	for (; it < maxIt; it++) {
		const gNorm = Math.hypot(...cur.g) / n;
		if (gNorm < tol) {
			converged = true;
			break;
		}
		const h = 1e-5;
		const hess: number[][] = [0, 1, 2].map((j) => {
			const plus = [...theta] as Vec3;
			const minus = [...theta] as Vec3;
			plus[j] += h;
			minus[j] -= h;
			const gp = logLikGrad(samples, plus).g;
			const gm = logLikGrad(samples, minus).g;
			return [0, 1, 2].map((i) => (gp[i] - gm[i]) / (2 * h));
		});
		// Newton: H·d = −g (H negatív definit a maximum körül).
		let dir = solve3(hess, [-cur.g[0], -cur.g[1], -cur.g[2]]);
		if (!dir || dir[0] * cur.g[0] + dir[1] * cur.g[1] + dir[2] * cur.g[2] <= 0) dir = cur.g.map((x) => x / n) as Vec3;
		let step = 1;
		let accepted = false;
		for (let k = 0; k < 40; k++, step /= 2) {
			const next: Vec3 = [theta[0] + step * dir[0], theta[1] + step * dir[1], theta[2] + step * dir[2]];
			if (next[2] <= next[1]) continue;
			const cand = logLikGrad(samples, next);
			if (cand.ll >= cur.ll) {
				theta = next;
				cur = cand;
				accepted = true;
				break;
			}
		}
		if (!accepted) {
			converged = true;
			break;
		}
	}
	const params = { beta: theta[0], cut1: theta[1], cut2: theta[2] };
	return { params, logLoss: -cur.ll / n, iterations: it, converged };
};

/**
 * Walk-forward tanítóminták: a meccseket kezdés szerint léptetjük, minden meccshez a MECCS ELŐTTI Elo-különbség (az azonos kezdésű
 * meccsek egymás eredményét nem látják), utána frissítünk. Az `include` dönti el, melyik meccs kerül a mintába (pl. csak a
 * tanító szezonok; a többi csak bemelegít). A kész Elo-állapotot is visszaadja.
 */
export const eloLogitSamples = <M extends PlayedMatch>(
	matches: readonly M[],
	include: (m: M) => boolean = () => true,
	eloParams: EloParams = DEFAULT_ELO_PARAMS
): { samples: Array<OrdinalSample & { id: number }>; elo: EloState } => {
	const sorted = [...matches].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
	const elo = createEloState();
	const samples: Array<OrdinalSample & { id: number }> = [];
	for (let i = 0; i < sorted.length; ) {
		let j = i;
		while (j < sorted.length && sorted[j].kickoff === sorted[i].kickoff) j++;
		const group = sorted.slice(i, j);
		for (const m of group) {
			if (!include(m)) continue;
			const diff = eloDiff(elo, m, eloParams);
			samples.push({ id: m.id, diff, outcome: outcome1x2(m.homeGoals, m.awayGoals) });
		}
		for (const m of group) updateElo(elo, m, eloParams);
		i = j;
	}
	return { samples, elo };
};

/** A meccs előtti Elo-különbség (hazai − vendég + hazai előny), Elo-pontban. Nem módosítja az állapotot. */
export const eloDiff = (
	elo: EloState,
	match: Pick<PlayedMatch, 'kickoff' | 'homeTeamId' | 'awayTeamId'>,
	eloParams: EloParams = DEFAULT_ELO_PARAMS
): number => {
	const t = Date.parse(match.kickoff);
	return ratingAt(elo, match.homeTeamId, t, eloParams) + eloParams.homeAdvantage - ratingAt(elo, match.awayTeamId, t, eloParams);
};

/** M1 predikció: Elo-állapot + illesztett logit → 1X2. */
export const eloLogitPrediction = (
	elo: EloState,
	match: Pick<PlayedMatch, 'kickoff' | 'homeTeamId' | 'awayTeamId'>,
	params: OrdinalLogitParams,
	eloParams: EloParams = DEFAULT_ELO_PARAMS
): Probabilities1x2 & { diff: number; modelVersion: string } => {
	const diff = eloDiff(elo, match, eloParams);
	return { ...ordinalLogitProbabilities(diff, params), diff, modelVersion: ELO_LOGIT_VERSION };
};
