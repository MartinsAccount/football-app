import type { SqlExecutor, StoredTask } from '@football/db';
import type { TaskHandler } from './ingestWorker';
import { spent, upsertSeasonTeams, upsertTeams, type TeamRow } from './reference';

/**
 * `fixtures_window` job (ROADMAP 3.3a, architecture.md §7.2): `/fixtures?league&season&from&to` → upsert a `fixture` táblába
 * (+ a hiányzó `team` és `season_team` sorok). Csak upsert, törlés nincs; a hiányzó (null) mező nem írja felül a meglévőt
 * (pl. egy korábbi eredményt). Mock módban a válasz a mentett meccslistákból jön (0 élő hívás).
 */

export interface ApiFixtureItem {
	fixture?: {
		id?: number;
		referee?: string | null;
		date?: string;
		venue?: { id?: number | null } | null;
		status?: { short?: string };
	};
	league?: { id?: number; season?: number; round?: string | null };
	teams?: {
		home?: { id?: number; name?: string; logo?: string | null };
		away?: { id?: number; name?: string; logo?: string | null };
	};
	goals?: { home?: number | null; away?: number | null };
	score?: Partial<Record<'halftime' | 'fulltime' | 'extratime' | 'penalty', { home?: number | null; away?: number | null }>>;
}

export interface FixtureRow {
	id: number;
	leagueId: number;
	season: number;
	round: string | null;
	kickoffAt: string;
	status: string;
	homeTeamId: number;
	awayTeamId: number;
	goalsHome: number | null;
	goalsAway: number | null;
	htHome: number | null;
	htAway: number | null;
	ftHome: number | null;
	ftAway: number | null;
	etHome: number | null;
	etAway: number | null;
	penHome: number | null;
	penAway: number | null;
	venueId: number | null;
	referee: string | null;
}

const n = (v: number | null | undefined) => (typeof v === 'number' ? v : null);

/** API `/fixtures` válasz → `fixture` sorok (hiányos elem kimarad) + a benne szereplő csapatok. */
export function toFixtureRows(response: readonly ApiFixtureItem[]): { fixtures: FixtureRow[]; teams: TeamRow[] } {
	const fixtures = new Map<number, FixtureRow>();
	const teams = new Map<number, TeamRow>();
	for (const i of response) {
		const f = i.fixture;
		const home = i.teams?.home;
		const away = i.teams?.away;
		if (!f || typeof f.id !== 'number' || !f.date || !f.status?.short) continue;
		if (typeof i.league?.id !== 'number' || typeof i.league.season !== 'number') continue;
		if (typeof home?.id !== 'number' || typeof away?.id !== 'number' || home.id === away.id) continue;
		for (const t of [home, away])
			if (t.name && typeof t.id === 'number')
				teams.set(t.id, { id: t.id, name: t.name, code: null, country: null, logoUrl: t.logo ?? null });
		const s = i.score ?? {};
		fixtures.set(f.id, {
			id: f.id,
			leagueId: i.league.id,
			season: i.league.season,
			round: i.league.round ?? null,
			kickoffAt: new Date(f.date).toISOString(),
			status: f.status.short,
			homeTeamId: home.id,
			awayTeamId: away.id,
			goalsHome: n(i.goals?.home),
			goalsAway: n(i.goals?.away),
			htHome: n(s.halftime?.home),
			htAway: n(s.halftime?.away),
			ftHome: n(s.fulltime?.home),
			ftAway: n(s.fulltime?.away),
			etHome: n(s.extratime?.home),
			etAway: n(s.extratime?.away),
			penHome: n(s.penalty?.home),
			penAway: n(s.penalty?.away),
			venueId: n(f.venue?.id),
			referee: f.referee ?? null
		});
	}
	return { fixtures: [...fixtures.values()], teams: [...teams.values()] };
}

/** Mindig a forrás értéke (kezdés, státusz, felállás); a többi oszlopnál a null nem írja felül a meglévőt. */
const ALWAYS = ['league_id', 'season', 'kickoff_at', 'status', 'home_team_id', 'away_team_id'];
const KEEP = [
	'round',
	'goals_home',
	'goals_away',
	'ht_home',
	'ht_away',
	'ft_home',
	'ft_away',
	'et_home',
	'et_away',
	'pen_home',
	'pen_away',
	'venue_id',
	'referee'
];
const COLS = ['id', ...ALWAYS, ...KEEP];
const NEW_VAL = (c: string) => (KEEP.includes(c) ? `COALESCE(EXCLUDED.${c}, fixture.${c})` : `EXCLUDED.${c}`);
const UPSERT_FIXTURE = `INSERT INTO fixture (${COLS.join(', ')}) VALUES (${COLS.map((_, i) => `$${i + 1}`).join(', ')})
	ON CONFLICT (id) DO UPDATE SET ${[...ALWAYS, ...KEEP].map((c) => `${c} = ${NEW_VAL(c)}`).join(', ')}, updated_at = now()
	WHERE (${[...ALWAYS, ...KEEP].map((c) => `fixture.${c}`).join(', ')}) IS DISTINCT FROM
		(${[...ALWAYS, ...KEEP].map(NEW_VAL).join(', ')})
	RETURNING id`;

/** Meccsek upsertje; a liga sorának léteznie kell (FK). A változott/új sorok száma. */
export async function upsertFixtureRows(db: SqlExecutor, rows: readonly FixtureRow[]): Promise<number> {
	let changed = 0;
	for (const r of rows) {
		const res = await db.query<{ id: number }>(UPSERT_FIXTURE, [
			r.id,
			r.leagueId,
			r.season,
			r.kickoffAt,
			r.status,
			r.homeTeamId,
			r.awayTeamId,
			r.round,
			r.goalsHome,
			r.goalsAway,
			r.htHome,
			r.htAway,
			r.ftHome,
			r.ftAway,
			r.etHome,
			r.etAway,
			r.penHome,
			r.penAway,
			r.venueId,
			r.referee
		]);
		changed += res.rows.length;
	}
	return changed;
}

/** A `fixtures_window` kind végrehajtója a `createIngestWorker` `handlers` térképére. */
export function createFixturesWindowHandler(db: SqlExecutor): TaskHandler {
	return async (task: StoredTask, { client }) => {
		if (!client) throw new Error('fixtures_window: API client missing');
		const { league, season, from, to } = task.params;
		const params = { league: Number(league), season: Number(season), from: String(from), to: String(to) };
		const env = await client.get<ApiFixtureItem>('/fixtures', params, { taskId: task.id });
		const { fixtures, teams } = toFixtureRows(env.response);
		await upsertTeams(db, teams);
		await upsertSeasonTeams(
			db,
			params.league,
			params.season,
			teams.map((t) => t.id)
		);
		await upsertFixtureRows(db, fixtures);
		return { calls: spent(client, 1) };
	};
}
