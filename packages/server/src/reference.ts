import { ApiFootballError, type ApiFootballClient } from '@football/api-client';
import { BETS_TYPES } from '@football/core';
import type { SqlExecutor, StoredTask } from '@football/db';
import type { TaskHandler } from './ingestWorker';

/**
 * `reference` jobok (ROADMAP 2.2, 3.2, architecture.md §7.2): `leagues` (katalógus + `coverage`), `teams` (liga × szezon),
 * `odds/bookmakers`, `odds/bets` → upsert a `league` / `season` / `team` / `season_team` / `bookmaker` / `market` táblákba. Csak upsert, törlés nincs; a felhasználói `stored` beállítást nem
 * írja felül. Mock módban a válasz a mentett fixture-ökből jön (0 élő hívás).
 */

export interface TeamRow {
	id: number;
	name: string;
	code: string | null;
	country: string | null;
	logoUrl: string | null;
}
export interface NamedRow {
	id: number;
	name: string;
}
export interface MarketRow extends NamedRow {
	/** Magyar domain-név (`BETS_TYPES` kulcs), ha ismert piac. */
	code: string | null;
	/** Az app elemzi-e (= ismert `BETS_TYPES` piac). */
	analyzed: boolean;
}

/** API bet-név → `BETS_TYPES` kulcs (pl. `Match Winner` → `Vegeredmeny`). */
const CODE_BY_NAME = new Map<string, string>(Object.entries(BETS_TYPES).map(([code, name]) => [name, code]));

interface ApiTeamItem {
	team?: { id?: number; name?: string; code?: string | null; country?: string | null; logo?: string | null };
}

export function toTeamRows(response: readonly ApiTeamItem[]): TeamRow[] {
	const out = new Map<number, TeamRow>();
	for (const { team } of response) {
		if (!team || typeof team.id !== 'number' || !team.name) continue;
		out.set(team.id, {
			id: team.id,
			name: team.name,
			code: team.code ?? null,
			country: team.country ?? null,
			logoUrl: team.logo ?? null
		});
	}
	return [...out.values()];
}

export function toNamedRows(response: readonly { id?: number; name?: string }[]): NamedRow[] {
	const out = new Map<number, NamedRow>();
	for (const r of response) if (typeof r.id === 'number' && r.name) out.set(r.id, { id: r.id, name: r.name });
	return [...out.values()];
}

export function toMarketRows(response: readonly { id?: number; name?: string }[]): MarketRow[] {
	return toNamedRows(response).map((r) => {
		const code = CODE_BY_NAME.get(r.name) ?? null;
		return { ...r, code, analyzed: code !== null };
	});
}

/** Csapatok upsertje; a hiányzó (null) mező nem írja felül a meglévőt. A változott/új sorok száma. */
export async function upsertTeams(db: SqlExecutor, rows: readonly TeamRow[]): Promise<number> {
	let n = 0;
	for (const r of rows) {
		const res = await db.query<{ id: number }>(
			`INSERT INTO team (id, name, code, country, logo_url) VALUES ($1, $2, $3, $4, $5)
			 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
				code = COALESCE(EXCLUDED.code, team.code),
				country = COALESCE(EXCLUDED.country, team.country),
				logo_url = COALESCE(EXCLUDED.logo_url, team.logo_url)
			 WHERE (team.name, team.code, team.country, team.logo_url) IS DISTINCT FROM
				(EXCLUDED.name, COALESCE(EXCLUDED.code, team.code), COALESCE(EXCLUDED.country, team.country),
				 COALESCE(EXCLUDED.logo_url, team.logo_url))
			 RETURNING id`,
			[r.id, r.name, r.code, r.country, r.logoUrl]
		);
		n += res.rows.length;
	}
	return n;
}

/**
 * Liga × szezon tagság (`season_team`). A `season` sort létrehozza, ha a liga ismert (FK); ismeretlen ligánál kimarad.
 * A beszúrt tagságok száma.
 */
export async function upsertSeasonTeams(
	db: SqlExecutor,
	leagueId: number,
	year: number,
	teamIds: readonly number[]
): Promise<number> {
	await db.query(
		`INSERT INTO season (league_id, year) SELECT $1::bigint, $2::int WHERE EXISTS (SELECT 1 FROM league WHERE id = $1::bigint)
		 ON CONFLICT DO NOTHING`,
		[leagueId, year]
	);
	let n = 0;
	for (const id of teamIds) {
		const res = await db.query<{ team_id: number }>(
			`INSERT INTO season_team (league_id, year, team_id)
			 SELECT $1::bigint, $2::int, $3::bigint WHERE EXISTS (SELECT 1 FROM season WHERE league_id = $1::bigint AND year = $2::int)
			 ON CONFLICT DO NOTHING RETURNING team_id`,
			[leagueId, year, id]
		);
		n += res.rows.length;
	}
	return n;
}

