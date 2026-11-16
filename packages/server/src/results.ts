import { isVoidStatus } from '@football/core';
import type { SqlExecutor, StoredTask } from '@football/db';
import { toFixtureRows, upsertFixtureRows, type ApiFixtureItem } from './fixturesWindow';
import type { TaskHandler } from './ingestWorker';
import { spent, upsertTeams } from './reference';
import { evaluateFixtures } from './evaluation';
import { refreshStandingDerived } from './standingDerived';

/**
 * `results` job (ROADMAP 3.3b, architecture.md §7.2): `/fixtures?ids=<a-b-c>` (max. 20 meccs/hívás) → a `fixture` sorok
 * státusza és eredménye (`NS` → `FT`). Feladatonként pontosan 1 hívás, így a hívásszám ≤ ⌈n/20⌉. A kört (kezdés +3 h, majd
 * +26 h, ha még nem végleges) a core planner adja. Csak upsert; a válaszból hiányzó meccs nem hiba. Ha a válaszban
 * van befejezett meccs, az érintett liga×szezon pont-idejű tabelláit (`standing_derived`, 4.3) újraszámolja (0 hívás).
 * Utána a lezárt (vagy PST/CANC/ABD → void) meccsek predikcióit kiértékeli (`evaluation`, 5.3, 0 hívás).
 * TODO(polish): statisztika és események (`fixture_team_stats`, `fixture_event`) a válaszból – a mentett adatban nincs ilyen.
 */

export const RESULTS_MAX_IDS = 20;
const FINISHED = new Set(['FT', 'AET', 'PEN']);

/** A feladat `ids` paramétere → rendezett, egyedi egész id-k (a rendezés stabil API-/mock-kulcsot ad). */
export function parseResultIds(raw: unknown, kind = 'results'): number[] {
	const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split('-') : [];
	const ids = [...new Set(list.map(Number))].sort((a, b) => a - b);
	if (!ids.length || ids.some((id) => !Number.isInteger(id) || id <= 0))
		throw new Error(`${kind}: invalid ids ${JSON.stringify(raw)}`);
	if (ids.length > RESULTS_MAX_IDS) throw new Error(`${kind}: ${ids.length} ids > ${RESULTS_MAX_IDS}`);
	return ids;
}

/** A `results` kind végrehajtója a `createIngestWorker` `handlers` térképére. */
export function createResultsHandler(db: SqlExecutor): TaskHandler {
	return async (task: StoredTask, { client, now }) => {
		if (!client) throw new Error('results: API client missing');
		const ids = parseResultIds(task.params.ids);
		const env = await client.get<ApiFixtureItem>('/fixtures', { ids: ids.join('-') }, { taskId: task.id });
		const wanted = new Set(ids);
		const { fixtures, teams } = toFixtureRows(env.response.filter((i) => wanted.has(i.fixture?.id ?? -1)));
		await upsertTeams(db, teams);
		await upsertFixtureRows(db, fixtures);
		const touched = new Set(
			fixtures.filter((f) => FINISHED.has(f.status) && f.goalsHome !== null).map((f) => `${f.leagueId}:${f.season}`)
		);
		for (const key of touched) {
			const [league, season] = key.split(':').map(Number);
			await refreshStandingDerived(db, league, season);
		}
		const settled = fixtures.filter((f) => (FINISHED.has(f.status) && f.goalsHome !== null) || isVoidStatus(f.status));
		await evaluateFixtures(
			db,
			settled.map((f) => f.id),
			{ now }
		);
		return { calls: spent(client, 1) };
	};
}
