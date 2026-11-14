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
	// Időkorlátok: instabil hálózaton (TLS-proxy, pooler) egy lekérdezés különben órákig lóghat, és megakasztja a scriptet.
	const client = new pg.Client({
		connectionString,
		ssl: { rejectUnauthorized: false },
		connectionTimeoutMillis: 30_000,
		query_timeout: 120_000,
		keepAlive: true
	});
	await client.connect();
	// Egy kliensen a párhuzamos `client.query()` elavult (pg@9-ben megszűnik): a hívásokat sorba fűzzük (a szerver is
	// `Promise.all`-lal kérdez).
	let tail: Promise<unknown> = Promise.resolve();
	const serial = <R>(run: () => Promise<R>): Promise<R> => {
		const next = tail.then(run, run);
		tail = next.catch(() => undefined);
		return next;
	};
	return {
		exec: (sql) => serial(() => client.query(sql)),
		query: <T>(sql: string, params?: unknown[]) => serial(async () => ({ rows: (await client.query(sql, params)).rows as T[] })),
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
