import type { SqlExecutor } from './migrate';
import type { Repository } from './repository';
import {
	COUNTABLE_TABLES,
	type Bookmaker,
	type CountableTable,
	type Evaluation,
	type Fixture,
	type FixtureFilter,
	type League,
	type Market,
	type ModelVersion,
	type OddsSnapshot,
	type OddsSnapshotInput,
	type Prediction,
	type PredictionFilter,
	type PredictionInput,
	type PredictionRunInput,
	type Season,
	type Team,
	type TeamAlias,
	type UpsertResult
} from './types';

/** Egy oszlop leképezése: domain-mező → oszlop, opcionális cast (pl. jsonb) és alapérték hiányzó mezőre. */
interface Col<T> {
	field: keyof T & string;
	column: string;
	cast?: string;
	fallback?: unknown;
	json?: boolean;
}

interface UpsertSpec<T> {
	table: string;
	key: string[];
	cols: Col<T>[];
	/** Változáskor ezt is beállítja (pl. `updated_at = now()`), de az összevetésben nem vesz részt. */
	touch?: string;
}

const LEAGUE: UpsertSpec<League> = {
	table: 'league',
	key: ['id'],
	cols: [
		{ field: 'id', column: 'id' },
		{ field: 'name', column: 'name' },
		{ field: 'country', column: 'country', fallback: null },
		{ field: 'type', column: 'type', fallback: null },
		{ field: 'logoUrl', column: 'logo_url', fallback: null }
	]
};

const SEASON: UpsertSpec<Season> = {
	table: 'season',
	key: ['league_id', 'year'],
	cols: [
		{ field: 'leagueId', column: 'league_id' },
		{ field: 'year', column: 'year' },
		{ field: 'startDate', column: 'start_date', cast: 'date', fallback: null },
		{ field: 'endDate', column: 'end_date', cast: 'date', fallback: null },
		{ field: 'isCurrent', column: 'is_current', fallback: false }
	]
};

const TEAM: UpsertSpec<Team> = {
	table: 'team',
	key: ['id'],
	cols: [
		{ field: 'id', column: 'id' },
		{ field: 'name', column: 'name' },
		{ field: 'code', column: 'code', fallback: null },
		{ field: 'country', column: 'country', fallback: null },
		{ field: 'logoUrl', column: 'logo_url', fallback: null }
	]
};

const TEAM_ALIAS: UpsertSpec<TeamAlias> = {
	table: 'team_alias',
	key: ['source', 'name'],
	cols: [
		{ field: 'source', column: 'source' },
		{ field: 'name', column: 'name' },
		{ field: 'teamId', column: 'team_id' }
	]
};

const BOOKMAKER: UpsertSpec<Bookmaker> = {
	table: 'bookmaker',
	key: ['id'],
	cols: [
		{ field: 'id', column: 'id' },
		{ field: 'name', column: 'name' },
		{ field: 'stored', column: 'stored', fallback: false }
	]
};

const MARKET: UpsertSpec<Market> = {
	table: 'market',
	key: ['id'],
	cols: [
		{ field: 'id', column: 'id' },
		{ field: 'name', column: 'name' },
		{ field: 'code', column: 'code', fallback: null },
		{ field: 'analyzed', column: 'analyzed', fallback: false },
		{ field: 'stored', column: 'stored', fallback: false }
	]
};

const FIXTURE: UpsertSpec<Fixture> = {
	table: 'fixture',
	key: ['id'],
	touch: 'updated_at = now()',
	cols: [
		{ field: 'id', column: 'id' },
		{ field: 'leagueId', column: 'league_id' },
		{ field: 'season', column: 'season' },
		{ field: 'round', column: 'round', fallback: null },
		{ field: 'kickoffAt', column: 'kickoff_at', cast: 'timestamptz' },
		{ field: 'status', column: 'status' },
		{ field: 'homeTeamId', column: 'home_team_id' },
		{ field: 'awayTeamId', column: 'away_team_id' },
		{ field: 'goalsHome', column: 'goals_home', fallback: null },
		{ field: 'goalsAway', column: 'goals_away', fallback: null },
		{ field: 'htHome', column: 'ht_home', fallback: null },
		{ field: 'htAway', column: 'ht_away', fallback: null },
		{ field: 'ftHome', column: 'ft_home', fallback: null },
		{ field: 'ftAway', column: 'ft_away', fallback: null },
		{ field: 'referee', column: 'referee', fallback: null }
	]
};

