import type { ApiFootballClient } from '@football/api-client';
import { openMemoryRepository, SqlRepository, type SqlExecutor, type StoredTask } from '@football/db';
import { summarizeEvaluations } from '@football/core';
import { buildEvaluationRows, evaluateFixtures, loadEvaluationRecords, type EvaluationCandidate } from './evaluation';
import type { ApiFixtureItem } from './fixturesWindow';
import { createResultsHandler } from './results';

const K = '2024-05-19T15:00:00Z';
const FT = 1001; // 2–1 (rendes játékidő), O/U 2.5 → Over
const PST = 1002;

const cand = (o: Partial<EvaluationCandidate>): EvaluationCandidate => ({
	id: 1,
	run: 1,
	fx: FT,
	m: 1,
	sel: 'Home',
	line: null,
	p: 0.5,
	odd: 2,
	status: 'FT',
	gh: 2,
	ga: 1,
	...o
});

describe('buildEvaluationRows (tiszta)', () => {
	it('1X2 hazai győzelem: win/loss, flat profit, a piac Brier/log-lossa minden soron, CLV a záró oddsból', () => {
		const rows = buildEvaluationRows(
			[
				cand({ id: 1, sel: 'Home', p: 0.5, odd: 2.2 }),
				cand({ id: 2, sel: 'Draw', p: 0.3, odd: 3.4 }),
				cand({ id: 3, sel: 'Away', p: 0.2, odd: 3.6 })
			],
			new Map([[`${FT}:1:Home:`, { snapshotId: 9, odd: 2 }]])
		);
		expect(rows.map((r) => [r.prediction_id, r.outcome])).toEqual([
			[1, 'win'],
			[2, 'loss'],
			[3, 'loss']
		]);
		expect(rows[0].profit_units).toBeCloseTo(1.2);
		expect(rows[1].profit_units).toBe(-1);
		for (const r of rows) {
			expect(r.brier).toBeCloseTo(0.25 + 0.09 + 0.04);
			expect(r.log_loss).toBeCloseTo(-Math.log(0.5));
		}
		expect(rows[0]).toMatchObject({ closing_snapshot_id: 9, closing_odd: 2 });
		expect(rows[0].clv).toBeCloseTo(0.1);
		expect(rows[1]).toMatchObject({ closing_snapshot_id: null, clv: null });
	});

	it('Double Chance (12): 2–1 → 1X és 12 nyer, X2 veszít; Brier/log-loss null (nem kizáró kimenetek)', () => {
		const rows = buildEvaluationRows(
			[
				cand({ id: 1, m: 12, sel: 'Home/Draw', p: 0.8, odd: 1.3 }),
				cand({ id: 2, m: 12, sel: 'Home/Away', p: 0.75, odd: 1.35 }),
				cand({ id: 3, m: 12, sel: 'Draw/Away', p: 0.45, odd: 2.1 })
			],
			new Map([[`${FT}:12:Home/Draw:`, { snapshotId: 9, odd: 1.25 }]])
		);
		expect(rows.map((r) => [r.prediction_id, r.outcome, r.brier, r.log_loss])).toEqual([
			[1, 'win', null, null],
			[2, 'win', null, null],
			[3, 'loss', null, null]
		]);
		expect(rows[0].profit_units).toBeCloseTo(0.3);
		expect(rows[0].clv).toBeCloseTo(1.3 / 1.25 - 1);
		const voids = buildEvaluationRows([cand({ id: 4, m: 12, sel: 'Draw/Away', status: 'PST', gh: null, ga: null })], new Map());
		expect(voids.map((r) => r.outcome)).toEqual(['void']);
	});

	it('PST → void, 0 profit, nincs Brier/CLV; hiányos eloszlás → Brier null; ismeretlen piac kimarad', () => {
		const voids = buildEvaluationRows(
			[cand({ id: 1, status: 'PST', gh: null, ga: null }), cand({ id: 2, sel: 'Draw', status: 'PST', gh: null, ga: null })],
			new Map([[`${FT}:1:Home:`, { snapshotId: 9, odd: 2 }]])
		);
		expect(voids.map((r) => [r.outcome, r.profit_units, r.brier, r.clv])).toEqual([
			['void', 0, null, null],
			['void', 0, null, null]
		]);
		const partial = buildEvaluationRows([cand({ id: 1, m: 5, line: 2.5, sel: 'Over', p: 0.6, odd: 1.9 })], new Map());
		expect(partial).toMatchObject([{ outcome: 'win', brier: null, log_loss: null }]);
		expect(buildEvaluationRows([cand({ m: 99 })], new Map())).toEqual([]);
	});

	it('BTTS (8): 2–1 → Yes nyer, No veszít, teljes eloszlásból Brier', () => {
		const rows = buildEvaluationRows(
			[cand({ id: 1, m: 8, sel: 'Yes', p: 0.6, odd: 1.8 }), cand({ id: 2, m: 8, sel: 'No', p: 0.4, odd: 2.05 })],
			new Map([[`${FT}:8:Yes:`, { snapshotId: 9, odd: 1.7 }]])
		);
		expect(rows.map((r) => [r.prediction_id, r.outcome])).toEqual([
			[1, 'win'],
			[2, 'loss']
		]);
		expect(rows[0].profit_units).toBeCloseTo(0.8);
		expect(rows[0].brier).toBeCloseTo(0.16 + 0.16);
		expect(rows[0].closing_odd).toBe(1.7);
		const clean = buildEvaluationRows([cand({ m: 8, sel: 'Yes', gh: 3, ga: 0 })], new Map());
		expect(clean[0].outcome).toBe('loss');
	});
});

