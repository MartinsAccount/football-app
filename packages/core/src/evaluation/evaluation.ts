// Kiértékelés (strategy.md §7.2–7.3, ROADMAP 5.3): kimenetel, flat profit, Brier, log-loss, CLV, kalibráció. Tiszta függvények.
// A kimenetek sorrendje a piacé (1X2: [Home, Draw, Away]; O/U: [Over, Under]); `outcomeIndex` erre mutat.

export type BetOutcome = 'win' | 'loss' | 'void';

/** Elmaradt, törölt vagy félbeszakadt meccs → a tipp void (API-Football státuszkódok). */
export const VOID_STATUSES: readonly string[] = ['PST', 'CANC', 'ABD'];

export const isVoidStatus = (status: string): boolean => VOID_STATUSES.includes(status);

/** 1X2 kimenet indexe a rendes játékidő eredményéből: 0 = hazai, 1 = döntetlen, 2 = vendég. */
export const outcome1x2 = (homeGoals: number, awayGoals: number): 0 | 1 | 2 =>
	homeGoals > awayGoals ? 0 : homeGoals === awayGoals ? 1 : 2;

/** O/U kimenet: 0 = Over, 1 = Under; egész vonalon pontos egyezésnél `null` (push → void). */
export const overUnderOutcome = (totalGoals: number, line: number): 0 | 1 | null =>
	totalGoals > line ? 0 : totalGoals < line ? 1 : null;

/** BTTS kimenet: 0 = Igen (mindkét csapat szerzett gólt), 1 = Nem. */
export const bttsOutcome = (homeGoals: number, awayGoals: number): 0 | 1 => (homeGoals > 0 && awayGoals > 0 ? 0 : 1);

/** API-Football piac-id-k, amelyeket a kiértékelés elszámol (kimenet-sorrend: 1X2 [Home, Draw, Away], O/U [Over, Under], BTTS [Yes, No]). */
export const SETTLED_MARKET_IDS = { h2h: 1, overUnder: 5, btts: 8 } as const;

/**
 * Egy piac eredmény-indexe a rendes játékidő eredményéből; `null` = push (egész O/U-vonal pontos egyezése), `undefined` = nem
 * elszámolható piac vagy hiányzó/fölösleges vonal.
 */
export const marketResultIndex = (
	marketId: number,
	line: number | null,
	homeGoals: number,
	awayGoals: number
): number | null | undefined => {
	if (marketId === SETTLED_MARKET_IDS.h2h && line === null) return outcome1x2(homeGoals, awayGoals);
	if (marketId === SETTLED_MARKET_IDS.overUnder && line !== null) return overUnderOutcome(homeGoals + awayGoals, line);
	if (marketId === SETTLED_MARKET_IDS.btts && line === null) return bttsOutcome(homeGoals, awayGoals);
	return undefined;
};

/** Tipp elszámolása: `resultIndex === null` (void meccs vagy push) → void. */
export const settleBet = (selectionIndex: number, resultIndex: number | null): BetOutcome =>
	resultIndex === null ? 'void' : selectionIndex === resultIndex ? 'win' : 'loss';

/** Flat (1 egységes) profit: win → `odd − 1`, loss → `−1`, void → 0. */
export const flatProfit = (outcome: BetOutcome, odds: number): number => {
	if (!(Number.isFinite(odds) && odds > 1)) throw new Error(`Érvénytelen odds: ${odds}`);
	return outcome === 'win' ? odds - 1 : outcome === 'loss' ? -1 : 0;
};

const assertDistribution = (probabilities: readonly number[], outcomeIndex: number) => {
	if (probabilities.length < 2) throw new Error('Legalább 2 kimenet kell.');
	if (!Number.isInteger(outcomeIndex) || outcomeIndex < 0 || outcomeIndex >= probabilities.length)
		throw new Error(`Érvénytelen kimenet-index: ${outcomeIndex}`);
	for (const p of probabilities) if (!(p >= 0 && p <= 1)) throw new Error(`Érvénytelen valószínűség: ${p}`);
};

/** Brier-pontszám (többkimenetes): Σ_k (p_k − y_k)². 0 = tökéletes, 2 = legrosszabb. */
export const brierScore = (probabilities: readonly number[], outcomeIndex: number): number => {
	assertDistribution(probabilities, outcomeIndex);
	return probabilities.reduce((s, p, k) => s + (p - (k === outcomeIndex ? 1 : 0)) ** 2, 0);
};

/** A 0 valószínűség végtelen log-losst adna; ennyire vágjuk. */
export const LOG_LOSS_EPSILON = 1e-15;

/** Log-loss: −ln p_bekövetkezett (ε-vágással). */
export const logLoss = (probabilities: readonly number[], outcomeIndex: number): number => {
	assertDistribution(probabilities, outcomeIndex);
	return -Math.log(Math.max(probabilities[outcomeIndex], LOG_LOSS_EPSILON));
};

