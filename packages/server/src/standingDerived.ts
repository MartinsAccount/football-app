import { deriveStandings, type PlayedMatch, type StandingRow } from '@football/core';
import type { SqlExecutor } from '@football/db';

/**
 * `standing_derived` (ROADMAP 4.3, architecture.md §10.2): pont-idejű tabella a `fixture` táblából a core `deriveStandings`-szel.
 * Az `as_of` pontok: minden meccsnap UTC-éjfele (a tabella a nap meccsei ELŐTT) + a legutolsó befejezett meccsnap utáni éjfél
 * (aktuális tabella). Upsert (`ON CONFLICT DO UPDATE`): a sorok a meccsekből bármikor újraszámolhatók. A `season` sor nélkül
 * nem ír (FK). TODO(polish): ligánkénti tiebreak (H2H) és pontlevonás – a core közelítése marad.
 */

const FINISHED = ['FT', 'AET', 'PEN'];
const DAY = 86_400_000;

const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY;

/** Egy liga×szezon befejezett meccsei és a szezon összes csapata (a még meccs nélküliek is, a `fixture` tábla szerint). */
export async function loadSeasonMatches(
	db: SqlExecutor,
	league: number,
	season: number
): Promise<{ matches: PlayedMatch[]; teamIds: number[] }> {
	const { rows } = await db.query<{
		id: number;
		k: unknown;
		h: number;
		a: number;
		gh: number | null;
		ga: number | null;
		s: string;
	}>(
		`SELECT id::float8 AS id, kickoff_at AS k, home_team_id::float8 AS h, away_team_id::float8 AS a, goals_home AS gh,
			goals_away AS ga, status AS s
		 FROM fixture WHERE league_id = $1::bigint AND season = $2::int`,
		[league, season]
	);
	const teams = new Set<number>();
	const matches: PlayedMatch[] = [];
	for (const r of rows) {
		teams.add(r.h).add(r.a);
		if (!FINISHED.includes(r.s) || r.gh === null || r.ga === null) continue;
		const kickoff = new Date(r.k as string).toISOString();
		matches.push({ id: r.id, kickoff, homeTeamId: r.h, awayTeamId: r.a, homeGoals: r.gh, awayGoals: r.ga });
	}
	return { matches, teamIds: [...teams].sort((x, y) => x - y) };
}

/** A meccsnapok UTC-éjfelei + az utolsó meccsnap utáni éjfél, növekvő ISO-lista (üres, ha nincs befejezett meccs). */
export function matchdayAsOfs(matches: readonly PlayedMatch[]): string[] {
	const days = new Set(matches.map((m) => dayStart(Date.parse(m.kickoff))));
	if (!days.size) return [];
	days.add(Math.max(...days) + DAY);
	return [...days].sort((x, y) => x - y).map((ms) => new Date(ms).toISOString());
}

/** Egy tabella upsertje egy `as_of`-ra (egy többsoros utasítás). A kiírt sorok száma (0, ha nincs `season` sor). */
export async function upsertStandingDerived(
	db: SqlExecutor,
	league: number,
	season: number,
	asOf: string,
	table: readonly StandingRow[]
): Promise<number> {
	if (!table.length) return 0;
	const col = <K extends keyof StandingRow>(k: K) => table.map((r) => r[k]);
	const res = await db.query<{ team_id: number }>(
		`INSERT INTO standing_derived (league_id, season, as_of, team_id, rank, points, played, win, draw, lose, gf, ga, computed_at)
		 SELECT $1::bigint, $2::int, $3::timestamptz, t, r, p, pl, w, d, l, f, a, now()
		 FROM unnest($4::bigint[], $5::int[], $6::int[], $7::int[], $8::int[], $9::int[], $10::int[], $11::int[], $12::int[])
			AS x (t, r, p, pl, w, d, l, f, a)
		 WHERE EXISTS (SELECT 1 FROM season WHERE league_id = $1::bigint AND year = $2::int)
			AND EXISTS (SELECT 1 FROM team WHERE id = x.t)
		 ON CONFLICT (league_id, season, as_of, team_id) DO UPDATE SET rank = EXCLUDED.rank, points = EXCLUDED.points,
			played = EXCLUDED.played, win = EXCLUDED.win, draw = EXCLUDED.draw, lose = EXCLUDED.lose, gf = EXCLUDED.gf,
			ga = EXCLUDED.ga, computed_at = EXCLUDED.computed_at
		 RETURNING team_id`,
		[
			league,
			season,
			asOf,
			col('teamId'),
			col('position'),
			col('points'),
			col('played'),
			col('won'),
			col('drawn'),
			col('lost'),
			col('goalsFor'),
			col('goalsAgainst')
		]
	);
	return res.rows.length;
}

/**
 * Egy liga×szezon összes pont-idejű tabellájának (újra)számolása és mentése. `asOfs`: alapból a `matchdayAsOfs`.
 * A kiírt sorok száma.
 */
export async function refreshStandingDerived(
	db: SqlExecutor,
	league: number,
	season: number,
	asOfs?: readonly string[]
): Promise<number> {
	const { matches, teamIds } = await loadSeasonMatches(db, league, season);
	let n = 0;
	for (const asOf of asOfs ?? matchdayAsOfs(matches))
		n += await upsertStandingDerived(db, league, season, asOf, deriveStandings(matches, asOf, teamIds));
	return n;
}