/** Liga, szezon, 2 meccs (NS), modell + futás + 2×5 predikció; egy korai snapshot (a predikcióé) és egy záró-közeli. */
async function seed(db: SqlExecutor) {
	await db.exec(`INSERT INTO league (id, name) VALUES (39, 'Premier League'); INSERT INTO season (league_id, year) VALUES (39, 2023);
		INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C'), (4, 'D');
		INSERT INTO bookmaker (id, name, stored) VALUES (16, 'Unibet', true), (8, 'Bet365', true);
		INSERT INTO market (id, name, stored) VALUES (1, 'Match Winner', true), (5, 'Goals Over/Under', true);
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id)
			VALUES (${FT}, 39, 2023, '${K}', 'NS', 1, 2), (${PST}, 39, 2023, '${K}', 'NS', 3, 4);
		INSERT INTO model_version (id) VALUES ('elo-poisson@test');
		INSERT INTO prediction_run (model_version, trigger) VALUES ('elo-poisson@test', 'manual');`);
	const repo = new SqlRepository(db);
	const snap = (capturedAt: string, home: number, over: number) =>
		[FT, PST].map((fixtureId) => ({
			fixtureId,
			capturedAt,
			source: 'api-football' as const,
			kind: 'late' as const,
			quotes: [16, 8].flatMap((bookmakerId, b) => [
				...['Home', 'Draw', 'Away'].map((selection, k) => ({
					bookmakerId,
					marketId: 1,
					selection,
					line: null,
					odd: [home - b * 0.1, 3.4, 3.5][k]
				})),
				...['Over', 'Under'].map((selection, k) => ({ bookmakerId, marketId: 5, selection, line: 2.5, odd: [over, 1.9][k] }))
			])
		}));
	await repo.insertOddsSnapshots(snap('2024-05-18T15:00:00Z', 2.2, 2.0));
	await repo.insertOddsSnapshots(snap('2024-05-19T14:30:00Z', 2.0, 1.8));
	await repo.insertOddsSnapshots(snap('2024-05-19T16:00:00Z', 9, 9)); // kezdés utáni: nem záró
	await db.exec(`INSERT INTO prediction (run_id, fixture_id, market_id, selection, line, p_model, odds_snapshot_id, best_odd)
		SELECT 1, f, m, s, l, p, (SELECT min(id) FROM odds_snapshot WHERE fixture_id = f), o
		FROM (VALUES (1, 'Home', NULL::numeric, 0.5, 2.2), (1, 'Draw', NULL, 0.3, 3.4), (1, 'Away', NULL, 0.2, 3.5),
			(5, 'Over', 2.5, 0.55, 2.0), (5, 'Under', 2.5, 0.45, 1.9)) AS v (m, s, l, p, o),
			(VALUES (${FT}), (${PST})) AS fx (f)`);
}

