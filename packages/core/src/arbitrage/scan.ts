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
	/** Elméleti hozam a teljes tétre (kerekítés nélkül): `1/sum − 1` (negatív = veszteség). */
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

export interface ArbitrageStakeSplit {
	stakes: number[];
	/** Kerekítés nélküli egyenlő kifizetés: `teljes / Σ`. */
	payout: number;
	/** `worstPayout − staked` (a kerekített tétekkel). */
	profit: number;
	/** A legrosszabb kimenet kifizetése a (kerekített) tétekkel. */
	worstPayout: number;
	/** A ténylegesen feltett összeg: a (kerekített) tétek összege. */
	staked: number;
	/** A kerekített tétekkel számolt sáv (lásd `roundedBand`). */
	band: ArbitrageBand;
}

/**
 * Tét-elosztás egyenlő kifizetésre: `tét_i = teljes × (1/odds_i) / Σ`. A kifizetés minden kimenetelnél `teljes / Σ`.
 * `round` (pl. 10 Ft) megadásakor a tétek kerekítve, a kifizetés és a profit a legrosszabb kimenetelre számolva.
 * `band`: „arb” csak akkor, ha `Σ < 1` és a kerekített tétekkel is `worstPayout ≥ staked`; ha a kerekítés viszi el a
 * hozamot, „near” (S29 hibajavítás). `Σ ≥ 1` esetén a sum-alapú `arbitrageBand`.
 */
export function arbitrageStakes(odds: number[], total: number, round = 0): ArbitrageStakeSplit {
	const sum = arbitrageSum(odds);
	if (!Number.isFinite(sum) || !(total > 0))
		return { stakes: odds.map(() => 0), payout: 0, profit: 0, worstPayout: 0, staked: 0, band: arbitrageBand(sum) };
	const raw = odds.map((o) => (total * (1 / o)) / sum);
	const stakes = round > 0 ? raw.map((s) => Math.round(s / round) * round) : raw;
	const staked = stakes.reduce((a, s) => a + s, 0);
	const worstPayout = Math.min(...stakes.map((s, i) => s * odds[i]));
	const sumBand = arbitrageBand(sum);
	// 1e-9 Ft tűrés a lebegőpontos zaj ellen (kerekítés nélkül worstPayout ≈ staked / Σ).
	const band: ArbitrageBand = sumBand === 'arb' && worstPayout + 1e-9 < staked ? 'near' : sumBand;
	return { stakes, payout: total / sum, profit: worstPayout - staked, worstPayout, staked, band };
}

/** A kerekített (`round` Ft) tétekkel számolt sáv: `arbitrageStakes(odds, total, round).band`. */
export function roundedBand(odds: number[], total: number, round: number): ArbitrageBand {
	return arbitrageStakes(odds, total, round).band;
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
