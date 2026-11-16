import type { PGlite } from '@electric-sql/pglite';
import { openMemoryRepository } from './memory';
import type { SqlRepository } from './sqlRepository';
import type { Fixture, OddsSnapshotInput } from './types';

const FIXTURES: Fixture[] = [
	{
		id: 100,
		leagueId: 39,
		season: 2024,
		kickoffAt: '2024-08-17T14:00:00Z',
		status: 'FT',
		homeTeamId: 1,
		awayTeamId: 2,
		goalsHome: 2,
		goalsAway: 1
	},
	{ id: 101, leagueId: 39, season: 2024, kickoffAt: '2024-08-24T14:00:00Z', status: 'NS', homeTeamId: 2, awayTeamId: 1 },
	{ id: 102, leagueId: 39, season: 2023, kickoffAt: '2023-08-12T14:00:00Z', status: 'FT', homeTeamId: 1, awayTeamId: 2 }
];

const SNAPSHOT: OddsSnapshotInput = {
	fixtureId: 100,
	capturedAt: '2024-08-17T08:00:00Z',
	source: 'legacy-json',
	kind: 'legacy',
	quotes: [
		{ bookmakerId: 8, marketId: 1, selection: 'Home', odd: 2.1 },
		{ bookmakerId: 8, marketId: 1, selection: 'Draw', odd: 3.4 },
		{ bookmakerId: 8, marketId: 1, selection: 'Away', odd: 3.75 },
		{ bookmakerId: 8, marketId: 5, selection: 'Over', line: 2.5, odd: 1.9 }
	]
};

async function seeded(): Promise<{ db: PGlite; repo: SqlRepository }> {
	const { db, repo } = await openMemoryRepository();
	await repo.upsertLeagues([{ id: 39, name: 'Premier League', country: 'England', type: 'league' }]);
	await repo.upsertSeasons([
		{ leagueId: 39, year: 2023 },
		{ leagueId: 39, year: 2024, isCurrent: true }
	]);
	await repo.upsertTeams([
		{ id: 1, name: 'Home FC' },
		{ id: 2, name: 'Away FC' }
	]);
	await repo.upsertBookmakers([{ id: 8, name: 'Bet365', stored: true }]);
	await repo.upsertMarkets([
		{ id: 1, name: 'Match Winner', code: 'Vegeredmeny' },
		{ id: 5, name: 'Goals Over/Under' }
	]);
	await repo.upsertFixtures(FIXTURES);
	return { db, repo };
}

describe('upsert idempotency', () => {
	it('writes nothing on the second identical run', async () => {
		const { repo } = await seeded();
		expect(await repo.upsertFixtures(FIXTURES)).toEqual({ inserted: 0, updated: 0, unchanged: 3 });
		expect(await repo.upsertTeams([{ id: 1, name: 'Home FC' }])).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
		expect(await repo.countRows('fixture')).toBe(3);
	});

	it('counts new and changed rows separately', async () => {
		const { repo } = await seeded();
		const changed = { ...FIXTURES[1], status: 'FT', goalsHome: 0, goalsAway: 0 };
		const added = { ...FIXTURES[1], id: 103, kickoffAt: '2024-09-01T14:00:00Z' };
		expect(await repo.upsertFixtures([FIXTURES[0], changed, added])).toEqual({ inserted: 1, updated: 1, unchanged: 1 });
		expect((await repo.getFixture(101))?.status).toBe('FT');
	});

	it('rolls back the whole batch when a row violates a constraint', async () => {
		const { repo } = await seeded();
		const bad = { ...FIXTURES[0], id: 104, awayTeamId: 1, homeTeamId: 1 };
		await expect(repo.upsertFixtures([{ ...FIXTURES[0], id: 105 }, bad])).rejects.toThrow();
		expect(await repo.getFixture(105)).toBeNull();
	});
});

