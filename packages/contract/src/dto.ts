import type {
	ArbitrageFixture,
	ArbitrageOpportunity,
	ArbitrageSnapshot,
	BacktestReport,
	RecommendationSnapshot
} from '@football/core';

/**
 * Az olvasó API (`packages/server`) válasz-DTO-i. Szándékosan önálló típusok (nem a `@football/db`-ből), hogy a
 * kliensoldal (web, React Native) ne húzzon be DB-függőséget; a server `satisfies`-szal köti hozzájuk a válaszait,
 * így eltérésnél a typecheck bukik.
 */

/** Egy meccs, ahogy a `/api/fixtures` adja. Időpont: ISO 8601 (UTC). */
export interface FixtureDto {
	id: number;
	leagueId: number;
	season: number;
	round?: string | null;
	kickoffAt: string;
	status: string;
	homeTeamId: number;
	awayTeamId: number;
	goalsHome?: number | null;
	goalsAway?: number | null;
	htHome?: number | null;
	htAway?: number | null;
	ftHome?: number | null;
	ftAway?: number | null;
	referee?: string | null;
}

/** `GET /api/fixtures` → lapozott, kezdési idő szerint rendezett lista. */
export interface FixturesResponse {
	total: number;
	limit: number;
	offset: number;
	fixtures: FixtureDto[];
}

/** A `parseFixtureQuery` paraméterei kliensoldalon. A `status` tömbje vesszővel összefűzve megy át. */
export interface FixtureQuery {
	league?: number;
	season?: number;
	status?: string[];
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
}

export type OddsSourceDto = 'api-football' | 'football-data-csv' | 'legacy-json' | 'manual';
export type OddsKindDto = 'early' | 'late' | 'adhoc' | 'opening_csv' | 'closing_csv' | 'legacy';

export interface OddsQuoteDto {
	bookmakerId: number;
	marketId: number;
	selection: string;
	line?: number | null;
	odd: number;
}

export interface OddsSnapshotDto {
	id: number;
	fixtureId: number;
	capturedAt: string;
	providerUpdatedAt?: string | null;
	source: OddsSourceDto;
	kind: OddsKindDto;
	quotes: OddsQuoteDto[];
}

/** `GET /api/odds/:fixtureId` → a legutóbbi odds-pillanatkép (vagy `null`, ha még nincs). */
export interface OddsResponse {
	fixtureId: number;
	snapshot: OddsSnapshotDto | null;
}

/** `GET /api/budget` → a mai (UTC) API-Football hívás-keret. */
export interface BudgetResponse {
	day: string; // YYYY-MM-DD
	used: number;
	limit: number;
	reserve: number;
	syncedRemaining: number | null;
	remaining: number;
}

// --- Pillanatkép-végpontok (SB4). A forrás ma a mentett `data/*/*-v0.json`, később DB-tábla. A típusok a `@football/core`
// pillanatkép-típusai (csak `import type`: a contract futásidőben továbbra is függőség nélküli). ---

/** `GET /api/recommendations` → az ajánlás-pillanatkép (`npm run recommendations -w @football/db`). */
export type RecommendationsResponse = RecommendationSnapshot;

/** `GET /api/backtest` → a walk-forward backtest riport (`npm run backtest -w @football/db`). */
export type BacktestResponse = BacktestReport;

/** JSON-ban az `Infinity` `null`-ként utazik: a nem teljes piac `sum`-ja `null`. */
export type ArbitrageOpportunityDto = Omit<ArbitrageOpportunity, 'sum'> & { sum: number | null };
export type ArbitrageFixtureDto = Omit<ArbitrageFixture, 'opportunities'> & { opportunities: ArbitrageOpportunityDto[] };

/**
 * `GET /api/arbitrage` → az arbitrázs-pillanatkép drótformája (`npm run arbitrage -w @football/db`). Olvasáskor:
 * `reviveArbitrageSnapshot` (core) → `ArbitrageSnapshot`.
 */
export type ArbitrageResponse = Omit<ArbitrageSnapshot, 'fixtures'> & { fixtures: ArbitrageFixtureDto[] };

/** Hibakódok, amelyeket a server az `{ error, message }` törzsben ad. */
export type ApiErrorCode = 'bad-request' | 'unauthorized' | 'not-found' | 'method' | 'internal';

/** Minden nem-2xx válasz törzse. */
export interface ApiErrorBody {
	error: ApiErrorCode;
	message: string;
}
