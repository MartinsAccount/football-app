import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ApiURLs from '../ApiURLs';
import { getDataMode } from '../dataMode';
import { FetchService } from '../FetchService';
import FetchService3 from '../FetchService3';
import { resolveFixture } from './fixtureResolver';

// A FetchService csak a számlálót használja a MainStore-ból.
const fakeMainStore = () => {
	const store = { fetchNumber: 0, increaseFetchNumber: () => (store.fetchNumber += 1) };
	return store;
};

describe('fixture-mód (ROADMAP 0.5)', () => {
	let fetchSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({ response: [] }) }));
		vi.stubGlobal('fetch', fetchSpy);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.unstubAllEnvs();
	});

	it('alapértelmezés: fixture', () => {
		expect(getDataMode()).toBe('fixture');
	});

	it('egy teljes oldalbejárás hívásai után 0 élő hívás, a fetchNumber 0 marad', async () => {
		const store = fakeMainStore();
		const service = new FetchService(store as any);
		const F = ApiURLs.FOOTBALL;

		// Arbitrázs-oldal (MainStore.FetchService)
		const mapping = await service.get(F.AVAILABLE_FIXTURES_FOR_ODDS(1));
		await service.get(F.GET_LEAGUE_ODDS(39));
		await service.get(F.GET_FIXTURE(mapping.response[0].fixture.id));
		// Odds- és meccsoldal (FetchService3)
		await FetchService3.get(F.GET_UNIBET_ODDS(78));
		await FetchService3.get(F.GET_CURRENT_SEASON_FIXTURES(140));
		await FetchService3.get(F.GET_CURRENT_ROUND(135));
		await FetchService3.get(F.GET_LEAGUES());
		await FetchService3.get(F.GET_FIXTURE_STATISTICS(1));

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(store.fetchNumber).toBe(0);
	});

	it('live módban valódi fetch megy és nő a számláló', async () => {
		vi.stubEnv('VITE_DATA_MODE', 'live');
		const store = fakeMainStore();
		await new FetchService(store as any).get(ApiURLs.FOOTBALL.GET_LEAGUES());
		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(store.fetchNumber).toBe(1);
	});
});

describe('resolveFixture', () => {
	const F = ApiURLs.FOOTBALL;

	it('liga-szezon meccsek: a hiányzó szezon a legutolsó mentettre esik vissza', async () => {
		const res = await resolveFixture(F.GET_CURRENT_SEASON_FIXTURES(39));
		expect(res.results).toBe(380);
		expect(res.response[0].league.id).toBe(39);
	});

	it('meccs id alapján', async () => {
		const { response } = await resolveFixture(F.GET_CUSTOM_SEASON_FIXTURES(2020, 78));
		const id = response[0].fixture.id;
		const res = await resolveFixture(F.GET_FIXTURE(id));
		expect(res.response.map((f) => f.fixture.id)).toEqual([id]);
	});

	it('aktuális forduló és a forduló meccsei', async () => {
		const rounds = await resolveFixture(F.GET_CURRENT_ROUND(135));
		expect(rounds.response).toHaveLength(1);
		const res = await resolveFixture(F.GET_CURRENT_ROUND_FIXTURES(135, rounds.response[0]));
		expect(res.results).toBeGreaterThan(0);
		expect(res.response.every((f) => f.league.round === rounds.response[0])).toBe(true);
	});

	it('liga-oddsok a backend/stores-ból, bukmékerlista', async () => {
		const odds = await resolveFixture(F.GET_LEAGUE_ODDS(140));
		expect(odds.results).toBeGreaterThan(0);
		expect(odds.response.every((o) => o.league.id === 140)).toBe(true);
		const bookmakers = await resolveFixture(F.GET_BOOKMAKERS());
		expect(bookmakers.results).toBeGreaterThan(0);
	});

	it('odds-mapping 1 oldalra vágva, hogy a lapozás véget érjen', async () => {
		const res = await resolveFixture(F.AVAILABLE_FIXTURES_FOR_ODDS(1));
		expect(res.paging.total).toBe(1);
		expect(res.results).toBeGreaterThan(0);
	});

	it('ismeretlen végpont: üres válasz', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const res = await resolveFixture(F.GET_FIXTURE_STATISTICS(1));
		expect(res.response).toEqual([]);
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
