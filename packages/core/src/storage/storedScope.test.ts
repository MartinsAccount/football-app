import { isQuoteStored, resolveStoredScope, resolveStoredScopes, type StoredScopeInput } from './storedScope';

const INPUT: StoredScopeInput = {
	leagues: [
		{ leagueId: 39, enabled: true, markets: null },
		{ leagueId: 140, enabled: true, markets: ['MindketCsapatGol', '999'] },
		{ leagueId: 78, enabled: false, markets: null },
		{ leagueId: 61, enabled: true, markets: [] }
	],
	markets: [
		{ id: 5, code: 'GolSzam', stored: true },
		{ id: 1, code: 'Vegeredmeny', stored: true },
		{ id: 8, code: 'MindketCsapatGol', stored: false },
		{ id: 999, code: null, stored: false }
	],
	bookmakers: [
		{ id: 8, stored: true },
		{ id: 1, stored: false },
		{ id: 3, stored: true }
	]
};

describe('resolveStoredScope', () => {
	it('markets = null → a globális market.stored piacai, a stored irodák (növekvő)', () => {
		expect(resolveStoredScope(39, INPUT)).toEqual({ leagueId: 39, followed: true, marketIds: [1, 5], bookmakerIds: [3, 8] });
	});

	it('ligánkénti felülírás kód vagy id alapján, a globális jelzőtől függetlenül', () => {
		expect(resolveStoredScope(140, INPUT).marketIds).toEqual([8, 999]);
	});

	it('üres felülírás → egy piac sem', () => {
		expect(resolveStoredScope(61, INPUT)).toMatchObject({ followed: true, marketIds: [] });
	});

	it('letiltott vagy nem követett liga → üres kör', () => {
		expect(resolveStoredScope(78, INPUT)).toEqual({ leagueId: 78, followed: false, marketIds: [], bookmakerIds: [] });
		expect(resolveStoredScope(135, INPUT).followed).toBe(false);
	});

	it('ismeretlen felülírás-elem kimarad', () => {
		const input = { ...INPUT, leagues: [{ leagueId: 1, enabled: true, markets: ['Nincs', 'Vegeredmeny'] }] };
		expect(resolveStoredScope(1, input).marketIds).toEqual([1]);
	});
});

describe('resolveStoredScopes / isQuoteStored', () => {
	it('csak az engedélyezett ligák', () => {
		expect([...resolveStoredScopes(INPUT).keys()]).toEqual([39, 140, 61]);
	});

	it('piac × iroda szűrés', () => {
		const scope = resolveStoredScope(39, INPUT);
		expect(isQuoteStored(scope, 1, 8)).toBe(true);
		expect(isQuoteStored(scope, 1, 1)).toBe(false);
		expect(isQuoteStored(scope, 8, 8)).toBe(false);
		expect(isQuoteStored(resolveStoredScope(78, INPUT), 1, 8)).toBe(false);
	});
});
