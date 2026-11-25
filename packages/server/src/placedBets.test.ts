import { SqlBudgetStore } from '@football/api-client';
import { ApiError, createApiClient, type ApiClient } from '@football/contract';
import { openMemoryRepository, SqlPlacedBetRepository } from '@football/db';
import { loadEvaluationRecords } from './evaluation';
import { parsePlacedBetInput, PlacedBetValidationError } from './placedBets';
import { createApiHandler, type ApiHandler } from './router';

describe('parsePlacedBetInput', () => {
	const ok = { fixtureId: 1, marketId: 1, selection: ' Home ', oddTaken: 2.05, stake: 500 };

	it('alapértékek: line/predikció null, iroda Tippmix, időpont ISO', () => {
		expect(parsePlacedBetInput(ok)).toEqual({
			fixtureId: 1,
			marketId: 1,
			selection: 'Home',
			line: null,
			oddTaken: 2.05,
			stake: 500,
			predictionId: null,
			bookmakerLabel: 'Tippmix',
			placedAt: null,
			note: null
		});
		expect(parsePlacedBetInput({ ...ok, placedAt: '2024-05-01T12:00:00+02:00', bookmakerLabel: null }).placedAt).toBe(
			'2024-05-01T10:00:00.000Z'
		);
	});

	it.each([
		[null],
		[[]],
		[{ ...ok, fixtureId: 0 }],
		[{ ...ok, marketId: '1' }],
		[{ ...ok, selection: '' }],
		[{ ...ok, oddTaken: 1 }],
		[{ ...ok, oddTaken: 10000 }],
		[{ ...ok, stake: 0 }],
		[{ ...ok, line: 'x' }],
		[{ ...ok, predictionId: 1.5 }],
		[{ ...ok, placedAt: 'tegnap' }],
		[{ ...ok, note: 5 }]
	])('hibás bemenet → PlacedBetValidationError (%#)', (body) => {
		expect(() => parsePlacedBetInput(body)).toThrow(PlacedBetValidationError);
	});
});

describe('bets API (I23)', () => {
	let client: ApiClient;
	let h: ApiHandler;

	beforeAll(async () => {
		const { db, repo } = await openMemoryRepository();
		await db.exec(`
			INSERT INTO league (id, name) VALUES (39, 'Premier League');
			INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B');
			INSERT INTO market (id, name) VALUES (1, 'Match Winner'), (5, 'Goals Over/Under');
			INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id, ft_home, ft_away)
				VALUES (1001, 39, 2024, '2024-05-02T15:00:00Z', 'FT', 1, 2, 0, 3);
			INSERT INTO model_version (id) VALUES ('elo-poisson@test');
			INSERT INTO prediction_run (model_version, trigger) VALUES ('elo-poisson@test', 'manual');
			INSERT INTO prediction (run_id, fixture_id, market_id, selection, line, p_model, best_odd, is_recommendation)
				VALUES (1, 1001, 5, 'Over', 2.5, 0.6, 1.9, true);
			INSERT INTO evaluation (prediction_id, settled_at, outcome, profit_units) VALUES (1, now(), 'win', 0.9);
		`);
		h = createApiHandler({
			repo,
			budget: new SqlBudgetStore(db),
			placedBets: new SqlPlacedBetRepository(db),
			evaluations: () => loadEvaluationRecords(db)
		});
		client = createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => h(new Request(url, init)) });
	});

	it('POST 201 → GET: saját ROI a modell ROI-ja mellett', async () => {
		const created = await client.createPlacedBet({
			fixtureId: 1001,
			marketId: 5,
			selection: 'Over',
			line: 2.5,
			oddTaken: 2,
			stake: 1000,
			predictionId: 1
		});
		expect(created).toMatchObject({ id: 1, outcome: 'win', profit: 1000, bookmakerLabel: 'Tippmix', modelOdd: 1.9 });
		await client.createPlacedBet({ fixtureId: 1001, marketId: 1, selection: 'Home', oddTaken: 1.8, stake: 500 });

		const res = await client.listPlacedBets();
		expect(res.bets).toHaveLength(2);
		expect(res.summary.own).toMatchObject({ n: 2, pending: 0, wins: 1, losses: 1, staked: 1500, profit: 500 });
		expect(res.summary.own.roi).toBeCloseTo(1 / 3);
		expect(res.summary.ownFlat.roi).toBeCloseTo(0); // (+1 − 1) / 2
		expect(res.summary.modelSameBets).toMatchObject({ n: 1, wins: 1 });
		expect(res.summary.model.profit).toBeCloseTo(0.9);
	});

	it('400 hibás törzsre és ismeretlen hivatkozásra, 405 más metódusra', async () => {
		const bad = await h(new Request('http://localhost/api/bets', { method: 'POST', body: '{nem json' }));
		expect(bad.status).toBe(400);
		await expect(
			client.createPlacedBet({ fixtureId: 1001, marketId: 1, selection: 'Home', oddTaken: 0.5, stake: 100 })
		).rejects.toMatchObject({ status: 400, error: 'bad-request' });
		const missing = await client
			.createPlacedBet({ fixtureId: 4242, marketId: 1, selection: 'Home', oddTaken: 2, stake: 100 })
			.catch((e: unknown) => e);
		expect(missing).toBeInstanceOf(ApiError);
		expect((missing as ApiError).message).toMatch(/meccs/);
		expect((await h(new Request('http://localhost/api/bets', { method: 'DELETE' }))).status).toBe(405);
		expect((await client.listPlacedBets()).bets).toHaveLength(2);
	});

	it('repository nélkül 404', async () => {
		const { db, repo } = await openMemoryRepository();
		const bare = createApiHandler({ repo, budget: new SqlBudgetStore(db) });
		expect((await bare(new Request('http://localhost/api/bets'))).status).toBe(404);
	});
});
