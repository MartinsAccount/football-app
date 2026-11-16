import { isoWeek, planTasks, type PlannerFixture, type PlannerInput } from './tasks';

const at = (iso: string) => new Date(iso);
const fx = (
	id: number,
	kickoff: string,
	status = 'NS',
	round: string | null = 'Regular Season - 12',
	leagueId = 39
): PlannerFixture => ({
	id,
	leagueId,
	kickoff: at(kickoff),
	status,
	round
});
const keys = (input: PlannerInput) => planTasks(input).map((t) => t.dedupeKey);
const byKind = (input: PlannerInput, kind: string) => planTasks(input).filter((t) => t.kind === kind);

const league = { id: 39, season: 2024 };

describe('planTasks', () => {
	it('liga nélkül csak a heti globális törzsadat', () => {
		expect(keys({ now: at('2026-11-16T10:00:00Z'), leagues: [], fixtures: [] })).toEqual([
			'reference:bets:2026-W47',
			'reference:bookmakers:2026-W47'
		]);
	});

	it('idempotens: ugyanarra a bemenetre ugyanazok a kulcsok, ütközés nélkül', () => {
		const input: PlannerInput = {
			now: at('2026-11-16T10:00:00Z'),
			leagues: [league],
			fixtures: [fx(1, '2026-11-17T15:00:00Z'), fx(2, '2026-11-17T17:30:00Z'), fx(3, '2026-11-18T19:00:00Z')]
		};
		const a = keys(input);
		expect(keys(input)).toEqual(a);
		expect(new Set(a).size).toBe(a.length);
	});

	it('napi fixtures_window 04:00-tól a nap végéig, ligánként havi teams', () => {
		const input = { now: at('2026-11-16T10:00:00Z'), leagues: [league], fixtures: [] };
		const [w] = byKind(input, 'fixtures_window');
		expect(w).toMatchObject({
			dedupeKey: 'fixtures_window:39:2024:2026-11-16',
			priority: 3,
			notBefore: at('2026-11-16T04:00:00Z'),
			deadline: at('2026-11-17T00:00:00Z'),
			params: { league: 39, season: 2024, from: '2026-11-16', to: '2026-11-23' }
		});
		expect(keys(input)).toContain('reference:teams:39:2024:2026-11');
	});

	it('meccsnaponként odds_early / odds_late / injuries a §7.1 ablakaival', () => {
		const ids = Array.from({ length: 12 }, (_, i) => fx(100 + i, `2026-11-17T${String(12 + (i % 8)).padStart(2, '0')}:00:00Z`));
		const input = { now: at('2026-11-16T10:00:00Z'), leagues: [league], fixtures: ids };
		const [late] = byKind(input, 'odds_late');
		expect(late).toMatchObject({
			dedupeKey: 'odds_late:39:2026-11-17',
			priority: 1,
			notBefore: at('2026-11-17T09:00:00Z'),
			deadline: at('2026-11-17T12:00:00Z'),
			estCalls: 2
		});
		const [early] = byKind(input, 'odds_early');
		expect(early).toMatchObject({ notBefore: at('2026-11-15T12:00:00Z'), deadline: at('2026-11-16T12:00:00Z'), priority: 2 });
		expect(byKind(input, 'injuries').map((t) => t.dedupeKey)).toEqual(['injuries:39:2026-11-17:0']);
		const [st] = byKind(input, 'standings');
		expect(st).toMatchObject({ dedupeKey: 'standings:39:2024:Regular Season - 12', notBefore: at('2026-11-16T00:00:00Z') });
	});

	it('lejárt határidejű terv nem keletkezik (odds_early a T−24 h után)', () => {
		const input = { now: at('2026-11-17T08:00:00Z'), leagues: [league], fixtures: [fx(1, '2026-11-17T15:00:00Z')] };
		expect(byKind(input, 'odds_early')).toHaveLength(0);
		expect(byKind(input, 'odds_late')).toHaveLength(1);
	});

	it('a horizonton túli meccsnap kimarad, a belógó meccsnap egészben bekerül', () => {
		const input = {
			now: at('2026-11-16T10:00:00Z'),
			leagues: [league],
			horizonHours: 24,
			fixtures: [fx(1, '2026-11-17T09:00:00Z'), fx(2, '2026-11-17T20:00:00Z'), fx(3, '2026-11-19T15:00:00Z')]
		};
		const [late] = byKind(input, 'odds_late');
		expect(late.params.fixtures).toEqual([1, 2]);
		expect(byKind(input, 'odds_late')).toHaveLength(1);
	});

	it('nem követett liga meccse nem tervez', () => {
		const input = {
			now: at('2026-11-16T10:00:00Z'),
			leagues: [league],
			fixtures: [fx(1, '2026-11-17T15:00:00Z', 'NS', null, 140)]
		};
		expect(byKind(input, 'odds_late')).toHaveLength(0);
	});

	it('results: 1. kör kezdés +3 h-tól, 2. kör csak ha +26 h után sincs FT', () => {
		const fixtures = [
			fx(1, '2026-11-16T12:00:00Z', '1H'),
			fx(2, '2026-11-16T12:00:00Z', 'FT'),
			fx(3, '2026-11-16T18:00:00Z', 'NS')
		];
		const early = { now: at('2026-11-16T16:00:00Z'), leagues: [league], fixtures };
		expect(byKind(early, 'results')).toMatchObject([
			{
				dedupeKey: 'results:39:2026-11-16T12:00:p1:0',
				params: { ids: [1] },
				notBefore: at('2026-11-16T15:00:00Z'),
				deadline: at('2026-11-17T14:00:00Z')
			}
		]);
		const later = { ...early, now: at('2026-11-17T15:00:00Z') };
		expect(byKind(later, 'results').map((t) => t.dedupeKey)).toEqual([
			'results:39:2026-11-16T12:00:p2:0',
			'results:39:2026-11-16T18:00:p1:0'
		]);
		const done = { ...later, fixtures: fixtures.map((f) => ({ ...f, status: 'FT' })) };
		expect(byKind(done, 'results')).toHaveLength(0);
	});

	it('results: 20-as kötegek', () => {
		const fixtures = Array.from({ length: 25 }, (_, i) => fx(i + 1, '2026-11-16T12:00:00Z', 'NS'));
		const input = { now: at('2026-11-16T16:00:00Z'), leagues: [league], fixtures };
		expect(byKind(input, 'results').map((t) => (t.params.ids as number[]).length)).toEqual([20, 5]);
	});
});

describe('isoWeek', () => {
	it.each([
		['2026-11-16T00:00:00Z', '2026-W47'],
		['2027-01-01T12:00:00Z', '2026-W53'],
		['2024-12-30T12:00:00Z', '2025-W01']
	])('%s → %s', (d, w) => expect(isoWeek(at(d))).toBe(w));
});
