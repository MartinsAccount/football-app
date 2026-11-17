import { PGlite } from '@electric-sql/pglite';
import { migrate } from './migrate';
import { SqlOwnerAnswerRepository } from './ownerAnswers';

let db: PGlite;
let repo: SqlOwnerAnswerRepository;

beforeAll(async () => {
	db = new PGlite();
	await migrate(db);
	await db.exec(`
		INSERT INTO league (id, name) VALUES (39, 'Premier League');
		INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B');
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id, goals_home, goals_away)
			VALUES (1001, 39, 2024, '2024-05-02T15:00:00Z', 'FT', 1, 2, 2, 1),
			       (1002, 39, 2024, '2024-05-09T15:00:00Z', 'FT', 2, 1, 0, 0);
	`);
	repo = new SqlOwnerAnswerRepository(db);
});

describe('SqlOwnerAnswerRepository (Q2)', () => {
	it('upsert: egy meccsre egy válasz, az újabb felülír; lista válaszidő szerint', async () => {
		expect(await repo.upsert({ fixtureId: 1002, pick: 'X', confidence: 2 }, '2026-11-17T10:00:00Z')).toEqual({
			fixtureId: 1002,
			pick: 'X',
			confidence: 2,
			answeredAt: '2026-11-17T10:00:00.000Z'
		});
		await repo.upsert({ fixtureId: 1001, pick: 'skip' }, '2026-11-17T09:00:00Z');
		await repo.upsert({ fixtureId: 1001, pick: '1' }, '2026-11-17T11:00:00Z');
		const all = await repo.list();
		expect(all.map((a) => [a.fixtureId, a.pick])).toEqual([
			[1002, 'X'],
			[1001, '1']
		]);
		expect(all[1]).not.toHaveProperty('confidence');
	});

	it('a CHECK és az FK véd: ismeretlen tipp, bizalom vagy meccs', async () => {
		await expect(repo.upsert({ fixtureId: 1001, pick: 'Y' as never })).rejects.toThrow();
		await expect(repo.upsert({ fixtureId: 1001, pick: '1', confidence: 4 as never })).rejects.toThrow();
		await expect(repo.upsert({ fixtureId: 4242, pick: '1' })).rejects.toThrow();
	});
});
