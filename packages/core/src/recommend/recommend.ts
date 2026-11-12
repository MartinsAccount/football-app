// Ajánlási szabály (strategy.md §4.5 és §5, ROADMAP 5.4): piaci kombinálás, EV a legjobb oddson, szűrők, meccsenként max. 1
// ajánlás, adatminőségi figyelmeztetések és bizonyosság. Tiszta függvények.
import { formatAge, formatPercent } from '../format/format';
import { bestOdds, consensusFairProbabilities } from '../model/market';
import { DEFAULT_EV_THRESHOLD } from '../odds/value';

export interface RecommendationRules {
	/** `p_végső · odds − 1 ≥ küszöb`. */
	evThreshold: number;
	/** `p_végső − p_piac ≥ min. eltérés` (valószínűségben, 0,02 = 2 pp). */
	minEdge: number;
	minOdds: number;
	maxOdds: number;
	minBookmakers: number;
	/** A modell súlya a logit-térbeli kombinálásban (0 = csak piac, 1 = csak modell). */
	blendWeight: number;
}

/** strategy.md §5 kezdőértékei; a `blendWeight` illesztés előtti becslés (DECISIONS.md). */
export const DEFAULT_RECOMMENDATION_RULES: RecommendationRules = {
	evThreshold: DEFAULT_EV_THRESHOLD,
	minEdge: 0.02,
	minOdds: 1.5,
	maxOdds: 4,
	minBookmakers: 5,
	blendWeight: 0.25
};

const clampP = (p: number) => Math.min(1 - 1e-9, Math.max(1e-9, p));
const logit = (p: number) => Math.log(clampP(p) / (1 - clampP(p)));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/** `logit(p) = w · logit(p_modell) + (1 − w) · logit(p_piac)` kimenetenként, utána renormálva (Σp = 1). */
export const blendProbabilities = (pModel: readonly number[], pMarket: readonly number[], w: number): number[] => {
	if (pModel.length !== pMarket.length) throw new Error('A modell és a piac kimenetszáma eltér.');
	if (!(w >= 0 && w <= 1)) throw new Error(`A súly a [0, 1] tartományba essen: ${w}`);
	const raw = pModel.map((p, i) => sigmoid(w * logit(p) + (1 - w) * logit(pMarket[i])));
	const sum = raw.reduce((s, p) => s + p, 0);
	return raw.map((p) => p / sum);
};

export interface BookmakerOdds {
	bookmaker: string;
	/** Kimenet-sorrendben, mint a `pModel`. */
	odds: readonly number[];
}

export interface MarketEvaluation {
	outcomeIndex: number;
	/** Nyers modell-valószínűség. */
	pModelRaw: number;
	/** Piaccal kombinált („Szerintünk”). */
	pFinal: number;
	/** Konszenzus fair (margin-mentes) piaci valószínűség. */
	pMarket: number;
	odds: number;
	bookmaker: string;
	bookmakers: number;
	ev: number;
	/** `p_végső − p_piac`. */
	edge: number;
	/** `(1 + küszöb) / p_végső`. */
	minOdds: number;
	accepted: boolean;
	/** Magyar elutasítási okok (üres, ha elfogadva). */
	rejections: string[];
}

/**
 * Egy piac értékelése: a legnagyobb EV-jű kimenet a legjobb elérhető oddson, és hogy átmegy-e a §5 szűrőin.
 * `null`, ha nincs érvényes odds.
 */
