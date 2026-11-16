import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ELO_POISSON_VERSION } from '@football/core';
import { openMemoryRepository, SqlRepository, type SqlExecutor } from '@football/db';
import { toFixtureRows, upsertFixtureRows, type ApiFixtureItem } from './fixturesWindow';
import { createDbIngestWorker } from './ingestWorker';
import { runPredictions } from './predictions';
import { upsertTeams } from './reference';
import { withOdds } from './referenceMocks';
import { refreshStandingDerived } from './standingDerived';
import type { ApiOddsItem } from './odds';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const HOUR = 3_600_000;
const DAY = '2024-11-02'; // 7 PL-meccs egy UTC-napon (mentett 2024-es szezon)

const asItems = <T>(json: unknown) =>
	(Array.isArray(json) ? json : (json as { response?: T[]; odds?: T[] }).response ?? (json as { odds: T[] }).odds) as T[];
const savedSeason = async () =>
	asItems<ApiFixtureItem>(JSON.parse(await readFile(`${ROOT}data/history/api-football/fixtures-39-2024.json`, 'utf8')));

/** A PL 2024 a `DAY` előtt lejátszva (FT), a `DAY` meccsei NS-ként; liga, szezon, követés, piacok, irodák. */
async function seed(db: SqlExecutor) {
	const items = (await savedSeason()).filter((i) => i.fixture!.date!.slice(0, 10) <= DAY);
	const target = items.filter((i) => i.fixture!.date!.startsWith(DAY));
	await db.exec(`INSERT INTO league (id, name) VALUES (39, 'Premier League'); INSERT INTO season (league_id, year) VALUES (39, 2024);
		INSERT INTO followed_league (league_id) VALUES (39);
		INSERT INTO bookmaker (id, name, stored) VALUES (16, 'Unibet', true), (8, 'Bet365', true), (4, 'Pinnacle', true);
		INSERT INTO market (id, name, stored) VALUES (1, 'Match Winner', true), (5, 'Goals Over/Under', true);`);
	const src = items.map((i) =>
		i.fixture!.date!.startsWith(DAY)
			? { ...i, fixture: { ...i.fixture, status: { short: 'NS' } }, goals: { home: null, away: null }, score: {} }
			: i
	);
	const { fixtures, teams } = toFixtureRows(src as ApiFixtureItem[]);
	await upsertTeams(db, teams);
	await upsertFixtureRows(db, fixtures);
	await refreshStandingDerived(db, 39, 2024);
	return {
		items,
		target,
		ids: target.map((i) => i.fixture!.id!),
		t0: Math.min(...target.map((i) => Date.parse(i.fixture!.date!)))
	};
}

/** Egy snapshot a meccsekre: 3 iroda, 1X2 + O/U 2.5 (a Bet365 a hazaira a legjobb). */
async function seedOdds(db: SqlExecutor, ids: readonly number[], capturedAt: string) {
	const books: [number, number[], number[]][] = [
		[16, [2.1, 3.4, 3.6], [1.9, 1.95]],
		[8, [2.25, 3.3, 3.4], [1.85, 2.0]],
		[4, [2.15, 3.5, 3.5], [1.93, 1.97]]
	];
	await new SqlRepository(db).insertOddsSnapshots(
		ids.map((fixtureId) => ({
			fixtureId,
			capturedAt,
			source: 'api-football' as const,
			kind: 'late' as const,
			quotes: books.flatMap(([bookmakerId, h2h, ou]) => [
				...['Home', 'Draw', 'Away'].map((selection, k) => ({ bookmakerId, marketId: 1, selection, line: null, odd: h2h[k] })),
				...['Over', 'Under'].map((selection, k) => ({ bookmakerId, marketId: 5, selection, line: 2.5, odd: ou[k] }))
			])
		}))
	);
}

const predictionRows = async (db: SqlExecutor) =>
	(await db.query<Record<string, unknown>>('SELECT * FROM prediction ORDER BY id')).rows.map((r) => JSON.stringify(r));

