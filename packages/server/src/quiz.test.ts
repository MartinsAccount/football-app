import { SqlBudgetStore } from '@football/api-client';
import { createApiClient, type ApiClient } from '@football/contract';
import { openMemoryRepository, type SqlExecutor } from '@football/db';
import {
	createQuizService,
	loadQuizQuestion,
	loadQuizQuestions,
	parsePickIds,
	parseQuizAnswer,
	placedBetPick,
	QuizValidationError,
	seededIndex
} from './quiz';
import { createApiHandler, type ApiHandler } from './router';

let db: SqlExecutor;
let h: ApiHandler;
let client: ApiClient;

beforeAll(async () => {
	const mem = await openMemoryRepository();
	db = mem.db;
	await mem.db.exec(`
		INSERT INTO league (id, name) VALUES (39, 'Premier League');
		INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C'), (4, 'D');
		INSERT INTO market (id, name) VALUES (1, 'Match Winner'), (5, 'Goals Over/Under');
		INSERT INTO bookmaker (id, name) VALUES (8, 'Bet365'), (900001, 'CSV átlag');
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id, goals_home, goals_away) VALUES
			(1, 39, 2024, '2024-01-06T15:00:00Z', 'FT', 1, 2, 2, 0),
			(2, 39, 2024, '2024-01-13T15:00:00Z', 'FT', 3, 1, 1, 1),
			(3, 39, 2024, '2024-01-13T15:00:00Z', 'FT', 2, 4, 0, 1),
			(100, 39, 2024, '2024-01-20T15:00:00Z', 'FT', 1, 4, 3, 1),
			(101, 39, 2024, '2024-01-27T15:00:00Z', 'FT', 2, 3, 1, 1),
			(103, 39, 2024, '2024-02-03T15:00:00Z', 'NS', 4, 3, NULL, NULL);
		INSERT INTO odds_snapshot (id, fixture_id, captured_at, source, kind) VALUES
			(1, 100, '2024-01-17T00:00:00Z', 'football-data-csv', 'opening_csv'),
			(2, 101, '2024-01-26T00:00:00Z', 'legacy-json', 'legacy'),
			(3, 101, '2024-01-28T00:00:00Z', 'manual', 'adhoc');
		INSERT INTO odds_quote (snapshot_id, bookmaker_id, market_id, selection, line, odd) VALUES
			(1, 8, 1, 'Home', NULL, 2.0), (1, 8, 1, 'Draw', NULL, 3.4), (1, 8, 1, 'Away', NULL, 3.8),
			(1, 8, 5, 'Over', 2.5, 1.9), (1, 8, 5, 'Under', 2.5, 1.95),
			(1, 900001, 1, 'Home', NULL, 1.95), (1, 900001, 1, 'Draw', NULL, 3.5), (1, 900001, 1, 'Away', NULL, 4.0),
			(1, 900001, 5, 'Over', 2.5, 1.85),
			(2, 8, 1, 'Home', NULL, 2.6), (2, 8, 1, 'Draw', NULL, 3.1), (2, 8, 1, 'Away', NULL, 2.8),
			(3, 8, 5, 'Over', 2.5, 2.2), (3, 8, 5, 'Under', 2.5, 1.7);
		INSERT INTO placed_bet (fixture_id, market_id, selection, line, odd_taken, stake, placed_at) VALUES
			(101, 1, 'Draw', NULL, 3.1, 1000, '2024-01-26T10:00:00Z'),
			(103, 1, 'Home', NULL, 2.0, 1000, '2024-02-01T10:00:00Z'),
			(100, 5, 'Over', 2.5, 1.9, 1000, '2024-01-19T10:00:00Z');
	`);
	h = createApiHandler({ repo: mem.repo, budget: new SqlBudgetStore(mem.db), quiz: createQuizService(mem.db) });
	client = createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => h(new Request(url, init)) });
});

