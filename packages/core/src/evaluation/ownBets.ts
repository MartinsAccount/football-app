import type { EvaluationRecord } from './dbSummary';
import {
	isVoidStatus,
	outcome1x2,
	overUnderOutcome,
	settleBet,
	summarizeBets,
	type BetOutcome,
	type BetSummary
} from './evaluation';

/**
 * A tulajdonos ténylegesen megtett tippjei (ROADMAP 5.6, PRD 6/3. pont): „saját” ROI a modell ROI-ja mellett. Tiszta
 * függvények. Az elszámolás elsősorban a kiértékelő job (`evaluation`) kimenetét veszi át, ha a tipp egy predikcióhoz
 * kapcsolódik és ugyanarra a kimenetre szól; különben a meccs eredményéből számol, ugyanazzal a szabállyal, mint a job
 * (rendes játékidő, PST/CANC/ABD → void, egész vonalon pontos egyezés → void).
 */

/** Elszámolható piacok: API-Football piac-id → kimenetek (a kiértékelő job sorrendjében). */
export const OWN_BET_MARKETS: Readonly<Record<number, { selections: readonly string[]; needsLine: boolean }>> = {
	1: { selections: ['Home', 'Draw', 'Away'], needsLine: false },
	5: { selections: ['Over', 'Under'], needsLine: true }
};

const FINISHED = ['FT', 'AET', 'PEN'];

/** Egy rögzített fogadás a DB-ből (a `placed_bet` sor + a meccs és a kapcsolt predikció/kiértékelés adatai). */
export interface PlacedBetRecord {
	id: number;
	fixtureId: number;
	marketId: number;
	selection: string;
	line: number | null;
	/** Pl. „Tippmix”. */
	bookmakerLabel: string | null;
	oddTaken: number;
	stake: number;
	placedAt: string;
	note: string | null;
	predictionId: number | null;
	/** A kapcsolt predikció futásának modellverziója. */
	modelVersion: string | null;
	/** A kapcsolt predikció legjobb oddsa (`best_odd`): a modell ROI-ja ezen a tippen. */
	modelOdd: number | null;
	/** A kapcsolt predikció `evaluation` kimenete – csak ha a tipp ugyanarra a kimenetre/vonalra szól. */
	evaluationOutcome: BetOutcome | null;
	/** A kiértékelés záró oddsa (CLV). */
	closingOdd: number | null;
	/** A meccs státusza és rendes játékidős eredménye (`ft_*`, ennek hiányában `goals_*`). */
	status: string;
	homeGoals: number | null;
	awayGoals: number | null;
}

/** Elszámolt fogadás: `outcome === null` = még függő (vagy nem elszámolható piac), ilyenkor `profit` is `null`. */
export interface SettledPlacedBet extends PlacedBetRecord {
	outcome: BetOutcome | null;
	/** Tétsúlyos profit pénzben: nyerés `stake·(odd−1)`, vesztés `−stake`, void 0. */
	profit: number | null;
}

/** A tipp kimenete; `null` = függő (nem befejezett meccs) vagy nem elszámolható piac/kimenet. */
export function placedBetOutcome(r: PlacedBetRecord): BetOutcome | null {
	if (r.evaluationOutcome) return r.evaluationOutcome;
	const market = OWN_BET_MARKETS[r.marketId];
	const k = market?.selections.indexOf(r.selection) ?? -1;
	if (!market || k < 0 || market.needsLine !== (r.line !== null)) return null;
	if (isVoidStatus(r.status)) return 'void';
	if (!FINISHED.includes(r.status) || r.homeGoals === null || r.awayGoals === null) return null;
	const result =
		r.marketId === 1 ? outcome1x2(r.homeGoals, r.awayGoals) : overUnderOutcome(r.homeGoals + r.awayGoals, r.line as number);
	return settleBet(k, result);
}

/** Tétsúlyos profit pénzben. */
export const stakeProfit = (outcome: BetOutcome, odd: number, stake: number): number =>
	outcome === 'win' ? stake * (odd - 1) : outcome === 'loss' ? -stake : 0;

export const settlePlacedBet = (r: PlacedBetRecord): SettledPlacedBet => {
	const outcome = placedBetOutcome(r);
	return { ...r, outcome, profit: outcome === null ? null : stakeProfit(outcome, r.oddTaken, r.stake) };
};

export interface OwnStakeSummary {
	/** Összes rögzített tipp. */
	n: number;
	/** Még nem elszámolt (függő vagy nem elszámolható) tippek. */
	pending: number;
	wins: number;
	losses: number;
	voids: number;
	/** A nyertes/vesztes tippek tétje (a void nem számít). */
	staked: number;
	/** Tétsúlyos profit pénzben. */
	profit: number;
	/** `profit / staked`; elszámolt tipp nélkül `null`. */
	roi: number | null;
	hitRate: number | null;
}

export interface OwnBetsSummary {
	/** Saját eredmény a ténylegesen megtett tétekkel és oddsokkal. */
	own: OwnStakeSummary;
	/** Saját flat (1 egységes) ROI a megtett oddsokkal – összevethető a modell flat ROI-jával. */
	ownFlat: BetSummary;
	/** A modell flat ROI-ja UGYANEZEKEN a (predikcióhoz kapcsolt, elszámolt) tippeken, a predikció `best_odd`-jával. */
	modelSameBets: BetSummary;
	/** A modell összes kiértékelt ajánlása (`is_recommendation`), flat. */
	model: BetSummary;
}

/** Saját vs. modell ROI. `evaluations` = a `loadEvaluationRecords` sorai (a modell-oldalhoz). */
export function summarizeOwnBets(placed: readonly PlacedBetRecord[], evaluations: readonly EvaluationRecord[]): OwnBetsSummary {
	const settled = placed.map(settlePlacedBet);
	const done = settled.filter((b): b is SettledPlacedBet & { outcome: BetOutcome } => b.outcome !== null);
	const decided = done.filter((b) => b.outcome !== 'void');
	const wins = decided.filter((b) => b.outcome === 'win').length;
	const staked = decided.reduce((s, b) => s + b.stake, 0);
	const profit = decided.reduce((s, b) => s + (b.profit ?? 0), 0);
	return {
		own: {
			n: placed.length,
			pending: placed.length - done.length,
			wins,
			losses: decided.length - wins,
			voids: done.length - decided.length,
			staked,
			profit,
			roi: staked > 0 ? profit / staked : null,
			hitRate: decided.length ? wins / decided.length : null
		},
		ownFlat: summarizeBets(done.map((b) => ({ odds: b.oddTaken, outcome: b.outcome, closingOdds: b.closingOdd }))),
		modelSameBets: summarizeBets(
			done.flatMap((b) =>
				b.predictionId !== null && b.modelOdd !== null && b.modelOdd > 1 ? [{ odds: b.modelOdd, outcome: b.outcome }] : []
			)
		),
		model: summarizeBets(
			evaluations
				.filter((r) => r.isRecommendation && r.odd > 1)
				.map((r) => ({ odds: r.odd, outcome: r.outcome, p: r.pModel, closingOdds: r.closingOdd }))
		)
	};
}
