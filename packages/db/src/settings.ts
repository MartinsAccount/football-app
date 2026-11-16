import type { StoredScopeInput } from '@football/core';
import type { SqlExecutor } from './migrate';

/**
 * Beállítás-repository (ROADMAP 2.1, architecture.md §4.1, §10.5): `followed_league`, `team_filter`, `setting`,
 * valamint a `market.stored` / `bookmaker.stored` tárolási jelzők. Csak upsert és egyedi (kulcs szerinti) törlés.
 */

export interface FollowedLeague {
	leagueId: number;
	enabled: boolean;
	priority: number;
	/** Ligánkénti piac-felülírás (piackódok); `null` = globális `market.stored`. */
	markets: string[] | null;
	addedAt: string;
}

export interface FollowedLeagueInput {
	leagueId: number;
	enabled?: boolean;
	priority?: number;
	markets?: string[] | null;
}

export type TeamFilterMode = 'include' | 'exclude';

export interface TeamFilter {
	teamId: number;
	mode: TeamFilterMode;
}

export interface StoredFlagRow {
	id: number;
	name: string;
	stored: boolean;
}

export interface MarketRow extends StoredFlagRow {
	code: string | null;
}

export interface SettingsRepository {
	listFollowedLeagues(): Promise<FollowedLeague[]>;
	/** Upsert; a meg nem adott mező meglévő sornál változatlan marad, új sornál a DB-alapérték. */
	upsertFollowedLeague(input: FollowedLeagueInput): Promise<void>;
	removeFollowedLeague(leagueId: number): Promise<boolean>;
	listTeamFilters(): Promise<TeamFilter[]>;
	upsertTeamFilter(filter: TeamFilter): Promise<void>;
	removeTeamFilter(teamId: number): Promise<boolean>;
	getSettings(): Promise<Record<string, unknown>>;
	getSetting<T = unknown>(key: string): Promise<T | undefined>;
	setSetting(key: string, value: unknown): Promise<void>;
	listMarkets(): Promise<MarketRow[]>;
	listBookmakers(): Promise<StoredFlagRow[]>;
	setMarketStored(id: number, stored: boolean): Promise<boolean>;
	setBookmakerStored(id: number, stored: boolean): Promise<boolean>;
	/** A core `resolveStoredScope` bemenete egy lekérésben. */
	loadStoredScopeInput(): Promise<StoredScopeInput>;
}

export class SqlSettingsRepository implements SettingsRepository {
	constructor(private readonly db: SqlExecutor) {}

	async listFollowedLeagues(): Promise<FollowedLeague[]> {
		const { rows } = await this.db.query<Omit<FollowedLeague, 'addedAt'> & { addedAt: unknown }>(
			`SELECT league_id::float8 AS "leagueId", enabled, priority::int AS priority, markets, added_at AS "addedAt"
			 FROM followed_league ORDER BY priority DESC, league_id`
		);
		return rows.map((r) => ({ ...r, addedAt: new Date(r.addedAt as string).toISOString() }));
	}

	async upsertFollowedLeague(input: FollowedLeagueInput): Promise<void> {
		const hasMarkets = input.markets !== undefined;
		await this.db.query(
			`INSERT INTO followed_league (league_id, enabled, priority, markets)
			 VALUES ($1, COALESCE($2::boolean, true), COALESCE($3::smallint, 0), $4::text[])
			 ON CONFLICT (league_id) DO UPDATE SET
				enabled = COALESCE($2::boolean, followed_league.enabled),
				priority = COALESCE($3::smallint, followed_league.priority),
				markets = CASE WHEN $5::boolean THEN EXCLUDED.markets ELSE followed_league.markets END`,
			[input.leagueId, input.enabled ?? null, input.priority ?? null, input.markets ?? null, hasMarkets]
		);
	}

	async removeFollowedLeague(leagueId: number): Promise<boolean> {
		const { rows } = await this.db.query(`DELETE FROM followed_league WHERE league_id = $1 RETURNING league_id`, [leagueId]);
		return rows.length > 0;
	}

	async listTeamFilters(): Promise<TeamFilter[]> {
		const { rows } = await this.db.query<TeamFilter>(
			`SELECT team_id::float8 AS "teamId", mode FROM team_filter ORDER BY team_id`
		);
		return rows;
	}

	async upsertTeamFilter(filter: TeamFilter): Promise<void> {
		await this.db.query(
			`INSERT INTO team_filter (team_id, mode) VALUES ($1, $2) ON CONFLICT (team_id) DO UPDATE SET mode = EXCLUDED.mode`,
			[filter.teamId, filter.mode]
		);
	}

	async removeTeamFilter(teamId: number): Promise<boolean> {
		const { rows } = await this.db.query(`DELETE FROM team_filter WHERE team_id = $1 RETURNING team_id`, [teamId]);
		return rows.length > 0;
	}

	async getSettings(): Promise<Record<string, unknown>> {
		const { rows } = await this.db.query<{ key: string; value: unknown }>(`SELECT key, value FROM setting ORDER BY key`);
		return Object.fromEntries(rows.map((r) => [r.key, r.value]));
	}

	async getSetting<T = unknown>(key: string): Promise<T | undefined> {
		const { rows } = await this.db.query<{ value: T }>(`SELECT value FROM setting WHERE key = $1`, [key]);
		return rows[0]?.value;
	}

	async setSetting(key: string, value: unknown): Promise<void> {
		if (value === undefined) throw new Error(`setSetting(${key}): az érték nem lehet undefined`);
		await this.db.query(
			`INSERT INTO setting (key, value, updated_at) VALUES ($1, $2::jsonb, now())
			 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
			[key, JSON.stringify(value)]
		);
	}

	async listMarkets(): Promise<MarketRow[]> {
		const { rows } = await this.db.query<MarketRow>(`SELECT id::float8 AS id, name, code, stored FROM market ORDER BY id`);
		return rows;
	}

	async listBookmakers(): Promise<StoredFlagRow[]> {
		const { rows } = await this.db.query<StoredFlagRow>(`SELECT id::float8 AS id, name, stored FROM bookmaker ORDER BY id`);
		return rows;
	}

	async setMarketStored(id: number, stored: boolean): Promise<boolean> {
		const { rows } = await this.db.query(`UPDATE market SET stored = $2 WHERE id = $1 RETURNING id`, [id, stored]);
		return rows.length > 0;
	}

	async setBookmakerStored(id: number, stored: boolean): Promise<boolean> {
		const { rows } = await this.db.query(`UPDATE bookmaker SET stored = $2 WHERE id = $1 RETURNING id`, [id, stored]);
		return rows.length > 0;
	}

	async loadStoredScopeInput(): Promise<StoredScopeInput> {
		const [leagues, markets, bookmakers] = await Promise.all([
			this.listFollowedLeagues(),
			this.listMarkets(),
			this.listBookmakers()
		]);
		return {
			leagues: leagues.map(({ leagueId, enabled, markets: m }) => ({ leagueId, enabled, markets: m })),
			markets: markets.map(({ id, code, stored }) => ({ id, code, stored })),
			bookmakers: bookmakers.map(({ id, stored }) => ({ id, stored }))
		};
	}
}