describe('fixtures', () => {
	it('round-trips a fixture with ISO kickoff and numeric ids', async () => {
		const { repo } = await seeded();
		expect(await repo.getFixture(100)).toEqual({
			...FIXTURES[0],
			round: null,
			htHome: null,
			htAway: null,
			ftHome: null,
			ftAway: null,
			referee: null
		});
		expect(await repo.getFixture(999)).toBeNull();
	});

	it('filters by league, season, status and kickoff window', async () => {
		const { repo } = await seeded();
		const ids = async (f: Parameters<SqlRepository['listFixtures']>[0]) => (await repo.listFixtures(f)).map((x) => x.id);
		expect(await ids({})).toEqual([102, 100, 101]);
		expect(await ids({ leagueId: 39, season: 2024 })).toEqual([100, 101]);
		expect(await ids({ status: ['NS'] })).toEqual([101]);
		expect(await ids({ from: '2024-08-01T00:00:00Z', to: '2024-08-20T00:00:00Z' })).toEqual([100]);
	});
});

describe('odds snapshots', () => {
	it('inserts a snapshot with its quotes once; the same key again is a no-op', async () => {
		const { repo } = await seeded();
		const first = await repo.insertOddsSnapshot(SNAPSHOT);
		const second = await repo.insertOddsSnapshot(SNAPSHOT);
		expect(first.created).toBe(true);
		expect(second).toEqual({ id: first.id, created: false });
		expect(await repo.countRows('odds_quote')).toBe(4);
	});

	it('returns the latest snapshot with numeric odds and lines', async () => {
		const { repo } = await seeded();
		await repo.insertOddsSnapshot(SNAPSHOT);
		await repo.insertOddsSnapshot({ ...SNAPSHOT, capturedAt: '2024-08-17T12:00:00Z', quotes: [SNAPSHOT.quotes[0]] });
		const latest = await repo.getLatestOdds(100);
		expect(latest?.capturedAt).toBe('2024-08-17T12:00:00Z');
		expect(latest?.quotes).toEqual([{ ...SNAPSHOT.quotes[0], line: null }]);
		expect(await repo.getLatestOdds(101)).toBeNull();
	});

	it('lists the odds history in capture order, each snapshot with its own quotes', async () => {
		const { repo } = await seeded();
		await repo.insertOddsSnapshot({ ...SNAPSHOT, capturedAt: '2024-08-17T12:00:00Z', quotes: [SNAPSHOT.quotes[0]] });
		await repo.insertOddsSnapshot(SNAPSHOT);
		const history = await repo.listOdds(100);
		expect(history.map((s) => s.capturedAt)).toEqual([SNAPSHOT.capturedAt, '2024-08-17T12:00:00Z']);
		expect(history.map((s) => s.quotes.length)).toEqual([SNAPSHOT.quotes.length, 1]);
		expect(await repo.listOdds(101)).toEqual([]);
	});

	it('lists teams, optionally by id', async () => {
		const { repo } = await seeded();
		expect((await repo.listTeams()).map((t) => t.name)).toEqual(['Home FC', 'Away FC']);
		expect(await repo.listTeams([2, 999])).toEqual([{ id: 2, name: 'Away FC', code: null, country: null, logoUrl: null }]);
	});

	it('batch insert: same semantics as the single path, duplicates and existing keys are no-ops', async () => {
		const { repo } = await seeded();
		await repo.insertOddsSnapshot(SNAPSHOT);
		const later = { ...SNAPSHOT, capturedAt: '2024-08-17T12:00:00Z', quotes: [SNAPSHOT.quotes[0]] };
		const r = await repo.insertOddsSnapshots([SNAPSHOT, later, later]);
		expect(r).toEqual({ created: 1, existing: 2, quotes: 1 });
		expect(await repo.countRows('odds_snapshot')).toBe(2);
		expect(await repo.countRows('odds_quote')).toBe(5);
		expect((await repo.getLatestOdds(100))?.quotes).toEqual([{ ...SNAPSHOT.quotes[0], line: null }]);
		expect(await repo.insertOddsSnapshots([SNAPSHOT, later])).toEqual({ created: 0, existing: 2, quotes: 0 });
		expect(await repo.insertOddsSnapshots([])).toEqual({ created: 0, existing: 0, quotes: 0 });
	});

	it('batch insert rolls back the whole batch when a quote is invalid', async () => {
		const { repo } = await seeded();
		const bad = {
			...SNAPSHOT,
			capturedAt: '2024-08-17T12:00:00Z',
			quotes: [{ bookmakerId: 8, marketId: 1, selection: 'X', odd: 0.9 }]
		};
		await expect(repo.insertOddsSnapshots([SNAPSHOT, bad])).rejects.toThrow();
		expect(await repo.countRows('odds_snapshot')).toBe(0);
	});

	it('rolls back the snapshot when a quote is invalid', async () => {
		const { repo } = await seeded();
		const bad = { ...SNAPSHOT, quotes: [...SNAPSHOT.quotes, { bookmakerId: 8, marketId: 1, selection: 'X', odd: 0.9 }] };
		await expect(repo.insertOddsSnapshot(bad)).rejects.toThrow();
		expect(await repo.countRows('odds_snapshot')).toBe(0);
		expect(await repo.countRows('odds_quote')).toBe(0);
	});
});

