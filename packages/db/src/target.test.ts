import { describe, expect, it } from 'vitest';
import { openTarget, parseTargetArgs } from './target';

describe('parseTargetArgs', () => {
	it('--pg kapcsoló és pozicionális adatkönyvtár', () => {
		expect(parseTargetArgs(['--pg'])).toEqual({ pg: true, dataDir: undefined });
		expect(parseTargetArgs(['.data/x'])).toEqual({ pg: false, dataDir: '.data/x' });
		expect(parseTargetArgs([])).toEqual({ pg: false, dataDir: undefined });
	});
});

describe('openTarget', () => {
	it('DATABASE_URL és --pg nélkül PGlite, migrált sémával', async () => {
		const t = await openTarget({ env: {} });
		try {
			expect(t.kind).toBe('pglite');
			expect(await t.repo.countRows('fixture')).toBe(0);
		} finally {
			await t.db.close();
		}
	});

	it.skipIf(!!process.env.DATABASE_URL)('--pg cím nélkül hibát dob (nem esik vissza csendben PGlite-ra)', async () => {
		await expect(openTarget({ pg: true, env: {}, envFile: 'nincs-ilyen.env' })).rejects.toThrow(/DATABASE_URL hiányzik/);
	});
});
