import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { SqlExecutor } from './migrate';

/**
 * `pg.Client` mint `SqlExecutor`: egyetlen kapcsolat, így a `migrate()` BEGIN/COMMIT-ja ugyanazon a sessionön fut
 * (pool-lal nem lenne garantált). Supabase-hez a Session pooler URI-t (5432) használjuk; a Direct connection free
 * csomagon csak IPv6.
 */
export interface PgExecutor extends SqlExecutor {
	close(): Promise<void>;
}

export async function openPg(connectionString: string): Promise<PgExecutor> {
	// TODO(polish): TLS-ellenőrzés a Supabase CA-val (prod-ca-2021.crt); most titkosított, de a tanúsítvány nincs ellenőrizve.
	const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
	await client.connect();
	return {
		exec: (sql) => client.query(sql),
		query: async <T>(sql: string, params?: unknown[]) => ({ rows: (await client.query(sql, params)).rows as T[] }),
		close: () => client.end()
	};
}

/** `DATABASE_URL` a környezetből, különben a megadott `.env` fájlból. A címet soha nem írjuk ki. */
export function readDatabaseUrl(envFile?: string): string {
	if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
	if (envFile) {
		try {
			const line = readFileSync(envFile, 'utf8')
				.split(/\r?\n/)
				.find((l) => l.startsWith('DATABASE_URL='));
			if (line) return line.slice('DATABASE_URL='.length).trim();
		} catch {
			// nincs .env → lent hibát dobunk
		}
	}
	throw new Error('DATABASE_URL hiányzik (környezeti változó vagy a gyökér .env)');
}
