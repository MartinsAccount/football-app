// Modell v1 M2 `dixon-coles@1.0.0` (I26, ROADMAP 6.2b, docs/plans/model-v1.md): Dixon–Coles (1997) maximum likelihood illesztés.
// log λ_hazai = μ_L + γ_L + att_h + def_v, log λ_vendég = μ_L + att_v + def_h (μ_L, γ_L ligánként), közös ρ (τ-korrekció),
// időbeli súly w = exp(−ξ · napok az asOf előtt). Az att/def L2-büntetése (ridge) adja az azonosíthatóságot és a kevés meccses
// csapatok ligaátlag felé húzását. Determinisztikus: rögzített kezdőpont, véletlen nincs. Tiszta függvények, I/O nincs.
import type { PlayedMatch } from '../features/types';
import { marketProbabilities, scoreMatrix, type MarketProbabilities } from './poisson';

export const DIXON_COLES_VERSION = 'dixon-coles@1.0.0';

const DAY_MS = 86_400_000;

export interface DixonColesMatch extends PlayedMatch {
	/** Liga-kulcs (μ_L, γ_L); hiányában egyetlen közös liga. */
	league?: string;
}

export interface DixonColesParams {
	rho: number;
	/** Ligánként: μ (log vendég-gólszint átlagos csapatoknál) és γ (log hazai előny). */
	leagues: Record<string, { intercept: number; homeAdvantage: number }>;
	/** Csapatonként (kulcs: csapat-id): támadó és védő (+ = többet kap) log-erő. */
	teams: Record<string, { attack: number; defence: number }>;
}

export interface DixonColesFitOptions {
	/** Csak az ennél korábban kezdődött meccsekből tanul; a súly innen számol. */
	asOf: string;
	/** Időbeli lecsengés naponta (0 = egyenlő súly). */
	xi?: number;
	/** Az att/def L2-büntetése (prior szórás ≈ 1/√ridge). */
	ridge?: number;
	/** Ennél régebbi (nap) meccs nem kerül a mintába; alap: nincs korlát. */
	windowDays?: number;
	/** Meleg indítás (pl. az előző illesztés); az új csapatok 0-ról indulnak. */
	init?: DixonColesParams;
	maxIterations?: number;
	/** Konvergencia: a log-likelihood relatív javulása ennél kisebb. */
	tolerance?: number;
}

export interface DixonColesFit {
	params: DixonColesParams;
	/** Súlyozott átlagos negatív log-likelihood (büntetés nélkül). */
	logLoss: number;
	matches: number;
	iterations: number;
	converged: boolean;
}

export const DEFAULT_DIXON_COLES_OPTIONS = { xi: 0.002, ridge: 2, maxIterations: 100, tolerance: 1e-10 };

const leagueOf = (m: DixonColesMatch) => m.league ?? '_';
const lgamma1 = (k: number) => {
	let s = 0;
	for (let i = 2; i <= k; i++) s += Math.log(i);
	return s;
};

/** τ és a log τ deriváltjai (η_h = log λ, η_a = log μ, ρ szerint). */
const tauParts = (x: number, y: number, lh: number, la: number, rho: number) => {
	if (x === 0 && y === 0) return { tau: 1 - lh * la * rho, dh: -lh * la * rho, da: -lh * la * rho, dr: -lh * la };
	if (x === 0 && y === 1) return { tau: 1 + lh * rho, dh: lh * rho, da: 0, dr: lh };
	if (x === 1 && y === 0) return { tau: 1 + la * rho, dh: 0, da: la * rho, dr: la };
	if (x === 1 && y === 1) return { tau: 1 - rho, dh: 0, da: 0, dr: -1 };
	return null;
};

/** Szimmetrikus pozitív definit rendszer (Cholesky); nem PD esetén `null`. */
const solveSpd = (a: Float64Array, b: Float64Array, n: number): Float64Array | null => {
	const l = new Float64Array(n * n);
	for (let i = 0; i < n; i++) {
		for (let j = 0; j <= i; j++) {
			let s = a[i * n + j];
			for (let k = 0; k < j; k++) s -= l[i * n + k] * l[j * n + k];
			if (i === j) {
				if (!(s > 1e-12)) return null;
				l[i * n + i] = Math.sqrt(s);
			} else l[i * n + j] = s / l[j * n + j];
		}
	}
	const y = new Float64Array(n);
	for (let i = 0; i < n; i++) {
		let s = b[i];
		for (let k = 0; k < i; k++) s -= l[i * n + k] * y[k];
		y[i] = s / l[i * n + i];
	}
	const x = new Float64Array(n);
	for (let i = n - 1; i >= 0; i--) {
		let s = y[i];
		for (let k = i + 1; k < n; k++) s -= l[k * n + i] * x[k];
		x[i] = s / l[i * n + i];
	}
	return x;
};

/**
 * ML-illesztés az `asOf` előtti meccseken. Newton-típusú lépés: a Poisson-rész Hesse-mátrixa pontos, a τ-rész csak a ρρ-elemben
 * szerepel (a kereszttagok nélkül is negatív definit → emelkedő irány), visszalépő vonalkereséssel (τ > 0 végig megmarad).
 */
