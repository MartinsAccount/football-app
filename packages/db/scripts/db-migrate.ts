// Migrációk futtatása a valódi Postgresen (Supabase): a `DATABASE_URL` a környezetből vagy a gyökér `.env`-ből jön.
// Idempotens: a már alkalmazott fájlokat a `schema_migration` alapján kihagyja, módosult fájlra hibát dob.
// Futtatás: `npm run db:migrate -w @football/db` (a gépen: NODE_OPTIONS=--use-system-ca, sandboxon kívül).
import { fileURLToPath } from 'node:url';
import { migrate } from '../src/migrate';
import { openPg, readDatabaseUrl } from '../src/pg';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const db = await openPg(readDatabaseUrl(`${ROOT}.env`));
try {
	const applied = await migrate(db);
	const { rows } = await db.query<{ name: string }>('SELECT name FROM schema_migration ORDER BY name');
	console.log(`új migráció: ${applied.length ? applied.join(', ') : 'nincs'}`);
	console.log(`alkalmazva összesen: ${rows.length} (${rows.map((r) => r.name).join(', ')})`);
} finally {
	await db.close();
}
