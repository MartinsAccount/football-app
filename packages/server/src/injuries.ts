import type { SqlExecutor, StoredTask } from '@football/db';
import type { TaskHandler } from './ingestWorker';
import { spent, upsertTeams, type TeamRow } from './reference';
import { parseResultIds } from './results';

/**
 * `injuries` job (ROADMAP 3.6, architecture.md §7.1): `/injuries?ids=<a-b-c>` (max. 20 meccs/hívás) a meccsnap első kezdése
 * előtt 24 órával (a core planner adja a köteget és az időt) → `injury_report` sorok a meccshez kötve, `captured_at = now`.
 * Feladatonként pontosan 1 hívás. Csak beszúrás (`ON CONFLICT DO NOTHING`): egy újrafutás ugyanabban a pillanatban nem ír
 * duplán, egy későbbi futás új pillanatképet ad. A DB-ben nem szereplő meccs és az id nélküli játékos kimarad.
 */

/** Az API `/injuries` válaszának egy eleme (csak a használt mezők). */
export interface ApiInjuryItem {
	player?: { id?: number | null; name?: string | null; type?: string | null; reason?: string | null };
	team?: { id?: number | null; name?: string | null; logo?: string | null };
	fixture?: { id?: number | null };
}

export interface InjuryRow {
	fixtureId: number;
	playerId: number;
	teamId: number;
	playerName: string | null;
	type: string | null;
	reason: string | null;
}

const posInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/** API-elemek → (sérült-sorok, csapatok); csak a kért meccsek, hiányos id-jú elem kimarad, (meccs, játékos) egyedi. */
export function toInjuryRows(
	response: readonly ApiInjuryItem[],
	wanted: ReadonlySet<number>
): { injuries: InjuryRow[]; teams: TeamRow[] } {
	const injuries = new Map<string, InjuryRow>();
	const teams = new Map<number, TeamRow>();
	for (const i of response) {
		const fixtureId = i.fixture?.id;
		const playerId = i.player?.id;
		const teamId = i.team?.id;
		if (!posInt(fixtureId) || !posInt(playerId) || !posInt(teamId) || !wanted.has(fixtureId)) continue;
		injuries.set(`${fixtureId}:${playerId}`, {
			fixtureId,
			playerId,
			teamId,
			playerName: i.player?.name ?? null,
			type: i.player?.type ?? null,
			reason: i.player?.reason ?? null
		});
		if (i.team?.name && !teams.has(teamId))
			teams.set(teamId, { id: teamId, name: i.team.name, code: null, country: null, logoUrl: i.team.logo ?? null });
	}
	return { injuries: [...injuries.values()], teams: [...teams.values()] };
}

/** Beszúrás `captured_at`-tal; az ismeretlen meccs/csapat (FK) sora kimarad. Visszaadja a beszúrt sorok számát. */
export async function insertInjuries(db: SqlExecutor, rows: readonly InjuryRow[], capturedAt: Date): Promise<number> {
	let n = 0;
	for (const r of rows) {
		const res = await db.query<{ fixture_id: number }>(
			`INSERT INTO injury_report (fixture_id, player_id, captured_at, team_id, player_name, type, reason)
			 SELECT $1, $2, $3::timestamptz, $4, $5, $6, $7
			 WHERE EXISTS (SELECT 1 FROM fixture WHERE id = $1) AND EXISTS (SELECT 1 FROM team WHERE id = $4)
			 ON CONFLICT (fixture_id, player_id, captured_at) DO NOTHING
			 RETURNING fixture_id`,
			[r.fixtureId, r.playerId, capturedAt.toISOString(), r.teamId, r.playerName, r.type, r.reason]
		);
		n += res.rows.length;
	}
	return n;
}

/** Az `injuries` kind végrehajtója a `createIngestWorker` `handlers` térképére. */
export function createInjuriesHandler(db: SqlExecutor): TaskHandler {
	return async (task: StoredTask, { now, client }) => {
		if (!client) throw new Error('injuries: API client missing');
		const ids = parseResultIds(task.params.ids, 'injuries');
		const env = await client.get<ApiInjuryItem>('/injuries', { ids: ids.join('-') }, { taskId: task.id });
		const { injuries, teams } = toInjuryRows(env.response, new Set(ids));
		await upsertTeams(db, teams);
		await insertInjuries(db, injuries, now);
		return { calls: spent(client, 1) };
	};
}