// Teljes PL-szezon seed + két futás: a párhuzamos suite alatt az 5 s-os alap kevés lehet.
describe('predikció-pipeline (friss memória-PGlite, mentett PL 2024, 0 élő hívás)', { timeout: 30_000 }, () => {
	it('ugyanarra a snapshotra két futás két run; a régi sorok nem változnak; append-only', async () => {
		const { db } = await openMemoryRepository();
		const { ids, t0 } = await seed(db);
		const now = new Date(t0 - 2 * HOUR);
		await seedOdds(db, ids, new Date(t0 - 3 * HOUR).toISOString());

		const r1 = await runPredictions(db, ids, { now });
		expect(r1.runId).not.toBeNull();
		expect(r1.predictions).toBe(ids.length * 5);
		const first = await predictionRows(db);

		const r2 = await runPredictions(db, ids, { now });
		expect(r2.runId).not.toBe(r1.runId);
		expect(r2.predictions).toBe(r1.predictions);
		expect((await predictionRows(db)).slice(0, first.length)).toEqual(first);

		const runs = (await db.query<{ mv: string; trigger: string }>('SELECT model_version AS mv, trigger FROM prediction_run'))
			.rows;
		expect(runs).toEqual([
			{ mv: ELO_POISSON_VERSION, trigger: 'schedule' },
			{ mv: ELO_POISSON_VERSION, trigger: 'schedule' }
		]);
		const mv = (await db.query<{ params: { model: unknown; rules: unknown } }>('SELECT params FROM model_version')).rows;
		expect(mv).toHaveLength(1);
		expect(mv[0].params.model).toBeTruthy();
		await expect(db.query('UPDATE prediction SET ev = 0')).rejects.toThrow(/append-only/);
		await expect(db.query('DELETE FROM prediction')).rejects.toThrow(/append-only/);
	});

	it('kimenetenként Σp = 1, legjobb odds + iroda, feature-snapshot a derived tabellával; meccsenként ≤ 1 ajánlás', async () => {
		const { db } = await openMemoryRepository();
		const { ids, t0, items } = await seed(db);
		const now = new Date(t0 - 2 * HOUR);
		await seedOdds(db, ids, new Date(t0 - 3 * HOUR).toISOString());
		await runPredictions(db, ids, { now });

		const rows = (
			await db.query<{
				f: number;
				m: number;
				sel: string;
				p: number;
				best: number;
				bk: number;
				rec: boolean;
				features: { standing: { asOf: string; home: { played: number } }; model: unknown; match: unknown; odds: unknown };
				explanation: string[];
			}>(
				`SELECT fixture_id::float8 AS f, market_id::float8 AS m, selection AS sel, p_model AS p, best_odd::float8 AS best,
					best_bookmaker_id::float8 AS bk, is_recommendation AS rec, features, explanation FROM prediction`
			)
		).rows;
		for (const id of ids) {
			for (const m of [1, 5]) {
				const sum = rows.filter((r) => r.f === id && r.m === m).reduce((s, r) => s + r.p, 0);
				expect(sum).toBeCloseTo(1, 9);
			}
			expect(rows.filter((r) => r.f === id && r.rec).length).toBeLessThanOrEqual(1);
		}
		const home = rows.find((r) => r.m === 1 && r.sel === 'Home')!;
		expect([home.best, home.bk]).toEqual([2.25, 8]);
		expect(home.explanation.length).toBeGreaterThan(1);
		// Pont-idejű tabella: a meccsnap UTC-éjfelénél ≤ utolsó as_of; a hazai csapat előtte lejátszott meccsei.
		// A DAY meccsei még NS-ek, így az utolsó as_of az előző meccsnap utáni éjfél (≤ a DAY éjfele).
		expect(home.features.standing.asOf).toBe('2024-10-28T00:00:00.000Z');
		const fx = items.find((i) => i.fixture!.id === home.f)!;
		const before = items.filter(
			(i) =>
				i.fixture!.date! < `${DAY}T00:00:00` &&
				(i.fixture as { status?: { short?: string } }).status?.short === 'FT' &&
				[i.teams!.home!.id, i.teams!.away!.id].includes(fx.teams!.home!.id)
		).length;
		expect(home.features.standing.home.played).toBe(before);
		expect(home.features.model).toBeTruthy();
		expect(home.features.match).toBeTruthy();
	});

	it('odds nélkül, elkezdett meccsre vagy üres listára nincs futás', async () => {
		const { db } = await openMemoryRepository();
		const { ids, t0 } = await seed(db);
		expect(await runPredictions(db, ids, { now: new Date(t0 - 2 * HOUR) })).toMatchObject({ runId: null, predictions: 0 });
		await seedOdds(db, ids, new Date(t0 - 3 * HOUR).toISOString());
		expect((await runPredictions(db, ids, { now: new Date(t0 + HOUR) })).predictions).toBeLessThan(ids.length * 5);
		expect((await runPredictions(db, [], { now: new Date(t0 - 2 * HOUR) })).runId).toBeNull();
	});

	it('a workerben az odds-snapshot után fut (derive), mock odds-szal', async () => {
		const { db } = await openMemoryRepository();
		const { items, ids, t0 } = await seed(db);
		const odds = asItems<ApiOddsItem>(JSON.parse(await readFile(`${ROOT}backend/stores/england-odds.json`, 'utf8')));
		const fixtures = withOdds({}, [{ league: 39, season: 2024, items }], odds);
		const now = t0 - 2 * HOUR;
		await createDbIngestWorker(db, { fixtures })({ now: new Date(now), deadline: new Date(now + 60_000) });
		const snaps = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM odds_snapshot')).rows[0].n;
		expect(snaps).toBeGreaterThan(0);
		const runs = (await db.query<{ n: number }>('SELECT count(*)::int AS n FROM prediction_run')).rows[0].n;
		const preds = (await db.query<{ f: number }>('SELECT DISTINCT fixture_id::float8 AS f FROM prediction')).rows.map((r) => r.f);
		expect(runs).toBe(1);
		expect(preds.length).toBeGreaterThan(0);
		expect(preds.every((f) => ids.includes(f))).toBe(true);
	});
});