const item = (id: number, status: string, home: number, away: number, goals: [number, number] | null): ApiFixtureItem => ({
	fixture: { id, date: K, status: { short: status } },
	league: { id: 39, season: 2023 },
	teams: { home: { id: home, name: String(home) }, away: { id: away, name: String(away) } },
	goals: { home: goals?.[0] ?? null, away: goals?.[1] ?? null },
	score: goals ? { fulltime: { home: goals[0], away: goals[1] } } : {}
});

const evaluations = async (db: SqlExecutor) =>
	(
		await db.query<{
			fx: number;
			sel: string;
			outcome: string;
			profit: number;
			brier: number | null;
			clv: number | null;
			co: number | null;
		}>(
			`SELECT p.fixture_id::float8 AS fx, p.selection AS sel, e.outcome, e.profit_units AS profit, e.brier, e.clv,
				e.closing_odd::float8 AS co
			 FROM evaluation e JOIN prediction p ON p.id = e.prediction_id ORDER BY p.id`
		)
	).rows;

describe('kiértékelő job (friss memória-PGlite, 0 élő hívás)', () => {
	it('a results után: FT → win/loss + CLV a kezdés előtti utolsó snapshotból, PST → void; ismételt futás nem duplikál', async () => {
		const { db } = await openMemoryRepository();
		await seed(db);
		const client = {
			mode: 'mock',
			get: async () => ({ response: [item(FT, 'FT', 1, 2, [2, 1]), item(PST, 'PST', 3, 4, null)] })
		} as unknown as ApiFootballClient;
		const task = { id: 1, params: { ids: [FT, PST] } } as unknown as StoredTask;
		const handler = createResultsHandler(db);
		const now = new Date('2024-05-19T18:00:00Z');
		await handler(task, { now, client });

		const rows = await evaluations(db);
		expect(rows).toHaveLength(10);
		const ft = rows.filter((r) => r.fx === FT);
		expect(ft.map((r) => [r.sel, r.outcome])).toEqual([
			['Home', 'win'],
			['Draw', 'loss'],
			['Away', 'loss'],
			['Over', 'win'],
			['Under', 'loss']
		]);
		expect(ft[0].profit).toBeCloseTo(1.2);
		expect(ft[0].co).toBe(2); // a 14:30-as snapshot legjobbja, nem a kezdés utáni
		expect(ft[0].clv).toBeCloseTo(0.1);
		expect(ft[3].clv).toBeCloseTo(2 / 1.8 - 1);
		expect(ft[0].brier).toBeCloseTo(0.38);
		expect(rows.filter((r) => r.fx === PST).every((r) => r.outcome === 'void' && r.profit === 0 && r.brier === null)).toBe(true);

		await handler(task, { now: new Date('2024-05-20T18:00:00Z'), client });
		expect(await evaluateFixtures(db, [FT, PST], { now })).toBe(0);
		expect(await evaluations(db)).toEqual(rows);

		// I17: a dashboard-összesítés csoportonként EGY sorral számolja a Brier-t (1X2: 0.38, O/U 2.5: 0.405; void: null).
		const records = await loadEvaluationRecords(db);
		expect(records).toHaveLength(10);
		expect(records[0]).toMatchObject({ modelVersion: 'elo-poisson@test', fixtureId: FT, line: null, odd: 2.2, closingOdd: 2 });
		const s = summarizeEvaluations(records);
		expect(s.predictions.groups).toBe(2);
		expect(s.predictions.meanBrier).toBeCloseTo((0.38 + 0.405) / 2); // sorsúlyozva 0.39 lenne
		expect(s.bets.n).toBe(0); // a seedben nincs is_recommendation
	});

	it('még nem lezárt meccsre nem ír', async () => {
		const { db } = await openMemoryRepository();
		await seed(db);
		expect(await evaluateFixtures(db, [FT, PST], { now: new Date(K) })).toBe(0);
		expect(await evaluateFixtures(db, [], { now: new Date(K) })).toBe(0);
	});
});