/** CLV: `odd_ajánláskor / odd_záró-közeli − 1`; záró odds nélkül `null`. Pozitív = a piac felénk mozdult. */
export const closingLineValue = (oddsTaken: number, closingOdds: number | null | undefined): number | null => {
	if (closingOdds === null || closingOdds === undefined) return null;
	if (!(oddsTaken > 1 && closingOdds > 1)) throw new Error(`Érvénytelen odds: ${oddsTaken} / ${closingOdds}`);
	return oddsTaken / closingOdds - 1;
};

export interface CalibrationPoint {
	/** A modell valószínűsége az adott kimenetre. */
	p: number;
	/** Bekövetkezett-e. */
	hit: boolean;
}

export interface CalibrationBucket {
	lower: number;
	upper: number;
	count: number;
	/** A vödörbe esett p-k átlaga. */
	meanP: number;
	/** A bekövetkezések aránya a vödörben. */
	hitRate: number;
}

/** Kalibrációs vödrök (alapból 10%-osak); az üres vödör kimarad. p = 1 az utolsó vödörbe esik. */
export const calibrationBuckets = (points: readonly CalibrationPoint[], width = 0.1): CalibrationBucket[] => {
	if (!(width > 0 && width <= 1)) throw new Error(`Érvénytelen vödörszélesség: ${width}`);
	const n = Math.round(1 / width);
	const acc = Array.from({ length: n }, () => ({ count: 0, sumP: 0, hits: 0 }));
	for (const { p, hit } of points) {
		if (!(p >= 0 && p <= 1)) throw new Error(`Érvénytelen valószínűség: ${p}`);
		const b = acc[Math.min(Math.floor(p * n + 1e-9), n - 1)];
		b.count++;
		b.sumP += p;
		if (hit) b.hits++;
	}
	return acc.flatMap((b, i) =>
		b.count === 0
			? []
			: [{ lower: i / n, upper: (i + 1) / n, count: b.count, meanP: b.sumP / b.count, hitRate: b.hits / b.count }]
	);
};

export interface EvaluatedBet {
	odds: number;
	outcome: BetOutcome;
	/** A modell valószínűsége a választott kimenetre (a „várt” találati arányhoz). */
	p?: number;
	closingOdds?: number | null;
}

export interface BetSummary {
	/** Összes tipp (void-dal együtt). */
	n: number;
	wins: number;
	losses: number;
	voids: number;
	/** Találati arány az elszámolt (nem void) tippeken; `null`, ha nincs ilyen. */
	hitRate: number | null;
	/** Várt találati arány: az elszámolt tippek átlagos p-je; `null`, ha nincs p. */
	expectedHitRate: number | null;
	/** Flat profit egységben. */
	profit: number;
	/** ROI = profit / elszámolt tippek; `null`, ha nincs ilyen. */
	roi: number | null;
	/** A ROI standard hibája (a profit mintaszórása / √n); n < 2 esetén `null`. */
	roiStdError: number | null;
	/** Átlagos CLV a záró oddsszal rendelkező tippeken. */
	meanClv: number | null;
	clvCount: number;
}

const mean = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** Tipp-szintű összesítés: találat vs. várt, flat profit, ROI (+ standard hiba), CLV. */
export const summarizeBets = (bets: readonly EvaluatedBet[]): BetSummary => {
	const settled = bets.filter((b) => b.outcome !== 'void');
	const profits = settled.map((b) => flatProfit(b.outcome, b.odds));
	const profit = profits.reduce((s, x) => s + x, 0);
	const wins = settled.filter((b) => b.outcome === 'win').length;
	const roi = settled.length ? profit / settled.length : null;
	let roiStdError: number | null = null;
	if (settled.length >= 2 && roi !== null) {
		const variance = profits.reduce((s, x) => s + (x - roi) ** 2, 0) / (settled.length - 1);
		roiStdError = Math.sqrt(variance / settled.length);
	}
	const ps = settled.flatMap((b) => (b.p === undefined ? [] : [b.p]));
	const clvs = bets.flatMap((b) => {
		const c = closingLineValue(b.odds, b.closingOdds);
		return c === null ? [] : [c];
	});
	return {
		n: bets.length,
		wins,
		losses: settled.length - wins,
		voids: bets.length - settled.length,
		hitRate: settled.length ? wins / settled.length : null,
		expectedHitRate: mean(ps),
		profit,
		roi,
		roiStdError,
		meanClv: mean(clvs),
		clvCount: clvs.length
	};
};

export interface ProbabilisticPrediction {
	probabilities: readonly number[];
	outcomeIndex: number;
}

export interface ProbabilisticSummary {
	n: number;
	meanBrier: number | null;
	meanLogLoss: number | null;
}

/** Predikció-szintű összesítés (minden predikcióra, nem csak az ajánlásokra): átlag Brier és log-loss. */
export const summarizeProbabilities = (preds: readonly ProbabilisticPrediction[]): ProbabilisticSummary => ({
	n: preds.length,
	meanBrier: mean(preds.map((x) => brierScore(x.probabilities, x.outcomeIndex))),
	meanLogLoss: mean(preds.map((x) => logLoss(x.probabilities, x.outcomeIndex)))
});
