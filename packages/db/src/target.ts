import { migrate, type SqlExecutor } from './migrate';
import { openMemoryRepository } from './memory';
import { openPg, readDatabaseUrl } from './pg';
import { SqlRepository } from './sqlRepository';

/** Egy script célja: a lokális PGlite-fájl vagy a valódi Postgres (Supabase). A címet soha nem írjuk ki. */
export interface Target {
	kind: 'pglite' | 'pg';
	/** Kiírható leírás (pg-nél a cím nélkül). */
	label: string;
	db: SqlExecutor & { close(): Promise<void> };
	repo: SqlRepository;
}

export interface TargetOptions {
	/** `--pg` kapcsoló: valódi Postgres akkor is, ha a `DATABASE_URL` csak a `.env`-ben van. */
	pg?: boolean;
	/** PGlite-adatkönyvtár (pl. `.data/pglite`); nélküle memóriabeli. */
	dataDir?: string;
	/** A `DATABASE_URL` forrása, ha a környezetben nincs. */
	envFile?: string;
	env?: Record<string, string | undefined>;
}

/**
 * Cél kiválasztása: `pg: true` vagy a környezetben lévő `DATABASE_URL` → `openPg` (+ idempotens `migrate`), különben PGlite.
 * Mindkét ág ugyanazt a `SqlRepository`-t adja, így a scriptek célfüggetlenek.
 */
export async function openTarget(opts: TargetOptions = {}): Promise<Target> {
	const env = opts.env ?? process.env;
	if (opts.pg || env.DATABASE_URL) {
		const db = await openPg(env.DATABASE_URL ?? readDatabaseUrl(opts.envFile));
		try {
			await migrate(db);
		} catch (e) {
			await db.close();
			throw e;
		}
		return { kind: 'pg', label: 'Postgres (DATABASE_URL)', db, repo: new SqlRepository(db) };
	}
	const { db, repo } = await openMemoryRepository(opts.dataDir);
	return { kind: 'pglite', label: opts.dataDir ?? 'PGlite (memória)', db, repo };
}

/** Script-argumentumok: `--pg` kapcsoló + opcionális pozicionális PGlite-adatkönyvtár. */
export function parseTargetArgs(argv: string[]): { pg: boolean; dataDir?: string } {
	return { pg: argv.includes('--pg'), dataDir: argv.find((a) => !a.startsWith('--')) };
}
