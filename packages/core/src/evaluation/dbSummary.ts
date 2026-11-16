import { calibrationBuckets, summarizeBets, type BetOutcome, type BetSummary, type CalibrationBucket } from './evaluation';

/**
 * A DB-ben tárolt kiértékelések összesítése (ROADMAP 5.5, I17): a `prediction` × `evaluation` sorokból a dashboard számai.
 * FONTOS (DECISIONS 5.3/I15): a Brier és a log-loss a piac teljes eloszlására számol, és egy futás × meccs × piac × vonal
 * csoport minden sorában ugyanaz az érték áll → itt csoportonként csak EGY sor számít.
 */

/** Egy kiértékelt predikció (a `loadEvaluationRecords` sora). */
export interface EvaluationRecord {
	runId: number;
	fixtureId: number;
	marketId: number;
	selection: string;
	line: number | null;
	modelVersion: string;
	isRecommendation: boolean;
	pModel: number;
	/** A predikció legjobb oddsa (`best_odd`). */
	odd: number;
	outcome: BetOutcome;
	brier: number | null;
	logLoss: number | null;
	closingOdd: number | null;
}

export interface ProbabilityScore {
	/** Csoportok (futás × meccs × piac × vonal) száma, amelyeknek van Brier-értéke. */
	groups: number;
	meanBrier: number | null;
	meanLogLoss: number | null;
}

export interface MarketEvaluationSummary extends ProbabilityScore {
	marketId: number;
	/** Csak az ajánlott tippek. */
	bets: BetSummary;
}

export interface EvaluationSummary {
	/** A szűrés előtt elérhető modellverziók (rendezve). */
	modelVersions: string[];
	/** Az alkalmazott szűrő; `null` = minden verzió. */
	modelVersion: string | null;
	/** Kiértékelt predikció-sorok száma (a szűrés után). */
	records: number;
	/** Valószínűségi pontosság, csoportonként egy sorral. */
	predictions: ProbabilityScore;
	/** Kalibráció minden nem-void predikción (p_model vs. bekövetkezés). */
	calibration: CalibrationBucket[];
	/** Az ajánlott tippek (is_recommendation) összesítése: találat vs. várt, flat ROI, CLV. */
	bets: BetSummary;
	/** Piaconként (market_id szerint rendezve). */
	markets: MarketEvaluationSummary[];
}

const mean = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** A Brier/log-loss csoport kulcsa: futás × meccs × piac × vonal. */
export const evaluationGroupKey = (r: Pick<EvaluationRecord, 'runId' | 'fixtureId' | 'marketId' | 'line'>): string =>
	`${r.runId}:${r.fixtureId}:${r.marketId}:${r.line === null ? '' : r.line}`;

/** Átlag Brier és log-loss csoportonként EGY sorral (az első nem-null értékkel). */
export function scoreProbabilities(records: readonly EvaluationRecord[]): ProbabilityScore {
	const groups = new Map<string, { brier: number | null; logLoss: number | null }>();
	for (const r of records) {
		const k = evaluationGroupKey(r);
		const g = groups.get(k);
		if (!g) groups.set(k, { brier: r.brier, logLoss: r.logLoss });
		else {
			g.brier ??= r.brier;
			g.logLoss ??= r.logLoss;
		}
	}
	const vals = [...groups.values()];
	const briers = vals.flatMap((g) => (g.brier === null ? [] : [g.brier]));
	return {
		groups: briers.length,
		meanBrier: mean(briers),
		meanLogLoss: mean(vals.flatMap((g) => (g.logLoss === null ? [] : [g.logLoss])))
	};
}

const betsOf = (records: readonly EvaluationRecord[]): BetSummary =>
	summarizeBets(
		records
			.filter((r) => r.isRecommendation)
			.map((r) => ({ odds: r.odd, outcome: r.outcome, p: r.pModel, closingOdds: r.closingOdd }))
	);

/** A dashboard összesítése; `modelVersion` megadásával csak az adott verzió sorai számítanak. */
export function summarizeEvaluations(
	records: readonly EvaluationRecord[],
	opts: { modelVersion?: string | null } = {}
): EvaluationSummary {
	const modelVersion = opts.modelVersion || null;
	const rows = modelVersion === null ? records : records.filter((r) => r.modelVersion === modelVersion);
	const marketIds = [...new Set(rows.map((r) => r.marketId))].sort((a, b) => a - b);
	return {
		modelVersions: [...new Set(records.map((r) => r.modelVersion))].sort(),
		modelVersion,
		records: rows.length,
		predictions: scoreProbabilities(rows),
		calibration: calibrationBuckets(
			rows.filter((r) => r.outcome !== 'void').map((r) => ({ p: r.pModel, hit: r.outcome === 'win' }))
		),
		bets: betsOf(rows),
		markets: marketIds.map((marketId) => {
			const m = rows.filter((r) => r.marketId === marketId);
			return { marketId, ...scoreProbabilities(m), bets: betsOf(m) };
		})
	};
}