describe('quiz segédek', () => {
	it('parseQuizAnswer: érvényes és hibás törzsek', () => {
		expect(parseQuizAnswer({ fixtureId: 5, pick: 'X', confidence: 3 })).toEqual({ fixtureId: 5, pick: 'X', confidence: 3 });
		expect(parseQuizAnswer({ fixtureId: 5, pick: 'skip', confidence: null })).toEqual({ fixtureId: 5, pick: 'skip' });
		for (const bad of [
			null,
			{ fixtureId: 0, pick: '1' },
			{ fixtureId: 5, pick: 'Home' },
			{ fixtureId: 5, pick: '1', confidence: 4 }
		])
			expect(() => parseQuizAnswer(bad)).toThrow(QuizValidationError);
	});

	it('placedBetPick és seededIndex', () => {
		expect(placedBetPick(1, 'Away', null)).toBe('2');
		expect(placedBetPick(5, 'Under', 2.5)).toBe('under');
		expect(placedBetPick(5, 'Over', 3.5)).toBeNull();
		expect(placedBetPick(8, 'Yes', null)).toBeNull();
		expect(seededIndex(42, 7)).toBe(seededIndex(42, 7));
		expect(seededIndex(42, 7)).toBeGreaterThanOrEqual(0);
		expect(seededIndex(42, 7)).toBeLessThan(7);
	});
});

describe('loadQuizQuestion', () => {
	it('nyitó odds (CSV-átlag elöl, O/U a teljes Bet365-sorból), forma és tabellahely a meccs előtt', async () => {
		expect(await loadQuizQuestion(db, 100)).toEqual({
			fixtureId: 100,
			league: { id: 39, name: 'Premier League' },
			kickoff: '2024-01-20T15:00:00.000Z',
			home: { id: 1, name: 'A', form: ['W', 'D'], tablePosition: 1 },
			away: { id: 4, name: 'D', form: ['W'], tablePosition: 2 },
			odds1x2: { home: 1.95, draw: 3.5, away: 4 },
			oddsOu25: { over: 1.9, under: 1.95 },
			tableSize: 4
		});
	});

	it('kezdés utáni snapshot nem nyitó odds → oddsOu25 null; odds nélkül null', async () => {
		const q = await loadQuizQuestion(db, 101);
		expect(q?.odds1x2).toEqual({ home: 2.6, draw: 3.1, away: 2.8 });
		expect(q?.oddsOu25).toBeNull();
		expect(await loadQuizQuestion(db, 3)).toBeNull();
		expect(await loadQuizQuestion(db, 4242)).toBeNull();
	});

	it('kötegelt betöltés (Q3b) = egyenkénti betöltés; ismeretlen/odds nélküli kimarad', async () => {
		const ids = [101, 3, 100, 4242, 100];
		const batch = await loadQuizQuestions(db, ids);
		expect([...batch.keys()].sort()).toEqual([100, 101]);
		for (const id of ids) expect(batch.get(id) ?? null).toEqual(await loadQuizQuestion(db, id));
		expect(batch.get(100)?.home.form).toEqual(['W', 'D']);
		expect((await loadQuizQuestions(db, [])).size).toBe(0);
	});
});

describe('quiz/profile API (Q2)', () => {
	it('GET /api/quiz/next: seeddel determinisztikus, csak lejátszott + oddsos meccs', async () => {
		const a = await client.getQuizQuestion(7);
		expect(a.question?.fixtureId).toBe((await client.getQuizQuestion(7)).question?.fixtureId);
		const ids = new Set<number>();
		for (let s = 0; s < 20; s++) ids.add((await client.getQuizQuestion(s)).question!.fixtureId);
		expect([...ids].sort()).toEqual([100, 101]);
		expect((await h(new Request('http://localhost/api/quiz/next?seed=x'))).status).toBe(400);
	});

	it('POST /api/quiz/answer: mentés + valós eredmény; hibás → 400, GET → 405', async () => {
		const res = await client.answerQuiz({ fixtureId: 100, pick: 'under', confidence: 2 });
		expect(res.result).toEqual({ homeGoals: 3, awayGoals: 1, outcome: '1', over25: true });
		expect(res.correct).toBe(false);
		expect(res.answer).toMatchObject({ fixtureId: 100, pick: 'under', confidence: 2 });
		expect((await client.answerQuiz({ fixtureId: 100, pick: '1' })).correct).toBe(true); // felülírja
		await expect(client.answerQuiz({ fixtureId: 103, pick: '1' })).rejects.toMatchObject({ status: 400 });
		expect((await h(new Request('http://localhost/api/quiz/answer'))).status).toBe(405);
		expect((await client.getQuizQuestion(1)).question?.fixtureId).toBe(101);
	});

	it('GET /api/profile: kvíz + leképezhető saját fogadás, kevés adat', async () => {
		const res = await client.getProfile();
		// 100: kvíz (a fogadás ugyanarra nem számít), 101: Draw-fogadás, 103: nincs nyitó odds → kimarad
		expect(res.sources).toEqual({ quiz: 1, placedBets: 1, ignored: 1 });
		expect(res.profile).toMatchObject({ status: 'kevés adat', answered: 2, skipped: 0 });
		expect(res.crossValidation.status).toBe('kevés adat');
		await client.answerQuiz({ fixtureId: 101, pick: 'skip' });
		expect((await client.getQuizQuestion()).question).toBeNull();
		expect((await client.getProfile()).sources).toEqual({ quiz: 2, placedBets: 0, ignored: 1 });
	});

	it('bekötés nélkül 404', async () => {
		const { db: d, repo } = await openMemoryRepository();
		const bare = createApiHandler({ repo, budget: new SqlBudgetStore(d) });
		expect((await bare(new Request('http://localhost/api/profile'))).status).toBe(404);
	});
});

