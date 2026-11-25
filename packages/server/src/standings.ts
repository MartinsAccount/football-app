import type { SqlExecutor, StoredTask } from '@football/db';
import type { TaskHandler } from './ingestWorker';
import { spent, upsertSeasonTeams, upsertTeams, type TeamRow } from './reference';

/**
 * `standings` job (ROADMAP 3.4, architecture.md §7.2): `/standings?league&season` (1 hívás) → `standing_snapshot` sorok a futás
 * idejével (`captured_at`). A planner a forduló (ha nincs, a meccsnap) előtti UTC-napra ütemezi. Csak insert
 * (`ON CONFLICT DO NOTHING`); az API csak az aktuális tabellát adja, a pont-idejű tabellát a meccsekből számoljuk (4.3).
 */

/** Egy tabellasor az API `/standings` válaszában (`response[].league.standings[][]`). */
export interface ApiStandingEntry {
	rank?: number;
	team?: { id?: number; name?: string; logo?: string | null };
	points?: number;
	goalsDiff?: number;
	group?: string | null;
	form?: string | null;
	description?: string | null;
	all?: { played?: number; win?: number; draw?: number; lose?: number; goals?: { for?: number; against?: number } };
}

export interface ApiStandingsItem {
	league?: { id?: number; season?: number; standings?: ApiStandingEntry[][] };
}

export interface StandingSnapshotRow {
	leagueId: number;
	season: number;
	teamId: number;
	rank: number;
	points: number;
	played: number;
	win: number;
	draw: number;
	lose: number;
	gf: number;
	ga: number;
	form: string | null;
	description: string | null;
	groupName: string | null;
}

const int = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) ? v : null);

/**
 * API `/standings` válasz → snapshot sorok (+ a benne szereplő csapatok). Csak a kért liga×szezon; hiányos sor kimarad.
 * Csoportos ligánál (több tábla) csapatonként az első előfordulás marad (PK: liga, szezon, időpont, csapat).
 */
export function toStandingRows(
	response: readonly ApiStandingsItem[],
	leagueId: number,
	season: number
): { rows: StandingSnapshotRow[]; teams: TeamRow[] } {
	const rows = new Map<number, StandingSnapshotRow>();
	const teams = new Map<number, TeamRow>();
	for (const item of response) {
		if (item.league?.id !== leagueId || item.league.season !== season) continue;
		for (const table of item.league.standings ?? [])
			for (const e of table ?? []) {
				const teamId = int(e.team?.id);
				const nums = [
					e.rank,
					e.points,
					e.all?.played,
					e.all?.win,
					e.all?.draw,
					e.all?.lose,
					e.all?.goals?.for,
					e.all?.goals?.against
				].map(int);
				if (teamId === null || nums.some((x) => x === null) || rows.has(teamId)) continue;
				const [rank, points, played, win, draw, lose, gf, ga] = nums as number[];
				if (e.team?.name)
					teams.set(teamId, { id: teamId, name: e.team.name, code: null, country: null, logoUrl: e.team.logo ?? null });
				rows.set(teamId, {
					leagueId,
					season,
					teamId,
					rank,
					points,
					played,
					win,
					draw,
					lose,
					gf,
					ga,
					form: e.form ?? null,
					description: e.description ?? null,
					groupName: e.group ?? null
				});
			}
	}
	return { rows: [...rows.values()].sort((a, b) => a.rank - b.rank || a.teamId - b.teamId), teams: [...teams.values()] };
}

/** Snapshot sorok beszúrása (`captured_at` közös); létező kulcs és hiányzó `season`/`team` sor esetén kimarad. A beszúrt sorok száma. */
export async function insertStandingSnapshot(
	db: SqlExecutor,
	rows: readonly StandingSnapshotRow[],
	capturedAt: Date
): Promise<number> {
	let n = 0;
	for (const r of rows) {
		const res = await db.query<{ team_id: number }>(
			`INSERT INTO standing_snapshot (league_id, season, captured_at, team_id, rank, points, played, win, draw, lose, gf, ga,
				form, description, group_name)
			 SELECT $1::bigint, $2::int, $3::timestamptz, $4::bigint, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
			 WHERE EXISTS (SELECT 1 FROM season WHERE league_id = $1::bigint AND year = $2::int)
				AND EXISTS (SELECT 1 FROM team WHERE id = $4::bigint)
			 ON CONFLICT DO NOTHING RETURNING team_id`,
			[
				r.leagueId,
				r.season,
				capturedAt.toISOString(),
				r.teamId,
				r.rank,
				r.points,
				r.played,
				r.win,
				r.draw,
				r.lose,
				r.gf,
				r.ga,
				r.form,
				r.description,
				r.groupName
			]
		);
		n += res.rows.length;
	}
	return n;
}

/** A `standings` kind végrehajtója a `createIngestWorker` `handlers` térképére. */
export function createStandingsHandler(db: SqlExecutor): TaskHandler {
	return async (task: StoredTask, { client, now }) => {
		if (!client) throw new Error('standings: API client missing');
		const league = Number(task.params.league);
		const season = Number(task.params.season);
		if (!Number.isInteger(league) || !Number.isInteger(season))
			throw new Error(`standings: invalid params ${JSON.stringify(task.params)}`);
		const env = await client.get<ApiStandingsItem>('/standings', { league, season }, { taskId: task.id });
		const { rows, teams } = toStandingRows(env.response, league, season);
		await upsertTeams(db, teams);
		await upsertSeasonTeams(
			db,
			league,
			season,
			rows.map((r) => r.teamId)
		);
		await insertStandingSnapshot(db, rows, now);
		return { calls: spent(client, 1) };
	};
}
