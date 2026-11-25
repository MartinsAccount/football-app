import { PGlite } from '@electric-sql/pglite';
import { loadMigrations, migrate } from './migrate';

const TABLES = [
	'league',
	'season',
	'team',
	'team_alias',
	'season_team',
	'bookmaker',
	'market',
	'fixture',
	'fixture_team_stats',
	'fixture_event',
	'standing_snapshot',
	'injury_report',
	'odds_snapshot',
	'odds_quote',
	'odds_best',
	'model_version',
	'prediction_run',
	'prediction',
	'evaluation',
	'placed_bet',
	'followed_league',
	'team_filter',
	'setting',
	'ingest_task',
	'api_budget_day',
	'api_call_log',
	'api_raw_response'
];

async function freshDb(): Promise<PGlite> {
	const db = new PGlite();
	await migrate(db);
	return db;
}

async function seedPrediction(db: PGlite): Promise<number> {
	await db.exec(`
		INSERT INTO league (id, name, country, type) VALUES (39, 'Premier League', 'England', 'league');
		INSERT INTO team (id, name) VALUES (1, 'Home FC'), (2, 'Away FC');
		INSERT INTO market (id, name, code) VALUES (1, 'Match Winner', 'Vegeredmeny');
		INSERT INTO bookmaker (id, name, stored) VALUES (8, 'Bet365', true);
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id)
			VALUES (100, 39, 2024, '2024-08-17T14:00:00Z', 'FT', 1, 2);
		INSERT INTO odds_snapshot (fixture_id, captured_at, source, kind) VALUES (100, '2024-08-17T08:00:00Z', 'manual', 'adhoc');
		INSERT INTO model_version (id) VALUES ('elo-poisson@0.1.0');
		INSERT INTO prediction_run (model_version, trigger) VALUES ('elo-poisson@0.1.0', 'backtest');
	`);
	const { rows } = await db.query<{ id: number }>(
		`INSERT INTO prediction (run_id, fixture_id, market_id, selection, p_model, odds_snapshot_id)
		 VALUES (1, 100, 1, 'Home', 0.5, 1) RETURNING id`
	);
	return rows[0].id;
}

describe('migrations', () => {
	it('run on an empty database and create every table', async () => {
		const db = await freshDb();
		const { rows } = await db.query<{ table_name: string }>(
			`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
		);
		const names = rows.map((r) => r.table_name);
		for (const t of TABLES) expect(names).toContain(t);
	});

	it('are idempotent: the runner skips applied files, and raw re-execution also succeeds', async () => {
		const db = await freshDb();
		expect(await migrate(db)).toEqual([]);
		for (const m of loadMigrations()) await db.exec(m.sql);
		const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM setting');
		expect(rows[0].n).toBe(8);
	});

	it('refuse a migration that changed after it was applied', async () => {
		const db = await freshDb();
		const changed = loadMigrations().map((m, i) => (i === 0 ? { ...m, checksum: 'x' } : m));
		await expect(migrate(db, changed)).rejects.toThrow(/changed/);
	});
});

describe('prediction is append-only', () => {
	it('rejects UPDATE and DELETE', async () => {
		const db = await freshDb();
		const id = await seedPrediction(db);
		await expect(db.query('UPDATE prediction SET p_model = 0.9 WHERE id = $1', [id])).rejects.toThrow(/append-only/);
		await expect(db.query('DELETE FROM prediction WHERE id = $1', [id])).rejects.toThrow(/append-only/);
	});

	it('allows deleting the referenced odds snapshot (only the reference is nulled)', async () => {
		const db = await freshDb();
		const id = await seedPrediction(db);
		await db.exec('DELETE FROM odds_snapshot WHERE id = 1');
		const { rows } = await db.query<{ odds_snapshot_id: number | null; p_model: number }>(
			'SELECT odds_snapshot_id, p_model FROM prediction WHERE id = $1',
			[id]
		);
		expect(rows[0]).toEqual({ odds_snapshot_id: null, p_model: 0.5 });
	});

	it('treats a NULL line as one value in the unique key', async () => {
		const db = await freshDb();
		await seedPrediction(db);
		await expect(
			db.query(`INSERT INTO prediction (run_id, fixture_id, market_id, selection, p_model) VALUES (1, 100, 1, 'Home', 0.4)`)
		).rejects.toThrow(/unique/i);
	});
});

describe('api_budget_reserve', () => {
	const reserve = async (db: PGlite, cap: number | null = null) =>
		(await db.query<{ used: number | null }>(`SELECT api_budget_reserve('2026-11-12', $1) AS used`, [cap])).rows[0].used;

	it('never lets the daily counter exceed 100', async () => {
		const db = await freshDb();
		const results: (number | null)[] = [];
		for (let i = 0; i < 105; i++) results.push(await reserve(db));
		expect(results[0]).toBe(1);
		expect(results[99]).toBe(100);
		expect(results.slice(100)).toEqual([null, null, null, null, null]);
		await expect(db.exec(`UPDATE api_budget_day SET daily_limit = 150`)).rejects.toThrow();
	});

	it('honours the reserve, the backfill cap and the synced remaining quota', async () => {
		const db = await freshDb();
		await db.exec(`INSERT INTO api_budget_day (day, used, reserve) VALUES ('2026-11-12', 69, 10)`);
		expect(await reserve(db, 70)).toBe(70);
		expect(await reserve(db, 70)).toBeNull();
		await db.exec(`UPDATE api_budget_day SET used = 89`);
		expect(await reserve(db)).toBe(90);
		expect(await reserve(db)).toBeNull();
		await db.exec(`UPDATE api_budget_day SET used = 0, synced_remaining = 1`);
		expect(await reserve(db)).toBe(1);
		expect(await reserve(db)).toBeNull();
	});
});
