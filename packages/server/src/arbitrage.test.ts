import { SqlBudgetStore } from '@football/api-client';
import { createApiClient } from '@football/contract';
import { reviveArbitrageSnapshot } from '@football/core';
import { openMemoryRepository, SqlRepository, type SqlExecutor } from '@football/db';
import { buildArbitrageResponse, loadArbitrageSnapshot } from './arbitrage';
import { createApiHandler } from './router';
import { withDbArbitrage, type SnapshotSource } from './snapshots';

const NOW = new Date('2024-05-18T09:00:00Z');
const ARB = 2001; // 1X2: 2.2 / 4.0 / 4.5 a két iroda legjobbjaiból → Σ < 1
const FAR = 2002; // csak egy iroda, normál árrés; O/U hiányzik
const LATER = 2003; // az ablakon túl (12 nap)
const OTHER = 2004; // nem követett liga

async function seed(db: SqlExecutor) {
	await db.exec(`INSERT INTO league (id, name) VALUES (39, 'Premier League'), (78, 'Bundesliga');
		INSERT INTO season (league_id, year) VALUES (39, 2023), (78, 2023);
		INSERT INTO team (id, name) VALUES (1, 'A'), (2, 'B'), (3, 'C'), (4, 'D'), (5, 'E'), (6, 'F'), (7, 'G'), (8, 'H');
		INSERT INTO bookmaker (id, name, stored) VALUES (16, 'Unibet', true), (8, 'Bet365', true);
		INSERT INTO market (id, name, stored) VALUES (1, 'Match Winner', true), (5, 'Goals Over/Under', true);
		INSERT INTO fixture (id, league_id, season, kickoff_at, status, home_team_id, away_team_id) VALUES
			(${ARB}, 39, 2023, '2024-05-19T15:00:00Z', 'NS', 1, 2),
			(${FAR}, 39, 2023, '2024-05-19T13:00:00Z', 'NS', 3, 4),
			(${LATER}, 39, 2023, '2024-05-30T15:00:00Z', 'NS', 5, 6),
			(${OTHER}, 78, 2023, '2024-05-19T15:00:00Z', 'NS', 7, 8);
		INSERT INTO followed_league (league_id, enabled) VALUES (39, true), (78, false);`);
	const repo = new SqlRepository(db);
	const q = (bookmakerId: number, marketId: number, selections: string[], odds: number[], line: number | null = null) =>
		selections.map((selection, k) => ({ bookmakerId, marketId, selection, line, odd: odds[k] }));
	const snap = (fixtureId: number, capturedAt: string, quotes: ReturnType<typeof q>) => ({
		fixtureId,
		capturedAt,
		source: 'api-football' as const,
		kind: 'early' as const,
		quotes
	});
	const h2h = ['Home', 'Draw', 'Away'];
	const ou = ['Over', 'Under'];
	await repo.insertOddsSnapshots([
		// régebbi snapshot: nem ez számít
		snap(ARB, '2024-05-17T09:00:00Z', [...q(16, 1, h2h, [1.5, 3, 3]), ...q(8, 1, h2h, [1.5, 3, 3])]),
		snap(ARB, '2024-05-18T08:00:00Z', [
			...q(16, 1, h2h, [2.2, 3.6, 4.5]),
			...q(8, 1, h2h, [2.0, 4.0, 4.0]),
			...q(16, 5, ou, [1.9, 1.9], 2.5),
			...q(8, 5, ou, [1.95, 1.85], 2.5)
		]),
		// jövőbeli (now utáni) snapshot: kimarad
		snap(ARB, '2024-05-18T12:00:00Z', [...q(16, 1, h2h, [9, 9, 9])]),
		snap(FAR, '2024-05-18T08:00:00Z', q(8, 1, h2h, [2.0, 3.2, 3.5])),
		snap(LATER, '2024-05-18T08:00:00Z', q(8, 1, h2h, [2.0, 3.2, 3.5])),
		snap(OTHER, '2024-05-18T08:00:00Z', q(8, 1, h2h, [5, 5, 5]))
	]);
}

describe('loadArbitrageSnapshot (I22, memória-PGlite)', () => {
	it('a követett ligák ablakbeli meccsei, a legutóbbi now előtti snapshotból; drótforma', async () => {
		const { db } = await openMemoryRepository();
		await seed(db);
		const snap = await loadArbitrageSnapshot(db, { now: NOW });
		expect(snap).not.toBeNull();
		expect(snap!.fixtures.map((f) => f.fixtureId)).toEqual([FAR, ARB]); // kezdés szerint
		expect(snap!.bookmakers).toEqual(['Bet365', 'Unibet']);
		expect(snap!.markets.map((m) => m.key)).toEqual(['h2h', 'ou25']);

		const arb = snap!.fixtures.find((f) => f.fixtureId === ARB)!;
		expect(arb).toMatchObject({ league: 'Premier League', home: 'A', away: 'B', kickoff: '2024-05-19T15:00:00.000Z' });
		expect(arb.oddsAt).toBe('2024-05-18T08:00:00.000Z');
		const [h2h, ou25] = arb.opportunities;
		expect(h2h.legs.map((l) => [l.outcome, l.bookmaker, l.odds])).toEqual([
			['Home', 'Unibet', 2.2],
			['Draw', 'Bet365', 4],
			['Away', 'Unibet', 4.5]
		]);
		expect(h2h.sum).toBeCloseTo(1 / 2.2 + 1 / 4 + 1 / 4.5);
		expect(h2h.band).toBe('arb');
		expect(h2h.bookmakerCount).toBe(2);
		expect(ou25.legs.map((l) => l.bookmaker)).toEqual(['Bet365', 'Unibet']);
		expect(ou25.band).toBe('far');

		const far = snap!.fixtures.find((f) => f.fixtureId === FAR)!;
		expect(far.opportunities[1]).toMatchObject({ market: 'ou25', legs: [], sum: null, band: 'far' });
		expect(reviveArbitrageSnapshot(snap).fixtures[0].opportunities[1].sum).toBe(Infinity);
	});

	it('nincs követett liga → minden liga; üres ablak → null', async () => {
		const { db } = await openMemoryRepository();
		await seed(db);
		await db.exec('DELETE FROM followed_league');
		const all = await loadArbitrageSnapshot(db, { now: NOW });
		expect(all!.fixtures.map((f) => f.fixtureId).sort()).toEqual([ARB, FAR, OTHER]);
		expect(await loadArbitrageSnapshot(db, { now: new Date('2025-01-01T00:00:00Z') })).toBeNull();
		expect(buildArbitrageResponse([], NOW, 'x')).toBeNull();
	});

	it('GET /api/arbitrage: DB elsőként, null esetén a mentett pillanatkép', async () => {
		const { db, repo } = await openMemoryRepository();
		await seed(db);
		const saved = { source: 'mentett' } as Awaited<ReturnType<SnapshotSource['arbitrage']>>;
		const files: SnapshotSource = {
			recommendations: async () => null,
			backtest: async () => null,
			arbitrage: async () => saved
		};
		const clientAt = (now: Date) => {
			const h = createApiHandler({
				repo,
				budget: new SqlBudgetStore(db),
				snapshots: withDbArbitrage(files, () => loadArbitrageSnapshot(db, { now }))
			});
			return createApiClient({ baseUrl: 'http://localhost', fetch: (url, init) => h(new Request(url, init)) });
		};
		expect((await clientAt(NOW).getArbitrage()).fixtures).toHaveLength(2);
		expect((await clientAt(new Date('2025-01-01T00:00:00Z')).getArbitrage()).source).toBe('mentett');
	});
});
