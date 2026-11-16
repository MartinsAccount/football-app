import type { LeagueCoverageDto, LeagueDto } from '@football/contract';
import type { SqlExecutor } from '@football/db';

/**
 * Liga-katalógus olvasó (I18b, ROADMAP 2.3): `league` + aktuális `season` (`is_current`, különben a legnagyobb év) +
 * a tárolt `coverage` (I16) + csapatszám. A csapatszám a `season_team` legutóbbi kitöltött szezonjából jön, ennek hiányában
 * a `fixture` tábla legutóbbi szezonjának csapataiból; egyik sincs → `null`. Coverage-et nem találunk ki: a tárolt API-objektum
 * jelzői közül csak a ténylegesen boolean értékűek kerülnek át, a többi `null`.
 * TODO(polish): szűrés (`?q=`, ország) és lapozás, ha a teljes `/leagues` katalógus (~1000 liga) bekerül.
 */

const flag = (x: unknown): boolean | null => (typeof x === 'boolean' ? x : null);

/** Tiszta: a nyers API `coverage` objektumból a UI-hoz kellő három jelző; nem objektum → `null`. */
export function toCoverageDto(raw: unknown): LeagueCoverageDto | null {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
	const c = raw as { odds?: unknown; injuries?: unknown; fixtures?: { statistics_fixtures?: unknown } | null };
	return {
		odds: flag(c.odds),
		injuries: flag(c.injuries),
		statistics: flag(c.fixtures && typeof c.fixtures === 'object' ? c.fixtures.statistics_fixtures : undefined)
	};
}

interface LeagueCatalogRow {
	id: number;
	name: string;
	country: string | null;
	type: string | null;
	logo_url: string | null;
	season: number | null;
	coverage: unknown;
	st_count: number | null;
	fx_count: number | null;
}

export async function loadLeagueCatalog(db: SqlExecutor): Promise<LeagueDto[]> {
	const { rows } = await db.query<LeagueCatalogRow>(
		`WITH cur AS (
			SELECT DISTINCT ON (league_id) league_id, year, coverage
			FROM season ORDER BY league_id, is_current DESC, year DESC
		), st AS (
			SELECT DISTINCT ON (league_id) league_id, n FROM (
				SELECT league_id, year, count(*)::int AS n FROM season_team GROUP BY league_id, year
			) x ORDER BY league_id, year DESC
		), fx AS (
			SELECT DISTINCT ON (league_id) league_id, n FROM (
				SELECT league_id, season, count(DISTINCT t)::int AS n
				FROM fixture, LATERAL (VALUES (home_team_id), (away_team_id)) AS v(t)
				GROUP BY league_id, season
			) y ORDER BY league_id, season DESC
		)
		SELECT l.id::float8 AS id, l.name, l.country, l.type, l.logo_url, cur.year AS season, cur.coverage,
			st.n AS st_count, fx.n AS fx_count
		FROM league l
		LEFT JOIN cur ON cur.league_id = l.id
		LEFT JOIN st ON st.league_id = l.id
		LEFT JOIN fx ON fx.league_id = l.id
		ORDER BY l.name, l.id`
	);
	return rows.map((r) => ({
		id: r.id,
		name: r.name,
		country: r.country,
		type: r.type === 'league' || r.type === 'cup' ? r.type : null,
		logoUrl: r.logo_url,
		season: r.season,
		teamCount: r.st_count || r.fx_count || null,
		coverage: toCoverageDto(r.coverage)
	}));
}