export const evaluateMarket = (
	pModel: readonly number[],
	oddsByBookmaker: readonly BookmakerOdds[],
	rules: RecommendationRules = DEFAULT_RECOMMENDATION_RULES,
	blocked = false
): MarketEvaluation | null => {
	const rows = oddsByBookmaker.filter((b) => b.odds.length === pModel.length && b.odds.every((o) => Number.isFinite(o) && o > 1));
	if (rows.length === 0) return null;
	const pMarket = consensusFairProbabilities(rows.map((r) => r.odds));
	const pFinal = blendProbabilities(pModel, pMarket, rules.blendWeight);
	const best = bestOdds(rows.map((r) => r.odds));
	let i = 0;
	for (let k = 1; k < pFinal.length; k++) if (pFinal[k] * best[k].odds > pFinal[i] * best[i].odds) i = k;
	const odds = best[i].odds;
	const ev = pFinal[i] * odds - 1;
	const edge = pFinal[i] - pMarket[i];
	const rejections: string[] = [];
	if (ev < rules.evThreshold) rejections.push('EV a küszöb alatt');
	if (edge < rules.minEdge) rejections.push('kicsi eltérés a piactól');
	if (odds < rules.minOdds || odds > rules.maxOdds) rejections.push('odds a tartományon kívül');
	if (rows.length < rules.minBookmakers) rejections.push('kevés iroda');
	if (blocked) rejections.push('blokkoló adatminőségi figyelmeztetés');
	return {
		outcomeIndex: i,
		pModelRaw: pModel[i],
		pFinal: pFinal[i],
		pMarket: pMarket[i],
		odds,
		bookmaker: rows[best[i].bookmakerIndex].bookmaker,
		bookmakers: rows.length,
		ev,
		edge,
		minOdds: (1 + rules.evThreshold) / pFinal[i],
		accepted: rejections.length === 0,
		rejections
	};
};

/** Meccsenként legfeljebb 1 ajánlás: az elfogadottak közül a legnagyobb EV-jű (a piacok korreláltak). */
export const pickRecommendation = <T extends Pick<MarketEvaluation, 'accepted' | 'ev'>>(
	evaluations: readonly (T | null)[]
): T | null => evaluations.reduce<T | null>((best, e) => (e && e.accepted && (!best || e.ev > best.ev) ? e : best), null);

export interface DataQualityInput {
	oddsAgeMs: number;
	/** A szezonban lejátszott meccsek száma. */
	homeMatches: number;
	awayMatches: number;
	h2hMatches: number;
}

export interface DataWarning {
	text: string;
	blocking: boolean;
}

const HOUR = 3_600_000;

/** strategy.md §5: odds > 36 h és < 4 szezonbeli meccs blokkol; 12 h feletti odds és < 4 H2H csak figyelmeztet. */
export const dataWarnings = (input: DataQualityInput): DataWarning[] => {
	const out: DataWarning[] = [];
	if (input.oddsAgeMs > 12 * HOUR)
		out.push({ text: `Az odds ${formatAge(input.oddsAgeMs)}`, blocking: input.oddsAgeMs > 36 * HOUR });
	const fewest = Math.min(input.homeMatches, input.awayMatches);
	if (fewest < 4) out.push({ text: `Kevés idei meccs (${fewest}), a forma bizonytalan.`, blocking: true });
	if (input.h2hMatches < 4) out.push({ text: 'Kevés egymás elleni meccs, a H2H súlya kicsi.', blocking: false });
	return out;
};

export type ConfidenceLevel = 'low' | 'medium' | 'high';

/** Bizonyosság: a modell–piac eltérés, a mintaméret és az odds frissessége (strategy.md §5). */
export const confidenceLevel = (input: { edge: number; seasonMatches: number; oddsAgeMs: number }): ConfidenceLevel => {
	if (input.edge < 0.03 || input.seasonMatches < 8 || input.oddsAgeMs > 24 * HOUR) return 'low';
	if (input.edge >= 0.05 && input.seasonMatches >= 15 && input.oddsAgeMs <= 12 * HOUR) return 'high';
	return 'medium';
};

/** Az indoklás záró sora: mennyit számít a piaci kombinálás. */
export const blendReason = (pModelRaw: number, pFinal: number, w: number): string =>
	`A modell ${formatPercent(pModelRaw)}-ot mond; a piaccal ${Math.round(w * 100)}%-os súllyal kombinálva ${formatPercent(
		pFinal
	)}.`;
