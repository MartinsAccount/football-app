// Tárolási feloldó (architecture.md §4.1, ROADMAP 2.1): ligánként mely piac × iroda kerül az `odds_quote`-ba.
// Tiszta függvények; a bemenetet a db `SettingsRepository.loadStoredScopeInput()` adja.
// A szűrés csak a TÁROLÁSRA vonatkozik: a legjobb/átlag odds (`odds_best`) a teljes válaszból számolódik előtte.

export interface StoredScopeMarket {
	/** API bet id. */
	id: number;
	/** Magyar domain-kód (pl. `Vegeredmeny`), ha van. */
	code: string | null;
	/** Globális tárolási jelző (`market.stored`). */
	stored: boolean;
}

export interface StoredScopeBookmaker {
	id: number;
	/** `bookmaker.stored`. */
	stored: boolean;
}

export interface StoredScopeLeague {
	leagueId: number;
	enabled: boolean;
	/** Ligánkénti felülírás: piackódok (vagy id szövegként); `null` = a globális `market.stored`. */
	markets: readonly string[] | null;
}

export interface StoredScopeInput {
	leagues: readonly StoredScopeLeague[];
	markets: readonly StoredScopeMarket[];
	bookmakers: readonly StoredScopeBookmaker[];
}

export interface StoredScope {
	leagueId: number;
	/** Követett és engedélyezett liga – csak ilyenre fut ingestion és tárolás. */
	followed: boolean;
	/** Tárolandó piac-id-k, növekvő sorrendben. */
	marketIds: number[];
	/** Tárolandó iroda-id-k, növekvő sorrendben. */
	bookmakerIds: number[];
}

const asc = (a: number, b: number): number => a - b;

/** A felülírás egy eleme a piac kódjára vagy az id-jére (szövegként) illeszkedik. */
function matchesOverride(market: StoredScopeMarket, override: ReadonlySet<string>): boolean {
	return (market.code !== null && override.has(market.code)) || override.has(String(market.id));
}

/** Egy liga tárolási köre. Nem követett / letiltott liga → üres kör. */
export function resolveStoredScope(leagueId: number, input: StoredScopeInput): StoredScope {
	const league = input.leagues.find((l) => l.leagueId === leagueId);
	if (!league || !league.enabled) return { leagueId, followed: false, marketIds: [], bookmakerIds: [] };

	const override = league.markets === null ? null : new Set(league.markets);
	const marketIds = input.markets
		.filter((m) => (override === null ? m.stored : matchesOverride(m, override)))
		.map((m) => m.id)
		.sort(asc);
	const bookmakerIds = input.bookmakers
		.filter((b) => b.stored)
		.map((b) => b.id)
		.sort(asc);
	return { leagueId, followed: true, marketIds, bookmakerIds };
}

/** Az összes követett, engedélyezett liga köre, liga-id szerint. */
export function resolveStoredScopes(input: StoredScopeInput): Map<number, StoredScope> {
	const out = new Map<number, StoredScope>();
	for (const l of input.leagues) {
		if (l.enabled) out.set(l.leagueId, resolveStoredScope(l.leagueId, input));
	}
	return out;
}

/** Tárolandó-e egy odds-sor (piac × iroda) az adott kör szerint. */
export function isQuoteStored(scope: StoredScope, marketId: number, bookmakerId: number): boolean {
	return scope.followed && scope.marketIds.includes(marketId) && scope.bookmakerIds.includes(bookmakerId);
}
