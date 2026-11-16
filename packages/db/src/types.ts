// A repository domain-típusai (camelCase); a tábla-oszlopokat lásd migrations/*.sql.

export interface League {
	id: number;
	name: string;
	country?: string | null;
	type?: 'league' | 'cup' | null;
	logoUrl?: string | null;
}

export interface Season {
	leagueId: number;
	year: number;
	startDate?: string | null; // YYYY-MM-DD
	endDate?: string | null;
	isCurrent?: boolean;
}

export interface Team {
	id: number;
	name: string;
	code?: string | null;
	country?: string | null;
	logoUrl?: string | null;
}

/** Külső forrás csapatneve → csapat (pl. football-data CSV „Man United”). */
export interface TeamAlias {
	source: string;
	name: string;
	teamId: number;
}

export interface Bookmaker {
	id: number;
	name: string;
	stored?: boolean;
}

export interface Market {
	id: number;
	name: string;
	code?: string | null;
	analyzed?: boolean;
	stored?: boolean;
}

export interface Fixture {
	id: number;
	leagueId: number;
	season: number;
	round?: string | null;
	kickoffAt: string; // ISO 8601
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

export interface FixtureFilter {
	leagueId?: number;
	season?: number;
	status?: string[];
	from?: string; // kickoff_at >= from
	to?: string; // kickoff_at < to
}

export type OddsSource = 'api-football' | 'football-data-csv' | 'legacy-json' | 'manual';
export type OddsKind = 'early' | 'late' | 'adhoc' | 'opening_csv' | 'closing_csv' | 'legacy';

export interface OddsQuote {
	bookmakerId: number;
	marketId: number;
	selection: string;
	line?: number | null;
	odd: number;
}

export interface OddsSnapshotInput {
	fixtureId: number;
	capturedAt: string;
	providerUpdatedAt?: string | null;
	source: OddsSource;
	kind: OddsKind;
	quotes: OddsQuote[];
	/** `odds_best`: a teljes válaszból (iroda-szűrés előtt) számolt legjobb/átlag kimenetenként (ROADMAP 3.5b). */
	best?: OddsBest[];
}

export interface OddsBest {
	marketId: number;
	selection: string;
	line?: number | null;
	maxOdd: number;
	/** A legjobb iroda; ha nincs a `bookmaker` táblában, mentéskor `null` lesz. */
	bookmakerId: number | null;
	avgOdd: number | null;
	nBooks: number;
}

export interface OddsSnapshot extends OddsSnapshotInput {
	id: number;
}

export interface ModelVersion {
	id: string; // pl. 'elo-poisson@0.1.0'
	description?: string | null;
	params?: unknown;
	gitSha?: string | null;
	status?: 'dev' | 'shadow' | 'live' | 'retired';
}

export interface PredictionRunInput {
	modelVersion: string;
	trigger: 'schedule' | 'manual' | 'backtest';
	asOf?: string | null;
}

export interface PredictionInput {
	fixtureId: number;
	marketId: number;
	selection: string;
	line?: number | null;
	pModel: number;
	pMarketFair?: number | null;
	oddsSnapshotId?: number | null;
	bestOdd?: number | null;
	bestBookmakerId?: number | null;
	minAcceptableOdd?: number | null;
	ev?: number | null;
	isRecommendation?: boolean;
	stakeUnits?: number | null;
	confidence?: string | null;
	features?: Record<string, unknown>;
	explanation?: unknown[];
	warnings?: unknown[];
}

export interface Prediction extends Required<PredictionInput> {
	id: number;
	runId: number;
	createdAt: string;
}

export interface PredictionFilter {
	fixtureId?: number;
	runId?: number;
}

export interface Evaluation {
	predictionId: number;
	settledAt: string;
	outcome: 'win' | 'loss' | 'void' | 'half_win' | 'half_loss';
	profitUnits: number;
	brier?: number | null;
	logLoss?: number | null;
	closingSnapshotId?: number | null;
	closingOdd?: number | null;
	clv?: number | null;
}

/** Egy upsert-köteg eredménye: a változatlan sor nem íródik (a 2. import-futás 0 írás). */
export interface UpsertResult {
	inserted: number;
	updated: number;
	unchanged: number;
}

export const COUNTABLE_TABLES = [
	'league',
	'season',
	'team',
	'team_alias',
	'bookmaker',
	'market',
	'fixture',
	'odds_snapshot',
	'odds_quote',
	'odds_best',
	'model_version',
	'prediction_run',
	'prediction',
	'evaluation'
] as const;
export type CountableTable = (typeof COUNTABLE_TABLES)[number];
