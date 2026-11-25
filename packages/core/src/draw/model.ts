// Döntetlen-modell `draw-logreg@1.0.0` (D1, ROADMAP 12.6): L2-logreg a piaci logit körül.
//   logit p(X) = β0 + β1 · logit(p_piac) + Σ β_j · tényező_j
// A konstans és a piaci oszlop nincs büntetve, a tényezők igen (λ → ∞: a modell = kalibrált piac). Kimenet: p(X) + nevesített,
// magyar magyarázó tényezők (log-odds hozzájárulás). Tiszta függvények, I/O nincs.
import { fitLogisticRegression, dot, sigmoid } from '../profile/logreg';
import { DRAW_FACTOR_KEYS, DRAW_VECTOR_LENGTH, drawFeatureVector, type DrawFeatureKey, type DrawFeatures } from './features';

export const DRAW_MODEL_VERSION = 'draw-logreg@1.0.0';

export interface DrawModel {
	version: string;
	lambda: number;
	/** [konstans, piac, ...DRAW_FACTOR_KEYS]. */
	weights: number[];
	trainSize: number;
	converged: boolean;
}

export const fitDrawModel = (
	samples: readonly { features: DrawFeatures; isDraw: 0 | 1 }[],
	opts: { lambda?: number } = {}
): DrawModel => {
	const lambda = opts.lambda ?? 10;
	const fit = fitLogisticRegression(
		samples.map((s) => drawFeatureVector(s.features)),
		samples.map((s) => s.isDraw),
		{ lambda, penalize: Array.from({ length: DRAW_VECTOR_LENGTH }, (_, j) => j >= 2) }
	);
	return { version: DRAW_MODEL_VERSION, lambda, weights: fit.weights, trainSize: samples.length, converged: fit.converged };
};

export interface DrawFactor {
	key: Exclude<DrawFeatureKey, 'market'>;
	label: string;
	/** Rövid, magyar indoklás a nyers értékkel. */
	detail: string;
	/** Hozzájárulás log-oddsban (+ = növeli a döntetlen esélyét). */
	contribution: number;
}

export interface DrawPrediction {
	pDraw: number;
	pMarket: number;
	/** Csak a nem nulla hozzájárulású tényezők, |hozzájárulás| szerint csökkenőben. */
	factors: DrawFactor[];
}

const LABEL: Record<DrawFactor['key'], string> = {
	model: 'Gólmodell (Dixon–Coles)',
	elo: 'Erőkülönbség (Elo)',
	goals: 'Várható gólszám',
	teams: 'A csapatok döntetlen-hajlama',
	league: 'A liga döntetlen-aránya'
};

const pct = (p: number) => `${(p * 100).toFixed(1).replace('.', ',')}%`;
const dec = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

const detailOf = (key: DrawFactor['key'], f: DrawFeatures): string => {
	switch (key) {
		case 'model':
			return `a gólmodell ${pct(f.pModel)} döntetlent ad (piac: ${pct(f.pMarket)})`;
		case 'elo':
			return f.eloGap < 50
				? `kiegyenlített párharc (Elo-különbség ${Math.round(f.eloGap)})`
				: `erőkülönbség: ${Math.round(f.eloGap)} Elo-pont`;
		case 'goals':
			return `várható gólszám ${dec(f.expectedGoals, 2)}${f.expectedGoals < 2.5 ? ' (kevés gól)' : ''}`;
		case 'teams':
			return `a két csapat döntetlen-aránya ${pct(f.teamDrawRate)} (liga: ${pct(f.leagueDrawRate)})`;
		case 'league':
			return `a liga döntetlen-aránya ${pct(f.leagueDrawRate)}`;
	}
};

export const predictDraw = (model: DrawModel, f: DrawFeatures): DrawPrediction => {
	const x = drawFeatureVector(f);
	const factors = DRAW_FACTOR_KEYS.map((key, i) => ({
		key,
		label: LABEL[key],
		detail: detailOf(key, f),
		contribution: model.weights[2 + i] * x[2 + i]
	}))
		.filter((c) => Math.abs(c.contribution) > 1e-9)
		.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || a.key.localeCompare(b.key));
	return { pDraw: sigmoid(dot(x, model.weights)), pMarket: f.pMarket, factors };
};

// --- Értékelés (bináris X) ---

export interface DrawScore {
	n: number;
	logLoss: number | null;
	brier: number | null;
	/** Átlagos p(X) és tényleges döntetlen-arány (kalibráció). */
	meanP: number | null;
	drawRate: number | null;
}

export const drawScores = (preds: readonly { p: number; isDraw: 0 | 1 }[]): DrawScore => {
	const n = preds.length;
	if (n === 0) return { n, logLoss: null, brier: null, meanP: null, drawRate: null };
	let ll = 0;
	let br = 0;
	let mp = 0;
	let dr = 0;
	for (const { p, isDraw } of preds) {
		const q = Math.min(1 - 1e-12, Math.max(1e-12, p));
		ll -= isDraw ? Math.log(q) : Math.log(1 - q);
		br += (p - isDraw) ** 2;
		mp += p;
		dr += isDraw;
	}
	return { n, logLoss: ll / n, brier: br / n, meanP: mp / n, drawRate: dr / n };
};

/** A felső `share` hányad küszöbe (p szerint csökkenő sorrendben a ⌈share·n⌉-edik érték); üres listára `Infinity`. */
export const topShareCutoff = (ps: readonly number[], share: number): number => {
	if (ps.length === 0) return Infinity;
	const sorted = [...ps].sort((a, b) => b - a);
	return sorted[Math.min(sorted.length, Math.max(1, Math.ceil(share * sorted.length))) - 1];
};