const MODEL_VERSION: UpsertSpec<ModelVersion> = {
	table: 'model_version',
	key: ['id'],
	cols: [
		{ field: 'id', column: 'id' },
		{ field: 'description', column: 'description', fallback: null },
		{ field: 'params', column: 'params', cast: 'jsonb', json: true, fallback: null },
		{ field: 'gitSha', column: 'git_sha', fallback: null },
		{ field: 'status', column: 'status', fallback: 'dev' }
	]
};

const EVALUATION: UpsertSpec<Evaluation> = {
	table: 'evaluation',
	key: ['prediction_id'],
	cols: [
		{ field: 'predictionId', column: 'prediction_id' },
		{ field: 'settledAt', column: 'settled_at', cast: 'timestamptz' },
		{ field: 'outcome', column: 'outcome' },
		{ field: 'profitUnits', column: 'profit_units' },
		{ field: 'brier', column: 'brier', fallback: null },
		{ field: 'logLoss', column: 'log_loss', fallback: null },
		{ field: 'closingSnapshotId', column: 'closing_snapshot_id', fallback: null },
		{ field: 'closingOdd', column: 'closing_odd', cast: 'numeric', fallback: null },
		{ field: 'clv', column: 'clv', fallback: null }
	]
};

/** timestamptz → ISO 8601 UTC string (a PGlite Date-et, a `pg` stringet adna – így mindkettő egyforma). */
const iso = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`;
/** bigint/numeric → JS number (a `pg` driver stringként adná vissza). */
const num = (col: string) => `${col}::float8`;

const FIXTURE_SELECT = `SELECT ${num('id')} AS "id", ${num('league_id')} AS "leagueId", season AS "season", round AS "round",
	${iso('kickoff_at')} AS "kickoffAt", status AS "status", ${num('home_team_id')} AS "homeTeamId",
	${num('away_team_id')} AS "awayTeamId", goals_home AS "goalsHome", goals_away AS "goalsAway", ht_home AS "htHome",
	ht_away AS "htAway", ft_home AS "ftHome", ft_away AS "ftAway", referee AS "referee"
	FROM fixture`;

const PREDICTION_SELECT = `SELECT ${num('id')} AS "id", ${num('run_id')} AS "runId", ${num('fixture_id')} AS "fixtureId",
	${num('market_id')} AS "marketId", selection AS "selection", ${num('line')} AS "line", p_model AS "pModel",
	p_market_fair AS "pMarketFair", ${num('odds_snapshot_id')} AS "oddsSnapshotId", ${num('best_odd')} AS "bestOdd",
	${num('best_bookmaker_id')} AS "bestBookmakerId", ${num('min_acceptable_odd')} AS "minAcceptableOdd", ev AS "ev",
	is_recommendation AS "isRecommendation", ${num('stake_units')} AS "stakeUnits", confidence AS "confidence",
	features AS "features", explanation AS "explanation", warnings AS "warnings", ${iso('created_at')} AS "createdAt"
	FROM prediction`;

/**
 * A `Repository` SQL-megvalósítása bármely `SqlExecutor` fölött: lokálisan/tesztben PGlite (memóriában), később `pg` a
 * Supabase-en. A tranzakció BEGIN/COMMIT-tal megy, ezért egy kapcsolatot igényel (PGlite, `pg.Client`; pool-nál egy
 * kikért kliens).
 */
export class SqlRepository implements Repository {
	constructor(private readonly db: SqlExecutor) {}

	upsertLeagues(rows: League[]) {
		return this.upsert(LEAGUE, rows);
	}
	upsertSeasons(rows: Season[]) {
		return this.upsert(SEASON, rows);
	}
	upsertTeams(rows: Team[]) {
		return this.upsert(TEAM, rows);
	}
	upsertTeamAliases(rows: TeamAlias[]) {
		return this.upsert(TEAM_ALIAS, rows);
	}
	async listTeamAliases(source: string): Promise<TeamAlias[]> {
		const { rows } = await this.db.query<{ source: string; name: string; team_id: number | string }>(
			'SELECT source, name, team_id FROM team_alias WHERE source = $1 ORDER BY name',
			[source]
		);
		return rows.map((r) => ({ source: r.source, name: r.name, teamId: Number(r.team_id) }));
	}
	upsertBookmakers(rows: Bookmaker[]) {
		return this.upsert(BOOKMAKER, rows);
	}
	upsertMarkets(rows: Market[]) {
		return this.upsert(MARKET, rows);
	}
	upsertFixtures(rows: Fixture[]) {
		return this.upsert(FIXTURE, rows);
	}
	upsertEvaluation(row: Evaluation) {
		return this.upsert(EVALUATION, [row]);
	}
	async ensureModelVersion(version: ModelVersion) {
		await this.upsert(MODEL_VERSION, [version]);
	}

	async getFixture(id: number): Promise<Fixture | null> {
		const { rows } = await this.db.query<Fixture>(`${FIXTURE_SELECT} WHERE id = $1`, [id]);
		return rows[0] ?? null;
	}

	async listFixtures(filter: FixtureFilter = {}): Promise<Fixture[]> {
		const where: string[] = [];
		const params: unknown[] = [];
		const add = (cond: string, value: unknown) => {
			params.push(value);
			where.push(cond.replace('?', `$${params.length}`));
		};
		if (filter.leagueId !== undefined) add('league_id = ?', filter.leagueId);
		if (filter.season !== undefined) add('season = ?', filter.season);
		if (filter.status?.length) add('status = ANY(?::text[])', filter.status);
		if (filter.from) add('kickoff_at >= ?::timestamptz', filter.from);
		if (filter.to) add('kickoff_at < ?::timestamptz', filter.to);
		const sql = `${FIXTURE_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY kickoff_at, id`;
		return (await this.db.query<Fixture>(sql, params)).rows;
	}

	async insertOddsSnapshot(s: OddsSnapshotInput): Promise<{ id: number; created: boolean }> {
		return this.transaction(async () => {
			const inserted = await this.db.query<{ id: number }>(
				`INSERT INTO odds_snapshot (fixture_id, captured_at, provider_updated_at, source, kind)
				 VALUES ($1, $2::timestamptz, $3::timestamptz, $4, $5)
				 ON CONFLICT (fixture_id, captured_at, source) DO NOTHING
				 RETURNING ${num('id')} AS id`,
				[s.fixtureId, s.capturedAt, s.providerUpdatedAt ?? null, s.source, s.kind]
			);
			if (!inserted.rows[0]) {
				const existing = await this.db.query<{ id: number }>(
					`SELECT ${num('id')} AS id FROM odds_snapshot WHERE fixture_id = $1 AND captured_at = $2::timestamptz AND source = $3`,
					[s.fixtureId, s.capturedAt, s.source]
				);
				return { id: existing.rows[0].id, created: false };
			}
			const id = inserted.rows[0].id;
			await this.insertQuotes(s.quotes.map((q) => ({ ...q, snapshotId: id })));
			return { id, created: true };
		});
	}

	/**
	 * Köteges snapshot-beszúrás egy tranzakcióban, kötegenként fix számú lekérdezéssel (távoli DB-n a soronkénti út
	 * snapshotonként ~20 hálózati kör). Szemantika = `insertOddsSnapshot`: a meglévő kulcs no-op, a quote-ja nem íródik.
	 * A kötegen belüli ismétlődő kulcsból az első számít.
	 */
	async insertOddsSnapshots(list: OddsSnapshotInput[]): Promise<{ created: number; existing: number; quotes: number }> {
		const seen = new Set<string>();
		const unique = list.filter((s) => {
			const k = `${s.fixtureId}|${s.capturedAt}|${s.source}`;
			return seen.has(k) ? false : (seen.add(k), true);
		});
		if (!unique.length) return { created: 0, existing: list.length, quotes: 0 };
		return this.transaction(async () => {
			const cols = [
				unique.map((s) => s.fixtureId),
				unique.map((s) => s.capturedAt),
				unique.map((s) => s.providerUpdatedAt ?? null),
				unique.map((s) => s.source),
				unique.map((s) => s.kind)
			];
			const created = await this.db.query<{ id: number }>(
				`INSERT INTO odds_snapshot (fixture_id, captured_at, provider_updated_at, source, kind)
				 SELECT * FROM unnest($1::bigint[], $2::timestamptz[], $3::timestamptz[], $4::text[], $5::text[])
				 ON CONFLICT (fixture_id, captured_at, source) DO NOTHING
				 RETURNING ${num('id')} AS id`,
				cols
			);
			const createdIds = new Set(created.rows.map((r) => r.id));
			// Sorszám → id (az új és a meglévő sorokra is), hogy a quote-ok a saját snapshotjukhoz kerüljenek.
			const ids = await this.db.query<{ ord: number; id: number }>(
				`SELECT k.ord::int AS ord, ${num('s.id')} AS id
				 FROM unnest($1::bigint[], $2::timestamptz[], $3::text[]) WITH ORDINALITY AS k(fixture_id, captured_at, source, ord)
				 JOIN odds_snapshot s USING (fixture_id, captured_at, source)`,
				[cols[0], cols[1], cols[3]]
			);
			const quotes = ids.rows
				.filter((r) => createdIds.has(r.id))
				.flatMap((r) => unique[r.ord - 1].quotes.map((q) => ({ ...q, snapshotId: r.id })));
			await this.insertQuotes(quotes);
			return { created: createdIds.size, existing: list.length - createdIds.size, quotes: quotes.length };
		});
	}

	private async insertQuotes(quotes: Array<OddsSnapshotInput['quotes'][number] & { snapshotId: number }>) {
		if (!quotes.length) return;
		await this.db.query(
			`INSERT INTO odds_quote (snapshot_id, bookmaker_id, market_id, selection, line, odd)
			 SELECT * FROM unnest($1::bigint[], $2::bigint[], $3::bigint[], $4::text[], $5::numeric[], $6::numeric[])`,
			[
				quotes.map((q) => q.snapshotId),
				quotes.map((q) => q.bookmakerId),
				quotes.map((q) => q.marketId),
				quotes.map((q) => q.selection),
				quotes.map((q) => q.line ?? null),
				quotes.map((q) => q.odd)
			]
		);
	}

	async getLatestOdds(fixtureId: number): Promise<OddsSnapshot | null> {
		const { rows } = await this.db.query<Omit<OddsSnapshot, 'quotes'>>(
			`SELECT ${num('id')} AS "id", ${num('fixture_id')} AS "fixtureId", ${iso('captured_at')} AS "capturedAt",
				CASE WHEN provider_updated_at IS NULL THEN NULL ELSE ${iso('provider_updated_at')} END AS "providerUpdatedAt",
				source AS "source", kind AS "kind"
			 FROM odds_snapshot WHERE fixture_id = $1 ORDER BY captured_at DESC, id DESC LIMIT 1`,
			[fixtureId]
		);
		const snap = rows[0];
		if (!snap) return null;
		const quotes = await this.db.query<OddsSnapshot['quotes'][number]>(
			`SELECT ${num('bookmaker_id')} AS "bookmakerId", ${num('market_id')} AS "marketId", selection AS "selection",
				${num('line')} AS "line", ${num('odd')} AS "odd"
			 FROM odds_quote WHERE snapshot_id = $1 ORDER BY market_id, line NULLS FIRST, selection, bookmaker_id`,
			[snap.id]
		);
		return { ...snap, quotes: quotes.rows };
	}

	async createPredictionRun(run: PredictionRunInput): Promise<number> {
		const { rows } = await this.db.query<{ id: number }>(
			`INSERT INTO prediction_run (model_version, trigger, as_of) VALUES ($1, $2, $3::timestamptz) RETURNING ${num('id')} AS id`,
			[run.modelVersion, run.trigger, run.asOf ?? null]
		);
		return rows[0].id;
	}

	async appendPredictions(runId: number, preds: PredictionInput[]): Promise<number[]> {
		return this.transaction(async () => {
			const ids: number[] = [];
			for (const p of preds) {
				const { rows } = await this.db.query<{ id: number }>(
					`INSERT INTO prediction (run_id, fixture_id, market_id, selection, line, p_model, p_market_fair,
						odds_snapshot_id, best_odd, best_bookmaker_id, min_acceptable_odd, ev, is_recommendation, stake_units,
						confidence, features, explanation, warnings)
					 VALUES ($1, $2, $3, $4, $5::numeric, $6, $7, $8, $9::numeric, $10, $11::numeric, $12, $13, $14::numeric,
						$15, $16::jsonb, $17::jsonb, $18::jsonb)
					 RETURNING ${num('id')} AS id`,
					[
						runId,
						p.fixtureId,
						p.marketId,
						p.selection,
						p.line ?? null,
						p.pModel,
						p.pMarketFair ?? null,
						p.oddsSnapshotId ?? null,
						p.bestOdd ?? null,
						p.bestBookmakerId ?? null,
						p.minAcceptableOdd ?? null,
						p.ev ?? null,
						p.isRecommendation ?? false,
						p.stakeUnits ?? null,
						p.confidence ?? null,
						JSON.stringify(p.features ?? {}),
						JSON.stringify(p.explanation ?? []),
						JSON.stringify(p.warnings ?? [])
					]
				);
				ids.push(rows[0].id);
			}
			return ids;
		});
	}

	async listPredictions(filter: PredictionFilter = {}): Promise<Prediction[]> {
		const where: string[] = [];
		const params: unknown[] = [];
		if (filter.fixtureId !== undefined) {
			params.push(filter.fixtureId);
			where.push(`fixture_id = $${params.length}`);
		}
		if (filter.runId !== undefined) {
			params.push(filter.runId);
			where.push(`run_id = $${params.length}`);
		}
		const sql = `${PREDICTION_SELECT}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id`;
		return (await this.db.query<Prediction>(sql, params)).rows;
	}

	async countRows(table: CountableTable): Promise<number> {
		if (!(COUNTABLE_TABLES as readonly string[]).includes(table)) throw new Error(`Unknown table: ${table}`);
		const { rows } = await this.db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`);
		return rows[0].n;
	}

	/**
	 * Soronkénti upsert; a változatlan sor nem íródik (`WHERE … IS DISTINCT FROM`), így a 2. futás 0 írás.
	 * `xmax = 0` a RETURNING-ben: új sor (Postgres-specifikus, a Supabase-en is él).
	 * TODO(polish): több ezer sornál köteges (multi-VALUES) INSERT.
	 */
	private async upsert<T extends object>(spec: UpsertSpec<T>, rows: T[]): Promise<UpsertResult> {
		const result: UpsertResult = { inserted: 0, updated: 0, unchanged: 0 };
		if (!rows.length) return result;
		const columns = spec.cols.map((c) => c.column);
		const placeholders = spec.cols.map((c, i) => `$${i + 1}${c.cast ? `::${c.cast}` : ''}`);
		const data = spec.cols.filter((c) => !spec.key.includes(c.column)).map((c) => c.column);
		const set = [...data.map((c) => `${c} = EXCLUDED.${c}`), ...(spec.touch ? [spec.touch] : [])].join(', ');
		const changed = data.map((c) => `${spec.table}.${c}`).join(', ');
		const incoming = data.map((c) => `EXCLUDED.${c}`).join(', ');
		const sql = `INSERT INTO ${spec.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
			ON CONFLICT (${spec.key.join(', ')}) DO UPDATE SET ${set}
			WHERE (${changed}) IS DISTINCT FROM (${incoming})
			RETURNING (xmax = 0) AS inserted`;
		return this.transaction(async () => {
			for (const row of rows) {
				const params = spec.cols.map((c) => {
					const value = (row as Record<string, unknown>)[c.field];
					const v = value === undefined ? c.fallback ?? null : value;
					return c.json && v !== null ? JSON.stringify(v) : v;
				});
				const { rows: ret } = await this.db.query<{ inserted: boolean }>(sql, params);
				if (!ret[0]) result.unchanged++;
				else if (ret[0].inserted) result.inserted++;
				else result.updated++;
			}
			return result;
		});
	}

	private async transaction<R>(fn: () => Promise<R>): Promise<R> {
		await this.db.exec('BEGIN');
		try {
			const r = await fn();
			await this.db.exec('COMMIT');
			return r;
		} catch (err) {
			await this.db.exec('ROLLBACK');
			throw err;
		}
	}
}