/** Fogadóirodák: csak a név frissül, a `stored` (tárolási beállítás) marad. */
export async function upsertBookmakers(db: SqlExecutor, rows: readonly NamedRow[]): Promise<number> {
	let n = 0;
	for (const r of rows) {
		const res = await db.query<{ id: number }>(
			`INSERT INTO bookmaker (id, name) VALUES ($1, $2)
			 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name WHERE bookmaker.name IS DISTINCT FROM EXCLUDED.name
			 RETURNING id`,
			[r.id, r.name]
		);
		n += res.rows.length;
	}
	return n;
}

/**
 * Piacok: név, `code` (ha más id még nem foglalja – `code UNIQUE`) és `analyzed`; a `stored` marad. A meglévő kódot nem
 * törli (ismeretlen név → a régi `code` megmarad).
 */
export async function upsertMarkets(db: SqlExecutor, rows: readonly MarketRow[]): Promise<number> {
	let n = 0;
	for (const r of rows) {
		const res = await db.query<{ id: number }>(
			`WITH v AS (
				SELECT $1::bigint AS id, $2::text AS name,
					CASE WHEN EXISTS (SELECT 1 FROM market WHERE code = $3::text AND id <> $1::bigint) THEN NULL ELSE $3::text END AS code,
					$4::boolean AS analyzed
			)
			INSERT INTO market (id, name, code, analyzed) SELECT id, name, code, analyzed FROM v
			ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = COALESCE(EXCLUDED.code, market.code), analyzed = EXCLUDED.analyzed
			WHERE (market.name, market.code, market.analyzed) IS DISTINCT FROM
				(EXCLUDED.name, COALESCE(EXCLUDED.code, market.code), EXCLUDED.analyzed)
			RETURNING id`,
			[r.id, r.name, r.code, r.analyzed]
		);
		n += res.rows.length;
	}
	return n;
}

// ── Liga-katalógus (ROADMAP 2.2): `/leagues` → `league` + `season` (coverage flagek) ──

export interface ApiLeagueItem {
	league?: { id?: number; name?: string; type?: string | null; logo?: string | null };
	country?: { name?: string | null } | null;
	seasons?: {
		year?: number;
		start?: string | null;
		end?: string | null;
		current?: boolean | null;
		coverage?: Record<string, unknown> | null;
	}[];
}
export interface LeagueRow {
	id: number;
	name: string;
	country: string | null;
	/** `league` | `cup` (az API `League`/`Cup` kisbetűsítve); más érték → null. */
	type: 'league' | 'cup' | null;
	logoUrl: string | null;
}
export interface SeasonRow {
	leagueId: number;
	year: number;
	startDate: string | null;
	endDate: string | null;
	/** null → nem ismert (a meglévő érték marad). */
	isCurrent: boolean | null;
	/** Az API `coverage` objektuma változatlanul; null → nincs adat (a meglévő marad). */
	coverage: Record<string, unknown> | null;
}

const leagueType = (t: string | null | undefined): LeagueRow['type'] => {
	const v = t?.toLowerCase();
	return v === 'league' || v === 'cup' ? v : null;
};

export function toLeagueRows(response: readonly ApiLeagueItem[]): { leagues: LeagueRow[]; seasons: SeasonRow[] } {
	const leagues = new Map<number, LeagueRow>();
	const seasons = new Map<string, SeasonRow>();
	for (const item of response) {
		const l = item.league;
		if (!l || typeof l.id !== 'number' || !l.name) continue;
		leagues.set(l.id, {
			id: l.id,
			name: l.name,
			country: item.country?.name ?? null,
			type: leagueType(l.type),
			logoUrl: l.logo ?? null
		});
		for (const s of item.seasons ?? []) {
			if (typeof s.year !== 'number') continue;
			seasons.set(`${l.id}:${s.year}`, {
				leagueId: l.id,
				year: s.year,
				startDate: s.start ?? null,
				endDate: s.end ?? null,
				isCurrent: typeof s.current === 'boolean' ? s.current : null,
				coverage: s.coverage && typeof s.coverage === 'object' ? s.coverage : null
			});
		}
	}
	return { leagues: [...leagues.values()], seasons: [...seasons.values()] };
}

/**
 * Ligák upsertje egyetlen lekérdezésben (a teljes katalógus ~1000+ sor); a hiányzó (null) mező nem írja felül a meglévőt.
 * A változott/új sorok száma.
 */
export async function upsertLeagues(db: SqlExecutor, rows: readonly LeagueRow[]): Promise<number> {
	if (rows.length === 0) return 0;
	const res = await db.query<{ id: number }>(
		`INSERT INTO league (id, name, country, type, logo_url)
		 SELECT id, name, country, type, logo_url
		 FROM jsonb_to_recordset($1::jsonb) AS r(id bigint, name text, country text, type text, logo_url text)
		 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name,
			country = COALESCE(EXCLUDED.country, league.country),
			type = COALESCE(EXCLUDED.type, league.type),
			logo_url = COALESCE(EXCLUDED.logo_url, league.logo_url)
		 WHERE (league.name, league.country, league.type, league.logo_url) IS DISTINCT FROM
			(EXCLUDED.name, COALESCE(EXCLUDED.country, league.country), COALESCE(EXCLUDED.type, league.type),
			 COALESCE(EXCLUDED.logo_url, league.logo_url))
		 RETURNING id`,
		[JSON.stringify(rows.map((r) => ({ id: r.id, name: r.name, country: r.country, type: r.type, logo_url: r.logoUrl })))]
	);
	return res.rows.length;
}