describe('„Te ezt raknád” (Q5)', () => {
	it('parsePickIds: lista, üres, hibás, túl hosszú', () => {
		expect(parsePickIds('3, 1,3')).toEqual([3, 1]);
		expect(parsePickIds(null)).toEqual([]);
		expect(parsePickIds('')).toEqual([]);
		for (const bad of ['1,x', '0', '-1', '1,,2']) expect(() => parsePickIds(bad)).toThrow(QuizValidationError);
		expect(() => parsePickIds(Array.from({ length: 101 }, (_, i) => i + 1).join(','))).toThrow(QuizValidationError);
	});

	it('GET /api/profile/picks: kevés adatnál üres; elég válasznál utánzott tipp a közelgő, oddsos meccsre', async () => {
		expect(await client.getProfilePicks([100])).toEqual({ status: 'kevés adat', picks: [] });
		expect((await h(new Request('http://localhost/api/profile/picks?ids=a'))).status).toBe(400);

		// Közelgő meccs a kezdés előtti odds-snapshottal (eredmény nélkül).
		await db.exec(`
			INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id) VALUES
				(104, 39, 2024, '2024-02-10T15:00:00Z', 'NS', 1, 3);
			INSERT INTO odds_snapshot (id, fixture_id, captured_at, source, kind) VALUES (4, 104, '2024-02-09T00:00:00Z', 'manual', 'adhoc');
			INSERT INTO odds_quote (snapshot_id, bookmaker_id, market_id, selection, line, odd) VALUES
				(4, 8, 1, 'Home', NULL, 1.6), (4, 8, 1, 'Draw', NULL, 4.0), (4, 8, 1, 'Away', NULL, 5.5);
		`);
		// 22 válasz: mindig a hazai favoritot (100: 1,95) rakta, a kiegyenlítettnél (101) döntetlent.
		const answers = {
			upsert: async () => {
				throw new Error('nem kell');
			},
			list: async () =>
				Array.from({ length: 22 }, (_, i) => ({
					fixtureId: i % 2 ? 101 : 100,
					pick: (i % 2 ? 'X' : '1') as '1' | 'X',
					answeredAt: '2024-03-01T00:00:00.000Z'
				}))
		};
		const hh = createApiHandler({
			repo: (await openMemoryRepository()).repo,
			budget: new SqlBudgetStore(db),
			quiz: createQuizService(db, { answers })
		});
		const c = createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => hh(new Request(url, init)) });
		const res = await c.getProfilePicks([104, 103, 4242]);
		expect(res.status).toBe('ok');
		expect(res.picks.map((p) => p.fixtureId)).toEqual([104]); // 103: nincs odds, 4242: nincs ilyen
		expect(res.picks[0].pick).toBe('1');
		expect(res.picks[0].probability).toBeGreaterThan(0.5);
		expect(res.picks[0].factors.length).toBeGreaterThan(0);
		expect((await c.getProfilePicks([])).picks).toEqual([]);
	});
});
