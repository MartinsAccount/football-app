import type {
	ArbitrageFixture,
	ArbitrageOpportunity,
	ArbitrageSnapshot,
	BacktestReport,
	EvaluationSummary,
	OwnBetsSummary,
	OwnerProfile,
	ProfileCrossValidation,
	QuizAnswer,
	QuizQuestion,
	SettledPlacedBet,
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

/** A mai hívások egy jobra (`ingest_task.kind`; feladat nélküli hívás: `manual`) az `api_call_log`-ból (I19). */
export interface BudgetJobDto {
	job: string;
	/** Élő (kvótát fogyasztó) hívás. */
	live: number;
	/** Mock hívás (nem fogy a kvótából). */
	mock: number;
}

/** A legutóbbi mai `/status`-lekérés (nem fogy a kvótából); nincs ilyen → mindkettő `null`. */
export interface BudgetStatusCheckDto {
	checkedAt: string | null; // ISO
	/** A `/status` válaszkor a fejléc szerinti napi maradék (ha volt). */
	remainingAtCheck: number | null;
}

/** A mai ütemező-futások (`cron_run`). */
export interface BudgetCronDto {
	runs: number;
	calls: number;
	lastAt: string | null; // ISO
	lastStatus: string | null;
}

/** `GET /api/budget` → a mai (UTC) API-Football hívás-keret + jobonkénti bontás (I19, ROADMAP 2.4). */
export interface BudgetResponse {
	day: string; // YYYY-MM-DD
	used: number;
	limit: number;
	reserve: number;
	/** `api_budget_day.synced_remaining`: a `/status` szerinti maradék, azóta minden foglalással csökkentve. */
	syncedRemaining: number | null;
	remaining: number;
	jobs: BudgetJobDto[];
	status: BudgetStatusCheckDto;
	cron: BudgetCronDto;
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

/** API-Football liga-lefedettség (a `season.coverage` jsonb-ből); `null` = a tárolt válasz nem hozta ezt a jelzőt. */
export interface LeagueCoverageDto {
	odds: boolean | null;
	injuries: boolean | null;
	/** `fixtures.statistics_fixtures`. */
	statistics: boolean | null;
}

/** Egy liga a katalógusból (`league` + aktuális `season`). */
export interface LeagueDto {
	id: number;
	name: string;
	country: string | null;
	type: 'league' | 'cup' | null;
	logoUrl: string | null;
	/** Aktuális szezon: `is_current`, ennek hiányában a legnagyobb év; `null`, ha nincs szezon-sor. */
	season: number | null;
	/** Csapatszám: a `season_team`-ből (legutóbbi kitöltött szezon), ennek hiányában a meccsek csapataiból (osztályozó nélkül); `null` = ismeretlen. */
	teamCount: number | null;
	/** Az aktuális szezon lefedettsége; `null` = nincs tárolt coverage (nem találunk ki). */
	coverage: LeagueCoverageDto | null;
}

/** `GET /api/leagues` (I18b): a liga-katalógus név szerint rendezve. */
export interface LeaguesResponse {
	leagues: LeagueDto[];
}

/** Egy csapat a liga csapatlistájából (`team` tábla). */
export interface LeagueTeamDto {
	id: number;
	name: string;
	logoUrl: string | null;
}

/**
 * `GET /api/leagues/:id/teams` (I18c): a liga csapatai név szerint – a `season_team` legutóbbi kitöltött szezonjából, ennek
 * hiányában a meccsek legutóbbi szezonjából (osztályozó nélkül). `season: null` + üres lista = nincs adat.
 */
export interface LeagueTeamsResponse {
	leagueId: number;
	season: number | null;
	teams: LeagueTeamDto[];
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

/** `POST /api/bets` törzse (ROADMAP 5.6): egy ténylegesen megtett tipp kézi rögzítése (bukmékerhez leadás nincs, PRD 8). */
export interface PlacedBetInput {
	fixtureId: number;
	/** API-Football piac-id (1 = 1X2, 5 = Gól O/U; más piac rögzíthető, de nem számol el). */
	marketId: number;
	/** Pl. `Home`/`Draw`/`Away`, `Over`/`Under`. */
	selection: string;
	/** O/U vonal (pl. 2,5); 1X2-nél elhagyható. */
	line?: number | null;
	/** A ténylegesen kapott (Tippmix-) odds, > 1. */
	oddTaken: number;
	/** Tét pénzben (Ft), > 0. */
	stake: number;
	/** A kapcsolt predikció (`prediction.id`), ha ajánlásból jött; ugyanahhoz a meccshez kell tartoznia. */
	predictionId?: number | null;
	/** Alapértelmezés: „Tippmix”. */
	bookmakerLabel?: string | null;
	/** ISO időpont; alapértelmezés: most. */
	placedAt?: string | null;
	note?: string | null;
}

/** Egy rögzített fogadás elszámolással (`outcome`/`profit` `null` = még függő). */
export type PlacedBetDto = SettledPlacedBet;

/** `GET /api/bets`: a rögzített fogadások és a „saját” ROI a modell ROI-ja mellett. */
export interface PlacedBetsResponse {
	bets: PlacedBetDto[];
	summary: OwnBetsSummary;
}

/** `GET /api/quiz/next[?seed=]` (ROADMAP 12.2): egy még meg nem válaszolt, lejátszott meccs nyitó adatai; `null`, ha elfogyott. */
export interface QuizNextResponse {
	question: QuizQuestion | null;
}

/** `POST /api/quiz/answer` törzse: `pick` = `1 | X | 2 | over | under | skip`, `confidence` 1–3 (opcionális). */
export type QuizAnswerInput = QuizAnswer;

/** A meccs valós kimenete (a válasz után mutatható). */
export interface QuizResultDto {
	homeGoals: number;
	awayGoals: number;
	outcome: '1' | 'X' | '2';
	/** Gólösszeg > 2,5. */
	over25: boolean;
}

/** `POST /api/quiz/answer` válasza: a mentett válasz + a valós eredmény; `correct` `null` skip-nél. */
export interface QuizAnswerResponse {
	answer: QuizAnswer & { answeredAt: string };
	result: QuizResultDto;
	correct: boolean | null;
}

/** `GET /api/profile`: a tulajdonos-profil (kvíz + egylábú saját fogadások) és a keresztvalidált egyezés vs. favorit-baseline. */
export interface ProfileResponse {
	profile: OwnerProfile;
	crossValidation: ProfileCrossValidation;
	sources: {
		/** Felhasznált kvízválaszok (skip-pel együtt). */
		quiz: number;
		/** Leképezhető (1X2 / O/U 2,5) saját fogadások olyan meccsekre, amelyekre nincs kvízválasz. */
		placedBets: number;
		/** Kihagyott minták (nincs nyitó 1X2 odds, vagy a fogadás nem képezhető le). */
		ignored: number;
	};
}
