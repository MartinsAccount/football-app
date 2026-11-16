import { PGlite } from '@electric-sql/pglite';
import { summarizeOwnBets } from '@football/core';
import { migrate } from './migrate';
import { PlacedBetRefError, SqlPlacedBetRepository, type PlacedBetInput } from './placedBets';

let db: PGlite;
let repo: SqlPlacedBetRepository;

const input = (over: Partial<PlacedBetInput> = {}): PlacedBetInput => ({
	fixtureId: 1001,
	marketId: 1,
	selection: 'Home',
	line: null,
	oddTaken: 2.1,
	stake: 1000,
	predictionId: null,
	bookmakerLabel: 'Tippmix',
	placedAt: '2024-05-01T10:00:00Z',
	note: null,
	...over
});

beforeAll(async () => {
	db = new PGlite();
	await migrate(db);
	await db.exec(`
		INSERT INTO league (id, name) VALUES (39, 'Premier League');
		INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B');
		INSERT INTO market (id, name) VALUES (1, 'Match Winner'), (5, 'Goals Over/Under');
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id, goals_home, goals_away, ft_home, ft_away)
			VALUES (1001, 39, 2024, '2024-05-02T15:00:00Z', 'FT', 1, 2, 2, 1, 2, 1),
			       (1002, 39, 2024, '2024-05-09T15:00:00Z', 'NS', 2, 1, NULL, NULL, NULL, NULL);
		INSERT INTO model_version (id) VALUES ('elo-poisson@test');
		INSERT INTO prediction_run (model_version, trigger) VALUES ('elo-poisson@test', 'manual');
		INSERT INTO prediction (run_id, fixture_id, market_id, selection, p_model, best_odd, is_recommendation)
			VALUES (1, 1001, 1, 'Home', 0.55, 2.2, true), (1, 1001, 1, 'Away', 0.2, 4.5, false);
		INSERT INTO evaluation (prediction_id, settled_at, outcome, profit_units, closing_odd)
			VALUES (1, now(), 'win', 1.2, 2.0), (2, now(), 'loss', -1, 4.0);
	`);
	repo = new SqlPlacedBetRepository(db);
});

describe('SqlPlacedBetRepository', () => {
	it('rögzít, visszaolvas a kapcsolt predikcióval és kiértékeléssel', async () => {
		const linked = await repo.insert(input({ predictionId: 1 }));
		expect(linked).toMatchObject({
			fixtureId: 1001,
			selection: 'Home',
			oddTaken: 2.1,
			stake: 1000,
			predictionId: 1,
			modelVersion: 'elo-poisson@test',
			modelOdd: 2.2,
			evaluationOutcome: 'win',
			closingOdd: 2,
			status: 'FT',
			homeGoals: 2,
			awayGoals: 1,
			placedAt: '2024-05-01T10:00:00.000Z'
		});

		// Más kimenetre szól, mint a predikció → a kiértékelés nem kapcsolódik, a meccs eredménye számol.
		const other = await repo.insert(input({ predictionId: 1, selection: 'Draw', placedAt: '2024-05-01T11:00:00Z' }));
		expect(other.evaluationOutcome).toBeNull();
		await repo.insert(input({ fixtureId: 1002, placedAt: null, note: 'élőben' }));

		const all = await repo.list();
		expect(all.map((b) => b.fixtureId)).toEqual([1002, 1001, 1001]);
		expect(all[0]).toMatchObject({ status: 'NS', homeGoals: null, predictionId: null, note: 'élőben' });

		const s = summarizeOwnBets(all, []);
		expect(s.own).toMatchObject({ n: 3, pending: 1, wins: 1, losses: 1, staked: 2000 });
		expect(s.own.profit).toBeCloseTo(100);
		expect(s.modelSameBets.n).toBe(2);
	});

	it('hiányzó vagy ellentmondó hivatkozás → PlacedBetRefError, nem ír', async () => {
		const before = (await repo.list()).length;
		await expect(repo.insert(input({ fixtureId: 9999 }))).rejects.toThrow(PlacedBetRefError);
		await expect(repo.insert(input({ marketId: 77 }))).rejects.toThrow(/piac/);
		await expect(repo.insert(input({ predictionId: 999 }))).rejects.toThrow(/predikció/);
		await expect(repo.insert(input({ fixtureId: 1002, predictionId: 1 }))).rejects.toThrow(/másik meccshez/);
		expect((await repo.list()).length).toBe(before);
	});
});
