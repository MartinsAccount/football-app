// Történeti meccsadat 2022–2024 (S11, ROADMAP 4.1 előfutára): `/fixtures?league&season`, 5 liga × 3 szezon = ≤ 15 élő hívás.
// Futtatás: `npm run fetch:history -w @football/api-client` (élő; a kulcs a `API_FOOTBALL_KEY` env-ből vagy a
// `frontend/.env` `VITE_APISPORTS_KEY`-ből, soha nem íródik ki). Már mentett fájlt NEM kér le újra.
// Napló + budget: `.data/pglite` (`api_call_log`, `api_budget_day`); a válasz `data/history/api-football/` alá kerül (minifikált).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openMemoryRepository } from '@football/db';
import { ApiFootballClient, SqlBudgetStore, SqlCallLogger } from '../src';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = join(ROOT, 'data', 'history', 'api-football');
/** Premier League, Ligue 1, Bundesliga, Serie A, La Liga (a legacy adat 5 országa). */
export const HISTORY_LEAGUES = [39, 61, 78, 135, 140];
export const HISTORY_SEASONS = [2022, 2023, 2024];
/** Fejlesztési napi plafon (CLAUDE.md Autonóm munkamód §3). */
const DEV_CAP = 20;

function readKey(): string {
	if (process.env.API_FOOTBALL_KEY) return process.env.API_FOOTBALL_KEY;
	const env = readFileSync(join(ROOT, 'frontend', '.env'), 'utf8');
	const m = /^VITE_APISPORTS_KEY=(.+)$/m.exec(env);
	if (!m) throw new Error('no API key (API_FOOTBALL_KEY or frontend/.env VITE_APISPORTS_KEY)');
	return m[1].trim();
}

mkdirSync(OUT, { recursive: true });
const todo = HISTORY_LEAGUES.flatMap((league) => HISTORY_SEASONS.map((season) => ({ league, season }))).filter(
	({ league, season }) => !existsSync(join(OUT, `fixtures-${league}-${season}.json`))
);
console.log(`hiányzó liga×szezon: ${todo.length}`);
if (todo.length > 0) {
	const { db } = await openMemoryRepository(join(ROOT, '.data', 'pglite'));
	const client = new ApiFootballClient({
		mode: 'live',
		apiKey: readKey(),
		budget: new SqlBudgetStore(db),
		logger: new SqlCallLogger(db)
	});
	try {
		const before = await client.status();
		console.log(`/status előtte: ${before.current}/${before.limitDay}`);
		if (before.current + todo.length > DEV_CAP)
			throw new Error(`a mai keret (${DEV_CAP}) nem elég: ${before.current} + ${todo.length}`);
		for (const { league, season } of todo) {
			const env = await client.get('/fixtures', { league, season }, { cap: DEV_CAP });
			writeFileSync(join(OUT, `fixtures-${league}-${season}.json`), JSON.stringify(env));
			console.log(`fixtures league=${league} season=${season}: ${env.results} meccs`);
		}
		const after = await client.status();
		console.log(`/status utána: ${after.current}/${after.limitDay}`);
	} finally {
		await db.close();
	}
}