describe('predictions', () => {
	async function withRun() {
		const ctx = await seeded();
		await ctx.repo.ensureModelVersion({ id: 'elo-poisson@0.1.0', params: { k: 20 } });
		await ctx.repo.ensureModelVersion({ id: 'elo-poisson@0.1.0', params: { k: 20 } });
		const runId = await ctx.repo.createPredictionRun({
			modelVersion: 'elo-poisson@0.1.0',
			trigger: 'backtest',
			asOf: '2024-08-16T00:00:00Z'
		});
		return { ...ctx, runId };
	}

	it('appends predictions and reads them back with JSON fields', async () => {
		const { repo, runId } = await withRun();
		const ids = await repo.appendPredictions(runId, [
			{
				fixtureId: 100,
				marketId: 1,
				selection: 'Home',
				pModel: 0.52,
				bestOdd: 2.1,
				features: { elo: 1550 },
				explanation: ['forma']
			},
			{ fixtureId: 100, marketId: 5, selection: 'Over', line: 2.5, pModel: 0.55 }
		]);
		expect(ids).toHaveLength(2);
		const preds = await repo.listPredictions({ fixtureId: 100 });
		expect(preds.map((p) => [p.selection, p.line, p.bestOdd])).toEqual([
			['Home', null, 2.1],
			['Over', 2.5, null]
		]);
		expect(preds[0]).toMatchObject({
			runId,
			pModel: 0.52,
			isRecommendation: false,
			features: { elo: 1550 },
			explanation: ['forma'],
			warnings: []
		});
		expect(await repo.listPredictions({ runId: runId + 1 })).toEqual([]);
	});

	it('rejects a duplicate prediction and keeps the batch atomic', async () => {
		const { repo, runId } = await withRun();
		await repo.appendPredictions(runId, [{ fixtureId: 100, marketId: 1, selection: 'Home', pModel: 0.5 }]);
		await expect(
			repo.appendPredictions(runId, [
				{ fixtureId: 100, marketId: 1, selection: 'Draw', pModel: 0.3 },
				{ fixtureId: 100, marketId: 1, selection: 'Home', pModel: 0.4 }
			])
		).rejects.toThrow(/unique/i);
		expect(await repo.countRows('prediction')).toBe(1);
	});

	it('keeps the prediction append-only at the DB level too', async () => {
		const { db, repo, runId } = await withRun();
		const [id] = await repo.appendPredictions(runId, [{ fixtureId: 100, marketId: 1, selection: 'Home', pModel: 0.5 }]);
		await expect(db.query('UPDATE prediction SET p_model = 0.9 WHERE id = $1', [id])).rejects.toThrow(/append-only/);
	});

	it('upserts the evaluation separately from the prediction', async () => {
		const { repo, runId } = await withRun();
		const [id] = await repo.appendPredictions(runId, [{ fixtureId: 100, marketId: 1, selection: 'Home', pModel: 0.5 }]);
		const ev = {
			predictionId: id,
			settledAt: '2024-08-17T16:00:00Z',
			outcome: 'win' as const,
			profitUnits: 1.1,
			closingOdd: 2.05
		};
		expect(await repo.upsertEvaluation(ev)).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
		expect(await repo.upsertEvaluation(ev)).toEqual({ inserted: 0, updated: 0, unchanged: 1 });
		expect(await repo.upsertEvaluation({ ...ev, clv: 0.02 })).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
	});
});

describe('countRows', () => {
	it('refuses a table outside the whitelist', async () => {
		const { repo } = await openMemoryRepository();
		await expect(repo.countRows('setting; DROP TABLE fixture' as never)).rejects.toThrow(/Unknown table/);
	});
});
