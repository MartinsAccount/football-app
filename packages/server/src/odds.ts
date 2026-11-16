import { isQuoteStored, ODDS_PAGE_SIZE, resolveStoredScope, type StoredScope } from '@football/core';
import {
	parseSelection,
	SqlRepository,
	SqlSettingsRepository,
	type OddsKind,
	type OddsQuote,
	type OddsSnapshotInput,
	type SqlExecutor,
	type StoredTask
} from '@football/db';
import type { TaskHandler } from './ingestWorker';
import { spent } from './reference';

/**
 * `odds_early` / `odds_late` job (ROADMAP 3.5, architecture.md §7.2): a planner liga × meccsnap feladata (`{ league, season,
 * date, fixtures }`) → lapozott `/odds?league&season&date&page` (10 meccs/oldal, `getAllPages`) → `odds_snapshot` +
 * `odds_quote`. Csak a feladat meccsei és csak a tárolási kör (piac × iroda, `resolveStoredScope`); `captured_at` = a futás
 * ideje, `provider_updated_at` = az item `update`-je. Csak insert (meglévő kulcs no-op).
 * TODO(polish): `odds_best` (legjobb/átlag a teljes válaszból, iroda-szűrés előtt).
 */

/** Egy item az API `/odds` válaszában. */
export interface ApiOddsItem {
	league?: { id?: number; name?: string; country?: string; season?: number };
	fixture?: { id?: number; timezone?: string; date?: string; timestamp?: number };
	update?: string;
	bookmakers?: {
		id?: number;
		name?: string;
		bets?: { id?: number; name?: string; values?: { value?: string | number; odd?: string | number }[] }[];
	}[];
}

const isoOrNull = (s: string | undefined) => {
	const ms = s ? Date.parse(s) : NaN;
	return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/**
 * API `/odds` válasz → snapshot-bemenetek (tiszta). Csak a `fixtureIds` meccsei, meccsenként az első item; csak a kör
 * piac × irodája, `odd > 1`; ismétlődő (iroda, piac, kimenet, vonal) kulcsból az első. 0 tárolt quote → nincs snapshot.
 */
export function toOddsSnapshots(
	response: readonly ApiOddsItem[],
	opts: { fixtureIds: readonly number[]; scope: StoredScope; capturedAt: Date; kind: Extract<OddsKind, 'early' | 'late'> }
): OddsSnapshotInput[] {
	const wanted = new Set(opts.fixtureIds);
	const done = new Set<number>();
	const out: OddsSnapshotInput[] = [];
	for (const item of response) {
		const fixtureId = item.fixture?.id;
		if (typeof fixtureId !== 'number' || !wanted.has(fixtureId) || done.has(fixtureId)) continue;
		done.add(fixtureId);
		const seen = new Set<string>();
		const quotes: OddsQuote[] = [];
		for (const b of item.bookmakers ?? [])
			for (const bet of b.bets ?? []) {
				if (typeof b.id !== 'number' || typeof bet.id !== 'number' || !isQuoteStored(opts.scope, bet.id, b.id)) continue;
				for (const v of bet.values ?? []) {
					const odd = Number(v.odd);
					if (v.value === undefined || !Number.isFinite(odd) || odd <= 1) continue;
					const { selection, line } = parseSelection(v.value);
					const key = `${b.id}|${bet.id}|${selection}|${line}`;
					if (seen.has(key)) continue;
					seen.add(key);
					quotes.push({ bookmakerId: b.id, marketId: bet.id, selection, line, odd });
				}
			}
		if (!quotes.length) continue;
		out.push({
			fixtureId,
			capturedAt: opts.capturedAt.toISOString(),
			providerUpdatedAt: isoOrNull(item.update),
			source: 'api-football',
			kind: opts.kind,
			quotes
		});
	}
	return out;
}

/** A feladat paraméterei → liga, szezon, nap, meccs-id-k (rendezett, egyedi). */
export function parseOddsParams(params: StoredTask['params']) {
	const league = Number(params.league);
	const season = Number(params.season);
	const date = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : null;
	const fixtures = Array.isArray(params.fixtures) ? [...new Set(params.fixtures.map(Number))].sort((a, b) => a - b) : [];
	if (!Number.isInteger(league) || !Number.isInteger(season) || !date || !fixtures.length || fixtures.some((id) => !(id > 0)))
		throw new Error(`odds: invalid params ${JSON.stringify(params)}`);
	return { league, season, date, fixtures };
}

/** Az `odds_early` / `odds_late` kind végrehajtója a `createIngestWorker` `handlers` térképére. */
export function createOddsHandler(db: SqlExecutor, kind: 'early' | 'late'): TaskHandler {
	return async (task: StoredTask, { client, now }) => {
		if (!client) throw new Error(`odds_${kind}: API client missing`);
		const { league, season, date, fixtures } = parseOddsParams(task.params);
		const scope = resolveStoredScope(league, await new SqlSettingsRepository(db).loadStoredScopeInput());
		// A lapszám a planner becslése (⌈n/10⌉): a foglalt keretnél többet nem költünk.
		const maxPages = Math.ceil(fixtures.length / ODDS_PAGE_SIZE);
		const all = await client.getAllPages<ApiOddsItem>('/odds', { league, season, date }, { taskId: task.id, maxPages });
		const snapshots = toOddsSnapshots(all.response, { fixtureIds: fixtures, scope, capturedAt: now, kind });
		if (snapshots.length) await new SqlRepository(db).insertOddsSnapshots(snapshots);
		return { calls: spent(client, all.pages) };
	};
}
