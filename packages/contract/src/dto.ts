import type {
	ArbitrageFixture,
	ArbitrageOpportunity,
	ArbitrageSnapshot,
	BacktestReport,
	EvaluationSummary,
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
	/** A csapat neve a `team` táblából (M11a); `null`, ha a csapat nincs importálva. Régi szervernél hiányozhat. */
	homeTeamName?: string | null;
	awayTeamName?: string | null;
}

/** `GET /api/fixtures/:id` → egy meccs csapatnevekkel (404, ha nincs). */
export type FixtureResponse = FixtureDto;

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

/** `GET /api/odds/:fixtureId/history` → a meccs összes odds-pillanatképe időrendben (üres tömb, ha nincs). */
export interface OddsHistoryResponse {
	fixtureId: number;
	snapshots: OddsSnapshotDto[];
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

/** `GET /api/evaluation?model=` (I17): a DB-ben tárolt kiértékelések összesítése (Brier/log-loss csoportonként 1 sorral). */
export type EvaluationSummaryResponse = EvaluationSummary;

/** JSON-ban az `Infinity` `null`-ként utazik: a nem teljes piac `sum`-ja `null`. */
export type ArbitrageOpportunityDto = Omit<ArbitrageOpportunity, 'sum'> & { sum: number | null };
export type ArbitrageFixtureDto = Omit<ArbitrageFixture, 'opportunities'> & { opportunities: ArbitrageOpportunityDto[] };

/**
 * `GET /api/arbitrage` → az arbitrázs-pillanatkép drótformája (`npm run arbitrage -w @football/db`). Olvasáskor:
 * `reviveArbitrageSnapshot` (core) → `ArbitrageSnapshot`.
 */
export type ArbitrageResponse = Omit<ArbitrageSnapshot, 'fixtures'> & { fixtures: ArbitrageFixtureDto[] };

// --- Beállítás-API (ROADMAP 2.1b, I3). ---

/** Snapshot-megőrzés (core `Retention`). */
export type RetentionDto = 'opening-closing' | 'all';

/** Típusos skalár-beállítások (`setting` tábla); a hiányzó kulcs a core `DEFAULT_SETTINGS` értékét kapja. */
export interface SettingValuesDto {
	/** EV-küszöb arányként (0,03 = 3%). */
	evThreshold: number;
	minOdds: number;
	maxOdds: number;
	/** Tét-alapegység Ft-ban (`unit_ft`). */
	stakeUnit: number;
	/** Tét-mód (strategy.md: flat az alap, tört-Kelly opcionális). */
	stakeMode: 'flat' | 'fractional-kelly';
	/** Backfill csak akkor indul, ha a napi `used` e plafon alatt van (architecture §7). */
	backfillCap: number;
	/** Napi hívás-tartalék a backfillnek. */
	backfillReserve: number;
	retention: RetentionDto;
}

export interface FollowedLeagueDto {
	leagueId: number;
	enabled: boolean;
	priority: number;
	/** Ligánkénti piac-felülírás (piackód vagy id szövegként); `null` = globális `market.stored`. */
	markets: string[] | null;
	addedAt: string;
}

export interface FollowedLeagueInputDto {
	leagueId: number;
	enabled?: boolean;
	priority?: number;
	/** Megadva felülír (`null` = vissza a globálisra); elhagyva a meglévő érték marad. */
	markets?: string[] | null;
}

export interface TeamFilterDto {
	teamId: number;
	mode: 'include' | 'exclude';
}

export interface StoredFlagDto {
	id: number;
	name: string;
	stored: boolean;
}

export interface MarketFlagDto extends StoredFlagDto {
	code: string | null;
}

/** `GET /api/settings` (és a `PUT` válasza) → a teljes beállítás-állapot. */
export interface SettingsResponse {
	values: SettingValuesDto;
	followedLeagues: FollowedLeagueDto[];
	teamFilters: TeamFilterDto[];
	markets: MarketFlagDto[];
	bookmakers: StoredFlagDto[];
}

/** `PUT /api/settings` törzse: minden ág opcionális; érvénytelen elem → 400, és semmi sem íródik. */
export interface SettingsUpdate {
	values?: Partial<SettingValuesDto>;
	followedLeagues?: { upsert?: FollowedLeagueInputDto[]; remove?: number[] };
	teamFilters?: { upsert?: TeamFilterDto[]; remove?: number[] };
	markets?: { id: number; stored: boolean }[];
	bookmakers?: { id: number; stored: boolean }[];
}

/** Hibakódok, amelyeket a server az `{ error, message }` törzsben ad. */
export type ApiErrorCode = 'bad-request' | 'unauthorized' | 'not-found' | 'method' | 'internal';

/** Minden nem-2xx válasz törzse. */
export interface ApiErrorBody {
	error: ApiErrorCode;
	message: string;
}
