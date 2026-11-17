// Tulajdonosi profil (ROADMAP 12.1): „megtenné-e ezt a tippet” logreg a kvíz-válaszokon, szöveges profil, utánzás, keresztvalidáció.
// Minta-képzés: minden kérdésnél minden elérhető opció egy sor; a választott = 1, a többi = 0; skip → mind 0.
import { dot, fitLogisticRegression, sigmoid } from './logreg';
import { favouritePick, PROFILE_FEATURES, profileFeatures } from './features';
import { availablePicks, type ProfileSample, type QuizPick, type QuizQuestion } from './types';

export const OWNER_PROFILE_VERSION = 'owner-logreg@1.0.0';
export const MIN_PROFILE_SAMPLES = 20;
export const DEFAULT_PROFILE_LAMBDA = 1;

export type OwnerProfileStatus = 'ok' | 'kevés adat';

export interface ProfileWeight {
	key: string;
	label: string;
	weight: number;
	/** |súly| × a jellemző szórása a tanítóhalmazon – skálafüggetlen fontosság. */
	importance: number;
}

export interface OwnerProfile {
	version: string;
	status: OwnerProfileStatus;
	/** Nem-skip válaszok száma. */
	answered: number;
	skipped: number;
	/** `PROFILE_FEATURES` sorrendben; „kevés adat” esetén üres. */
	weights: ProfileWeight[];
	/** A 3 legfontosabb tulajdonság szövegesen („Kedveled a …”). */
	traits: string[];
}

export interface ImitationFactor {
	label: string;
	/** Súly × jellemzőérték (log-odds hozzájárulás). */
	contribution: number;
}

export interface ImitatedPick {
	pick: QuizPick;
	/** A modell szerinti valószínűség, hogy ezt a tippet megtennéd. */
	probability: number;
	factors: ImitationFactor[];
}

const toDesign = (samples: readonly ProfileSample[]) => {
	const X: number[][] = [];
	const y: number[] = [];
	for (const s of samples) {
		if (s.answer.fixtureId !== s.question.fixtureId)
			throw new Error(`A válasz (${s.answer.fixtureId}) nem a kérdéshez (${s.question.fixtureId}) tartozik.`);
		for (const p of availablePicks(s.question)) {
			X.push(profileFeatures(s.question, p));
			y.push(s.answer.pick === p ? 1 : 0);
		}
	}
	return { X, y };
};

const stdDevs = (X: readonly (readonly number[])[]): number[] =>
	PROFILE_FEATURES.map((_, j) => {
		const mean = X.reduce((s, x) => s + x[j], 0) / X.length;
		return Math.sqrt(X.reduce((s, x) => s + (x[j] - mean) ** 2, 0) / X.length);
	});

const fitWeights = (samples: readonly ProfileSample[], lambda: number): ProfileWeight[] => {
	const { X, y } = toDesign(samples);
	const { weights } = fitLogisticRegression(X, y, { lambda });
	const sd = stdDevs(X);
	return PROFILE_FEATURES.map((f, j) => ({
		key: f.key,
		label: f.label,
		weight: weights[j],
		importance: Math.abs(weights[j]) * sd[j]
	}));
};

const traitText = (w: ProfileWeight): string => {
	const def = PROFILE_FEATURES.find((f) => f.key === w.key)!;
	return `${w.weight >= 0 ? 'Kedveled' : 'Kerülöd'} ${def.phrase}`;
};

export const buildOwnerProfile = (samples: readonly ProfileSample[], opts: { lambda?: number } = {}): OwnerProfile => {
	const answered = samples.filter((s) => s.answer.pick !== 'skip').length;
	const skipped = samples.length - answered;
	const base = { version: OWNER_PROFILE_VERSION, answered, skipped };
	if (answered < MIN_PROFILE_SAMPLES) return { ...base, status: 'kevés adat', weights: [], traits: [] };
	const weights = fitWeights(samples, opts.lambda ?? DEFAULT_PROFILE_LAMBDA);
	// Előbb a „Kedveled” (pozitív súlyú) tulajdonságok: a sok 0-címke miatt a negatív súlyok többsége csak az alacsony
	// alaparányt tükrözi. Ha 3-nál kevesebb pozitív van, a legerősebb „Kerülöd” egészíti ki.
	const ranked = [...weights].filter((w) => w.importance > 0.05).sort((a, b) => b.importance - a.importance);
	const traits = [...ranked.filter((w) => w.weight > 0), ...ranked.filter((w) => w.weight < 0)].slice(0, 3).map(traitText);
	return { ...base, status: 'ok', weights, traits };
};

const scoreWith = (weights: readonly ProfileWeight[], q: QuizQuestion): ImitatedPick => {
	const w = weights.map((x) => x.weight);
	let best: ImitatedPick | null = null;
	for (const p of availablePicks(q)) {
		const x = profileFeatures(q, p);
		const probability = sigmoid(dot(x, w));
		if (!best || probability > best.probability) {
			const factors = weights
				.map((wt, j) => ({ label: wt.label, contribution: wt.weight * x[j] }))
				.filter((f) => Math.abs(f.contribution) > 1e-6)
				.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
				.slice(0, 3);
			best = { pick: p, probability, factors };
		}
	}
	return best!;
};

/** A profil szerint legvalószínűbb tipp; „kevés adat” profilnál `null`. */
export const imitatePick = (profile: OwnerProfile, question: QuizQuestion): ImitatedPick | null =>
	profile.status === 'ok' ? scoreWith(profile.weights, question) : null;

export interface ProfileCrossValidation {
	status: OwnerProfileStatus;
	folds: number;
	/** Kiértékelt (nem-skip) válaszok száma. */
	evaluated: number;
	/** Egyezési arány: utánzott tipp = tényleges tipp. */
	agreement: number;
	/** „Mindig a favorit” (legkisebb 1X2 odds) egyezési aránya ugyanezeken. */
	baselineAgreement: number;
}

/** k-szoros keresztvalidáció (determinisztikus hajtogatás: index mod k); a skip-ek csak tanítanak. */
export const crossValidateProfile = (
	samples: readonly ProfileSample[],
	opts: { folds?: number; lambda?: number } = {}
): ProfileCrossValidation => {
	const folds = opts.folds ?? 5;
	const lambda = opts.lambda ?? DEFAULT_PROFILE_LAMBDA;
	const answered = samples.filter((s) => s.answer.pick !== 'skip').length;
	if (answered < MIN_PROFILE_SAMPLES) return { status: 'kevés adat', folds, evaluated: 0, agreement: 0, baselineAgreement: 0 };
	let evaluated = 0;
	let hits = 0;
	let baseHits = 0;
	for (let f = 0; f < folds; f++) {
		const train = samples.filter((_, i) => i % folds !== f);
		const test = samples.filter((s, i) => i % folds === f && s.answer.pick !== 'skip');
		if (test.length === 0) continue;
		const weights = fitWeights(train, lambda);
		for (const s of test) {
			evaluated++;
			if (scoreWith(weights, s.question).pick === s.answer.pick) hits++;
			if (favouritePick(s.question) === s.answer.pick) baseHits++;
		}
	}
	return { status: 'ok', folds, evaluated, agreement: hits / evaluated, baselineAgreement: baseHits / evaluated };
};