/**
 * Szezonok upsertje (`season`, egy lekérdezés). Üres mező nem ír felül; a `coverage_checked_at` csak akkor lesz `now`, ha a
 * válasz hozott `coverage`-et. Ismeretlen ligájú sor kimarad (FK). A változott/új sorok száma.
 */
export async function upsertSeasons(db: SqlExecutor, rows: readonly SeasonRow[], now: Date): Promise<number> {
	if (rows.length === 0) return 0;
	const payload = rows.map((r) => ({
		league_id: r.leagueId,
		year: r.year,
		start_date: r.startDate,
		end_date: r.endDate,
		is_current: r.isCurrent,
		coverage: r.coverage
	}));
	const res = await db.query<{ league_id: number }>(
		`INSERT INTO season (league_id, year, start_date, end_date, is_current, coverage, coverage_checked_at)
		 SELECT r.league_id, r.year, r.start_date, r.end_date, COALESCE(r.is_current, false), r.coverage,
			CASE WHEN r.coverage IS NULL THEN NULL ELSE $2::timestamptz END
		 FROM jsonb_to_recordset($1::jsonb)
			AS r(league_id bigint, year int, start_date date, end_date date, is_current boolean, coverage jsonb)
		 WHERE EXISTS (SELECT 1 FROM league WHERE id = r.league_id)
		 ON CONFLICT (league_id, year) DO UPDATE SET
			start_date = COALESCE(EXCLUDED.start_date, season.start_date),
			end_date = COALESCE(EXCLUDED.end_date, season.end_date),
			is_current = CASE WHEN $3::jsonb @> jsonb_build_array(jsonb_build_array(EXCLUDED.league_id, EXCLUDED.year))
				THEN EXCLUDED.is_current ELSE season.is_current END,
			coverage = COALESCE(EXCLUDED.coverage, season.coverage),
			coverage_checked_at = COALESCE(EXCLUDED.coverage_checked_at, season.coverage_checked_at)
		 RETURNING league_id`,
		[
			JSON.stringify(payload),
			now.toISOString(),
			JSON.stringify(rows.filter((r) => r.isCurrent !== null).map((r) => [r.leagueId, r.year]))
		]
	);
	return res.rows.length;
}

/** A planner `endpoint` paramétere (`odds/bets`) → kliens-útvonal (`/odds/bets`). */
const path = (endpoint: unknown) => `/${String(endpoint).replace(/^\/+/, '')}`;

/** Élő módban az elköltött hívás; mockban 0 (nincs budget-foglalás). */
export const spent = (client: ApiFootballClient, n: number) => (client.mode === 'live' ? n : 0);

/** A `reference` kind végrehajtója a `createIngestWorker` `handlers` térképére. */
export function createReferenceHandler(db: SqlExecutor): TaskHandler {
	return async (task: StoredTask, { client, now }) => {
		if (!client) throw new Error('reference: API client missing');
		const p = task.params;
		const endpoint = path(p.endpoint);
		switch (endpoint) {
			case '/teams': {
				const league = Number(p.league);
				const season = Number(p.season);
				const env = await client.get<ApiTeamItem>(endpoint, { league, season }, { taskId: task.id });
				const teams = toTeamRows(env.response);
				await upsertTeams(db, teams);
				await upsertSeasonTeams(
					db,
					league,
					season,
					teams.map((t) => t.id)
				);
				return { calls: spent(client, 1) };
			}
			case '/leagues': {
				// Paraméter nélkül: 1 hívás az összes ligára (api-football.md §6: heti 1).
				const env = await client.get<ApiLeagueItem>(endpoint, {}, { taskId: task.id });
				const { leagues, seasons } = toLeagueRows(env.response);
				await upsertLeagues(db, leagues);
				await upsertSeasons(db, seasons, now);
				return { calls: spent(client, 1) };
			}
			case '/odds/bookmakers': {
				const env = await client.get<NamedRow>(endpoint, {}, { taskId: task.id });
				await upsertBookmakers(db, toNamedRows(env.response));
				return { calls: spent(client, 1) };
			}
			case '/odds/bets': {
				const env = await client.get<NamedRow>(endpoint, {}, { taskId: task.id });
				await upsertMarkets(db, toMarketRows(env.response));
				return { calls: spent(client, 1) };
			}
			default:
				throw new ApiFootballError('api', `reference: unknown endpoint ${endpoint}`, { endpoint });
		}
	};
}
