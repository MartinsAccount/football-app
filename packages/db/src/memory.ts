import { PGlite } from '@electric-sql/pglite';
import { migrate } from './migrate';
import { SqlRepository } from './sqlRepository';

/**
 * Memóriabeli Postgres (PGlite) a teljes sémával: a tesztek, a lokális scriptek (import, backtest) és a fixture-mód
 * adaptere. Ugyanaz az SQL fut, mint a Supabase-en, így a CHECK-ek és az append-only trigger itt is élnek.
 * `dataDir` megadásával (pl. `./.data/pglite`) fájlba is perzisztál.
 */
export async function openMemoryRepository(dataDir?: string): Promise<{ db: PGlite; repo: SqlRepository }> {
	const db = new PGlite(dataDir);
	await migrate(db);
	return { db, repo: new SqlRepository(db) };
}
