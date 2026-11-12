import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A migráció-futtatónak elég ennyi a DB-klienstől (PGlite és a `pg` köré is könnyen burkolható). */
export interface SqlExecutor {
	exec(sql: string): Promise<unknown>;
	query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface Migration {
	name: string;
	sql: string;
	checksum: string;
}

export const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

/** A `NNNN_*.sql` fájlok név szerinti sorrendben. */
export function loadMigrations(dir: string = MIGRATIONS_DIR): Migration[] {
	return readdirSync(dir)
		.filter((f) => /^\d{4}_.+\.sql$/.test(f))
		.sort()
		.map((name) => {
			const sql = readFileSync(join(dir, name), 'utf8').replace(/\r\n/g, '\n');
			return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
		});
}

const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS schema_migration (
	name text PRIMARY KEY,
	checksum text NOT NULL,
	applied_at timestamptz NOT NULL DEFAULT now()
);`;

/**
 * Lefuttatja a még nem alkalmazott migrációkat, fájlonként egy tranzakcióban.
 * Egy már lefutott, de azóta módosult fájl hibát dob (új migrációt kell írni helyette).
 * Visszaadja az újonnan alkalmazott fájlok nevét.
 */
export async function migrate(db: SqlExecutor, migrations: Migration[] = loadMigrations()): Promise<string[]> {
	await db.exec(LEDGER_SQL);
	const { rows } = await db.query<{ name: string; checksum: string }>('SELECT name, checksum FROM schema_migration');
	const applied = new Map(rows.map((r) => [r.name, r.checksum]));
	const done: string[] = [];
	for (const m of migrations) {
		const prev = applied.get(m.name);
		if (prev !== undefined) {
			if (prev !== m.checksum) throw new Error(`Migration ${m.name} changed after it was applied`);
			continue;
		}
		await db.exec('BEGIN');
		try {
			await db.exec(m.sql);
			await db.query('INSERT INTO schema_migration (name, checksum) VALUES ($1, $2)', [m.name, m.checksum]);
			await db.exec('COMMIT');
		} catch (err) {
			await db.exec('ROLLBACK');
			throw err;
		}
		done.push(m.name);
	}
	return done;
}