export const fitDixonColes = (matches: readonly DixonColesMatch[], options: DixonColesFitOptions): DixonColesFit => {
	const asOf = Date.parse(options.asOf);
	if (Number.isNaN(asOf)) throw new Error(`fitDixonColes: érvénytelen asOf: ${options.asOf}`);
	const xi = options.xi ?? DEFAULT_DIXON_COLES_OPTIONS.xi;
	const ridge = options.ridge ?? DEFAULT_DIXON_COLES_OPTIONS.ridge;
	const maxIt = options.maxIterations ?? DEFAULT_DIXON_COLES_OPTIONS.maxIterations;
	const tol = options.tolerance ?? DEFAULT_DIXON_COLES_OPTIONS.tolerance;
	const window = options.windowDays ?? Infinity;

	const sample = matches
		.map((m) => ({ m, age: (asOf - Date.parse(m.kickoff)) / DAY_MS }))
		.filter(({ age }) => age > 0 && age <= window)
		.sort((a, b) => Date.parse(a.m.kickoff) - Date.parse(b.m.kickoff) || a.m.id - b.m.id);
	if (sample.length === 0) throw new Error('fitDixonColes: nincs tanítómeccs az asOf előtt');

	// Paraméter-index: [ρ, μ_L…, γ_L…, att_t…, def_t…] (rendezett kulcsok → determinisztikus).
	const leagues = [...new Set(sample.map(({ m }) => leagueOf(m)))].sort();
	const teams = [...new Set(sample.flatMap(({ m }) => [m.homeTeamId, m.awayTeamId]))].sort((a, b) => a - b);
	const L = leagues.length;
	const T = teams.length;
	const P = 1 + 2 * L + 2 * T;
	const li = new Map(leagues.map((k, i) => [k, i]));
	const ti = new Map(teams.map((k, i) => [k, i]));
	const rows = sample.map(({ m, age }) => {
		const l = li.get(leagueOf(m))!;
		const h = ti.get(m.homeTeamId)!;
		const a = ti.get(m.awayTeamId)!;
		return {
			w: Math.exp(-xi * age),
			x: m.homeGoals,
			y: m.awayGoals,
			// η_h indexei: μ_L, γ_L, att_h, def_a; η_a: μ_L, att_a, def_h
			sh: [1 + l, 1 + L + l, 1 + 2 * L + h, 1 + 2 * L + T + a],
			sa: [1 + l, 1 + 2 * L + a, 1 + 2 * L + T + h],
			c: lgamma1(m.homeGoals) + lgamma1(m.awayGoals)
		};
	});
	const sumW = rows.reduce((s, r) => s + r.w, 0);

	// Kezdőpont: meleg indítás, különben ligánkénti súlyozott gólátlag, att = def = ρ = 0.
	const theta = new Float64Array(P);
	leagues.forEach((k, l) => {
		const prev = options.init?.leagues[k];
		if (prev) {
			theta[1 + l] = prev.intercept;
			theta[1 + L + l] = prev.homeAdvantage;
			return;
		}
		let w = 0;
		let hg = 0;
		let ag = 0;
		sample.forEach(({ m }, i) => {
			if (leagueOf(m) !== k) return;
			w += rows[i].w;
			hg += rows[i].w * m.homeGoals;
			ag += rows[i].w * m.awayGoals;
		});
		theta[1 + l] = Math.log(Math.max(0.1, ag / w));
		theta[1 + L + l] = Math.log(Math.max(0.1, hg / w) / Math.max(0.1, ag / w));
	});
	teams.forEach((t, i) => {
		const prev = options.init?.teams[String(t)];
		if (prev) {
			theta[1 + 2 * L + i] = prev.attack;
			theta[1 + 2 * L + T + i] = prev.defence;
		}
	});
	if (options.init) theta[0] = options.init.rho;

	const evaluate = (th: Float64Array, withDerivs: boolean) => {
		let ll = 0;
		const g = withDerivs ? new Float64Array(P) : null;
		const h = withDerivs ? new Float64Array(P * P) : null;
		const rho = th[0];
		for (const r of rows) {
			let eh = 0;
			for (const k of r.sh) eh += th[k];
			let ea = 0;
			for (const k of r.sa) ea += th[k];
			const lh = Math.exp(eh);
			const la = Math.exp(ea);
			const t = tauParts(r.x, r.y, lh, la, rho);
			if (t && !(t.tau > 0)) return { ll: -Infinity, g, h };
			ll += r.w * ((t ? Math.log(t.tau) : 0) + r.x * eh - lh + r.y * ea - la - r.c);
			if (!g || !h) continue;
			const gh = r.w * (r.x - lh + (t ? t.dh / t.tau : 0));
			const ga = r.w * (r.y - la + (t ? t.da / t.tau : 0));
			for (const k of r.sh) g[k] += gh;
			for (const k of r.sa) g[k] += ga;
			for (const i of r.sh) for (const j of r.sh) h[i * P + j] += r.w * lh;
			for (const i of r.sa) for (const j of r.sa) h[i * P + j] += r.w * la;
			if (t) {
				g[0] += (r.w * t.dr) / t.tau;
				h[0] += (r.w * t.dr * t.dr) / (t.tau * t.tau);
			}
		}
		let pen = 0;
		for (let k = 1 + 2 * L; k < P; k++) {
			pen += 0.5 * ridge * th[k] * th[k];
			if (g && h) {
				g[k] -= ridge * th[k];
				h[k * P + k] += ridge;
			}
		}
		if (h) h[0] += 1e-9;
		return { ll: ll - pen, raw: ll, g, h };
	};

	let cur = evaluate(theta, true);
	let it = 0;
	let converged = false;
	for (; it < maxIt; it++) {
		// h itt a NEGATÍV Hesse-közelítés (PD) → h·d = g.
		const dir = solveSpd(cur.h!, cur.g!, P) ?? cur.g!.map((v) => v / sumW);
		let step = 1;
		let next: Float64Array | null = null;
		let cand: ReturnType<typeof evaluate> | null = null;
		for (let k = 0; k < 40; k++, step /= 2) {
			const th = theta.map((v, i) => v + step * dir[i]);
			const c = evaluate(th, false);
			if (c.ll >= cur.ll) {
				next = th;
				cand = c;
				break;
			}
		}
		if (!next || !cand) {
			converged = true;
			break;
		}
		const gain = cand.ll - cur.ll;
		theta.set(next);
		cur = evaluate(theta, true);
		if (gain <= tol * Math.abs(cur.ll)) {
			converged = true;
			it++;
			break;
		}
	}

	const params: DixonColesParams = {
		rho: theta[0],
		leagues: Object.fromEntries(leagues.map((k, l) => [k, { intercept: theta[1 + l], homeAdvantage: theta[1 + L + l] }])),
		teams: Object.fromEntries(
			teams.map((t, i) => [String(t), { attack: theta[1 + 2 * L + i], defence: theta[1 + 2 * L + T + i] }])
		)
	};
	return { params, logLoss: -(cur.raw ?? cur.ll) / sumW, matches: rows.length, iterations: it, converged };
};

