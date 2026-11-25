// Integrációs teszt a valódi Postgresen (Supabase): csak akkor fut, ha a `DATABASE_URL` a környezetben van
// (`NODE_OPTIONS=--use-system-ca`, sandboxon kívül). Csak olvas; a címet nem írja ki.
import { SqlBudgetStore } from '@football/api-client';
import type { FixturesResponse } from '@football/contract';
import { openTarget, type Target } from '@football/db';
import { createApiHandler } from './router';

describe.skipIf(!process.env.DATABASE_URL)('olvasó API valódi Postgresen', () => {
	let target: Target;
	beforeAll(async () => {
		target = await openTarget({ pg: true });
	}, 60_000);
	afterAll(async () => {
		await target?.db.close();
	}, 60_000);

	it('a /api/fixtures és a /api/budget a DB-ből válaszol', async () => {
		const handler = createApiHandler({ repo: target.repo, budget: new SqlBudgetStore(target.db) });
		const fixtures = await handler(new Request('http://x/api/fixtures?season=2024'));
		expect(fixtures.status).toBe(200);
		const body = (await fixtures.json()) as FixturesResponse;
		expect(Array.isArray(body.fixtures)).toBe(true);
		const budget = await handler(new Request('http://x/api/budget'));
		expect(budget.status).toBe(200);
	}, 60_000);
});
