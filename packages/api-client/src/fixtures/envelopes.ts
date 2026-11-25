import type { ApiEnvelope } from '../types';

/** Tesztfixture-ök a docs/api/api-football.md §1/§3 szerinti alakban (szó szerinti `errors.plan` üzenet). */
export const planError: ApiEnvelope = {
	get: 'fixtures',
	parameters: { league: '39', season: '2026' },
	errors: { plan: 'Free plans do not have access to this season, try from 2022 to 2024.' },
	results: 0,
	paging: { current: 1, total: 1 },
	response: []
};

export function oddsPage(page: number, total: number, ids: number[]): ApiEnvelope<{ fixture: { id: number } }> {
	return {
		get: 'odds',
		parameters: { league: '39', season: '2024', ...(page > 1 ? { page: String(page) } : {}) },
		errors: [],
		results: ids.length,
		paging: { current: page, total },
		response: ids.map((id) => ({ fixture: { id } }))
	};
}

export const statusOk = (current: number, limitDay = 100): ApiEnvelope =>
	({
		get: 'status',
		parameters: [],
		errors: [],
		results: 1,
		response: { requests: { current, limit_day: limitDay } } as unknown as never[]
	} as ApiEnvelope);