export interface DixonColesPrediction {
	lambdaHome: number;
	lambdaAway: number;
	probabilities: MarketProbabilities;
}

/** Predikció; ismeretlen csapat: att = def = 0 (ligaátlag), ismeretlen liga: a ligák átlaga. */
export const dixonColesPredict = (
	params: DixonColesParams,
	homeTeamId: number,
	awayTeamId: number,
	league = '_'
): DixonColesPrediction => {
	const ls = Object.values(params.leagues);
	const lg = params.leagues[league] ?? {
		intercept: ls.reduce((s, x) => s + x.intercept, 0) / Math.max(1, ls.length),
		homeAdvantage: ls.reduce((s, x) => s + x.homeAdvantage, 0) / Math.max(1, ls.length)
	};
	const zero = { attack: 0, defence: 0 };
	const h = params.teams[String(homeTeamId)] ?? zero;
	const a = params.teams[String(awayTeamId)] ?? zero;
	const lambdaHome = Math.exp(lg.intercept + lg.homeAdvantage + h.attack + a.defence);
	const lambdaAway = Math.exp(lg.intercept + a.attack + h.defence);
	return { lambdaHome, lambdaAway, probabilities: marketProbabilities(scoreMatrix(lambdaHome, lambdaAway, params.rho)) };
};

export interface DixonColesWalkForwardOptions extends Omit<DixonColesFitOptions, 'asOf' | 'init'> {
	/** Újraillesztés legalább ennyi naponként (az első értékelt meccs előtt mindig). */
	refitDays?: number;
}

/**
 * Walk-forward predikció: a `predict` szerinti meccsekre, kezdés szerint léptetve, mindig csak a kezdés előtti meccsekből
 * illesztett paraméterekkel (az azonos kezdésű meccsek egymást nem látják). Meleg indítás az előző illesztésből.
 */
export const dixonColesWalkForward = <M extends DixonColesMatch>(
	matches: readonly M[],
	predict: (m: M) => boolean,
	options: DixonColesWalkForwardOptions = {}
): Map<number, DixonColesPrediction> => {
	const refitMs = (options.refitDays ?? 7) * DAY_MS;
	const sorted = [...matches].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
	const out = new Map<number, DixonColesPrediction>();
	let fit: DixonColesFit | null = null;
	let fittedAt = -Infinity;
	for (const m of sorted) {
		if (!predict(m)) continue;
		const t = Date.parse(m.kickoff);
		if (!fit || t - fittedAt >= refitMs) {
			fit = fitDixonColes(matches, { ...options, asOf: m.kickoff, init: fit?.params });
			fittedAt = t;
		}
		out.set(m.id, dixonColesPredict(fit.params, m.homeTeamId, m.awayTeamId, leagueOf(m)));
	}
	return out;
};
