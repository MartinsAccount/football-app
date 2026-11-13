// Arbitrázs-pásztázás odds-snapshotokból (ROADMAP 8.1, S23). Tiszta függvények: irodánként normalizált árfolyamok →
// kimenetelenként a legjobb odds, `Σ 1/odds`, haszon-arány és tét-elosztás. A régi `analyzeBookmakers` (API-Football
// `Bookmaker[]` szerkezet) változatlanul marad a /legacy úthoz; ez a függvény bármilyen forrásra (CSV, DB-quote) jó.

/** Egy iroda egy árfolyama egy kimenetelre. */
export interface ArbitrageQuote {
	bookmaker: string;
	outcome: string;
	odds: number;
}

/** A kiválasztott (legjobb) láb: kimenet, iroda, odds és a tét aránya a teljes tétből. */
export interface ArbitrageLeg {
	outcome: string;
	bookmaker: string;
	odds: number;
	/** A teljes tét ekkora részét kell erre a lábra tenni, hogy minden kimenetel ugyanannyit fizessen. */
	stakeShare: number;
}

export type ArbitrageBand = 'arb' | 'near' | 'far';

export interface ArbitrageOpportunity {
	market: string;
	/** Kimenetelenként a legjobb odds; hiányzó kimenetnél üres tömb (nincs teljes lefedés). */
	legs: ArbitrageLeg[];
	/** `Σ 1/odds_max`; `Infinity`, ha valamelyik kimenetelre nincs odds. */
	sum: number;
	/** Garantált hozam a teljes tétre: `1/sum − 1` (negatív = veszteség). */
	margin: number;
	/** Hány különböző iroda adott oddsot a piacra. */
	bookmakerCount: number;
	band: ArbitrageBand;
}

/** `sum < 1` → arbitrázs; `< NEAR_ARBITRAGE_SUM` → „közel” (figyelni érdemes, oddsmozgással átfordulhat). */
export const NEAR_ARBITRAGE_SUM = 1.02;

export function arbitrageBand(sum: number): ArbitrageBand {
	if (sum < 1) return 'arb';
	return sum < NEAR_ARBITRAGE_SUM ? 'near' : 'far';
}

/** `Σ 1/odds`; ha bármelyik odds hiányzik vagy ≤ 1, `Infinity`. */
export function arbitrageSum(odds: number[]): number {
	if (odds.length === 0 || odds.some((o) => !(o > 1))) return Infinity;
	return odds.reduce((acc, o) => acc + 1 / o, 0);
}

/**
 * Tét-elosztás egyenlő kifizetésre: `tét_i = teljes × (1/odds_i) / Σ`. A kifizetés minden kimenetelnél `teljes / Σ`.
 * `round` (pl. 100 Ft) megadásakor a tétek kerekítve, a kifizetés és a profit a legrosszabb kimenetelre számolva.
 */
export function arbitrageStakes(
	odds: number[],
	total: number,
	round = 0
): { stakes: number[]; payout: number; profit: number; worstPayout: number } {
	const sum = arbitrageSum(odds);
	if (!Number.isFinite(sum) || !(total > 0)) return { stakes: odds.map(() => 0), payout: 0, profit: 0, worstPayout: 0 };
	const raw = odds.map((o) => (total * (1 / o)) / sum);
	const stakes = round > 0 ? raw.map((s) => Math.round(s / round) * round) : raw;
	const staked = stakes.reduce((a, s) => a + s, 0);
	const worstPayout = Math.min(...stakes.map((s, i) => s * odds[i]));
	return { stakes, payout: total / sum, profit: worstPayout - staked, worstPayout };
}

/**
 * Egy meccs egy piaca: a `outcomes` minden kimenetelére a legmagasabb odds (egyenlőségnél az első iroda marad), és ebből az
 * arbitrázs-arány. Ismeretlen kimenetelű árfolyam nem számít.
 */
export function scanMarket(market: string, outcomes: string[], quotes: ArbitrageQuote[]): ArbitrageOpportunity {
	const best = outcomes.map((outcome) =>
		quotes
			.filter((q) => q.outcome === outcome && q.odds > 1)
			.reduce<ArbitrageQuote | null>((acc, q) => (!acc || q.odds > acc.odds ? q : acc), null)
	);
	const bookmakerCount = new Set(quotes.filter((q) => outcomes.includes(q.outcome) && q.odds > 1).map((q) => q.bookmaker)).size;
	if (best.some((b) => !b)) return { market, legs: [], sum: Infinity, margin: -1, bookmakerCount, band: 'far' };
	const legsOdds = best.map((b) => b!.odds);
	const sum = arbitrageSum(legsOdds);
	const legs = best.map((b) => ({ outcome: b!.outcome, bookmaker: b!.bookmaker, odds: b!.odds, stakeShare: 1 / b!.odds / sum }));
	return { market, legs, sum, margin: 1 / sum - 1, bookmakerCount, band: arbitrageBand(sum) };
}

// --- Pillanatkép (a `npm run arbitrage -w @football/db` írja, a `/arbitrage` olvassa) ---

export interface ArbitrageSnapshotMarket {
	key: string;
	label: string;
	outcomes: { key: string; label: string }[];
}

export interface ArbitrageFixture {
	fixtureId: number;
	league: string;
	kickoff: string;
	home: string;
	away: string;
	/** Az odds-pillanatkép ideje. */
	oddsAt: string;
	opportunities: ArbitrageOpportunity[];
}

export interface ArbitrageSnapshot {
	generatedAt: string;
	now: string;
	source: string;
	markets: ArbitrageSnapshotMarket[];
	bookmakers: string[];
	fixtures: ArbitrageFixture[];
}

/** JSON-ban az `Infinity` `null`-ként utazik: visszaalakítás olvasáskor. */
export function reviveArbitrageSnapshot(raw: unknown): ArbitrageSnapshot {
	const snap = raw as ArbitrageSnapshot;
	return {
		...snap,
		fixtures: snap.fixtures.map((f) => ({
			...f,
			opportunities: f.opportunities.map((o) => ({ ...o, sum: o.sum ?? Infinity }))
		}))
	};
}
