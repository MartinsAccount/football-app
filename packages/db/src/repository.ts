import type {
	Bookmaker,
	CountableTable,
	Evaluation,
	Fixture,
	FixtureFilter,
	League,
	Market,
	ModelVersion,
	OddsSnapshot,
	OddsSnapshotInput,
	Prediction,
	PredictionFilter,
	PredictionInput,
	PredictionRunInput,
	Season,
	Team,
	TeamAlias,
	UpsertResult
} from './types';

/**
 * Az app adat-hozzáférési szerződése. Az import (S08), a proxy (S10) és a backtest (S15) csak ezen keresztül ír/olvas.
 * A predikció append-only: nincs update/delete metódus (a DB-trigger is tiltja).
 */
export interface Repository {
	upsertLeagues(rows: League[]): Promise<UpsertResult>;
	upsertSeasons(rows: Season[]): Promise<UpsertResult>;
	upsertTeams(rows: Team[]): Promise<UpsertResult>;
	upsertTeamAliases(rows: TeamAlias[]): Promise<UpsertResult>;
	listTeamAliases(source: string): Promise<TeamAlias[]>;
	upsertBookmakers(rows: Bookmaker[]): Promise<UpsertResult>;
	upsertMarkets(rows: Market[]): Promise<UpsertResult>;

	upsertFixtures(rows: Fixture[]): Promise<UpsertResult>;
	getFixture(id: number): Promise<Fixture | null>;
	listFixtures(filter?: FixtureFilter): Promise<Fixture[]>;

	/** Ugyanaz a `(fixtureId, capturedAt, source)` második beszúrása no-op: `created: false`, a quote-ok nem íródnak. */
	insertOddsSnapshot(snapshot: OddsSnapshotInput): Promise<{ id: number; created: boolean }>;
	/** Köteges változat (egy tranzakció, fix számú lekérdezés); `quotes` = a beírt quote-sorok száma. */
	insertOddsSnapshots(snapshots: OddsSnapshotInput[]): Promise<{ created: number; existing: number; quotes: number }>;
	getLatestOdds(fixtureId: number): Promise<OddsSnapshot | null>;

	ensureModelVersion(version: ModelVersion): Promise<void>;
	createPredictionRun(run: PredictionRunInput): Promise<number>;
	/** Csak beszúrás; ugyanaz a (run, fixture, piac, kimenet, vonal) kétszer → hiba. */
	appendPredictions(runId: number, rows: PredictionInput[]): Promise<number[]>;
	listPredictions(filter?: PredictionFilter): Promise<Prediction[]>;
	upsertEvaluation(row: Evaluation): Promise<UpsertResult>;

	countRows(table: CountableTable): Promise<number>;
}
