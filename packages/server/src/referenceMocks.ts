import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureKey, type ApiEnvelope, type MockFixtures } from '@football/api-client';
import { deriveStandings, type PlayedMatch } from '@football/core';
import type { ApiInjuryItem } from './injuries';
import type { ApiOddsItem } from './odds';
import type { ApiStandingsItem } from './standings';

/**
 * Mock-válaszok a `reference` jobokhoz (ROADMAP 3.2) a mentett API-adatból, 0 élő hívással:
 * - `/teams?league&season` ← `data/history/api-football/fixtures-<liga>-<szezon>.json` (a meccsek hazai/vendég csapatai);
 * - `/odds/bookmakers`, `/odds/bets` ← `backend/stores/*-odds.json` (a mentett `/odds` válaszok irodái és piacai).
 * TODO(polish): valódi `/teams` és `/odds/bets` válasz mentése (💸 1–1 hívás), ha a csapatkód/ország vagy a teljes piaclista kell.
 */

interface SavedFixtureItem {
	fixture?: { id?: number; date?: string; status?: { short?: string } };
	league?: { id?: number; season?: number; country?: string; name?: string };
	goals?: { home?: number | null; away?: number | null };
	teams?: {
		home?: { id?: number; name?: string; logo?: string | null };
		away?: { id?: number; name?: string; logo?: string | null };
	};
}
interface SavedOddsItem {
	bookmakers?: { id?: number; name?: string; bets?: { id?: number; name?: string }[] }[];
}

const envelope = <T>(get: string, parameters: Record<string, string>, response: T[]): ApiEnvelope<T> => ({
	get,
	parameters,
	errors: [],
	results: response.length,
	paging: { current: 1, total: 1 },
	response
});

/** `/teams` envelope egy liga×szezon mentett meccslistájából (az API `{ team: {...} }` alakjában). */
export function teamsEnvelopeFromFixtures(league: number, season: number, fixtures: readonly SavedFixtureItem[]) {
	const teams = new Map<number, { id: number; name: string; logo: string | null }>();
	for (const f of fixtures)
		for (const t of [f.teams?.home, f.teams?.away])
			if (t && typeof t.id === 'number' && t.name) teams.set(t.id, { id: t.id, name: t.name, logo: t.logo ?? null });
	const response = [...teams.values()].sort((a, b) => a.id - b.id).map((team) => ({ team }));
	return envelope('teams', { league: String(league), season: String(season) }, response);
}

/** `/odds/bookmakers` és `/odds/bets` envelope a mentett `/odds` válaszokból. */
export function oddsReferenceEnvelopes(odds: readonly SavedOddsItem[]) {
	const bookmakers = new Map<number, string>();
	const bets = new Map<number, string>();
	for (const o of odds)
		for (const b of o.bookmakers ?? []) {
			if (typeof b.id === 'number' && b.name) bookmakers.set(b.id, b.name);
			for (const bet of b.bets ?? []) if (typeof bet.id === 'number' && bet.name) bets.set(bet.id, bet.name);
		}
	const list = (m: Map<number, string>) => [...m].sort(([a], [b]) => a - b).map(([id, name]) => ({ id, name }));
	return {
		bookmakers: envelope('odds/bookmakers', {}, list(bookmakers)),
		bets: envelope('odds/bets', {}, list(bets))
	};
}

/** Mock-térkép összeállítása a már beolvasott mentett adatokból (tiszta, tesztelhető). */
export function buildReferenceMocks(input: {
	fixtures: readonly { league: number; season: number; items: readonly SavedFixtureItem[] }[];
	odds: readonly SavedOddsItem[];
}): MockFixtures {
	const out: MockFixtures = {};
	for (const f of input.fixtures)
		out[fixtureKey('/teams', { league: f.league, season: f.season })] = teamsEnvelopeFromFixtures(f.league, f.season, f.items);
	const { bookmakers, bets } = oddsReferenceEnvelopes(input.odds);
	out[fixtureKey('/odds/bookmakers')] = bookmakers;
	out[fixtureKey('/odds/bets')] = bets;
	return out;
}

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Visszajátszás: a kért nap a mentett szezonba vetítve (a free tier csak 2022–2024-et éri el, ADR-0002). Az S szezon
 * júl. S – jún. S+1: júliustól az S, előtte az S+1 évbe kerül (pl. 2026-11-16, 2024 → 2024-11-16).
 */
export function replayDay(day: string, season: number): string {
	const [, m, d] = day.split('-').map(Number);
	return isoDay(Date.UTC(m >= 7 ? season : season + 1, m - 1, d));
}

/**
 * `/fixtures?league&season&from&to` envelope: a mentett meccsek a visszajátszott [from, to] napokon (mindkét vég zárt, UTC
 * nap). A meccsek a mentett (valós) dátumukkal jönnek – adatot nem találunk ki.
 */
export function fixturesWindowEnvelope(
	league: number,
	season: number,
	from: string,
	to: string,
	items: readonly SavedFixtureItem[]
) {
	const rFrom = replayDay(from, season);
	const rTo = isoDay(Date.parse(rFrom) + Date.parse(to) - Date.parse(from));
	const response = items.filter((i) => {
		const day = i.fixture?.date ? isoDay(Date.parse(i.fixture.date)) : '';
		return day >= rFrom && day <= rTo;
	});
	return envelope('fixtures', { league: String(league), season: String(season), from, to }, response);
}

/** A `fixtures_window` mock-kulcsai (a planner paraméterei: `from` = nap, `to` = nap + 7) a megadott napokra, liga×szezononként. */
export function buildFixturesWindowMocks(
	fixtures: readonly { league: number; season: number; items: readonly SavedFixtureItem[] }[],
	days: readonly string[]
): MockFixtures {
	const out: MockFixtures = {};
	for (const f of fixtures)
		for (const from of days) {
			const to = isoDay(Date.parse(from) + 7 * DAY_MS);
			out[fixtureKey('/fixtures', { league: f.league, season: f.season, from, to })] = fixturesWindowEnvelope(
				f.league,
				f.season,
				from,
				to,
				f.items
			);
		}
	return out;
}

const IDS_PREFIX = '/fixtures?ids=';
type ById = { fixture?: { id?: number } };

/**
 * `/fixtures?ids=<a-b-c>` envelope a mentett meccsekből (`results`, 3.3b): a kért sorrendben, a hiányzó id kimarad; > 20 id →
 * API-szerű `errors` (a kliens hibát dob).
 */
export function fixturesByIdsEnvelope<T extends ById>(ids: string, items: readonly T[]) {
	const byId = new Map<number, T>();
	for (const i of items) if (typeof i.fixture?.id === 'number') byId.set(i.fixture.id, i);
	const list = ids.split('-').map(Number);
	if (list.length > 20) return { ...envelope('fixtures', { ids }, []), errors: { ids: 'Maximum of 20 fixtures ids' } };
	return envelope(
		'fixtures',
		{ ids },
		list.flatMap((id) => byId.get(id) ?? [])
	);
}

/**
 * A statikus mock-térkép kiegészítése `ids` szerinti feloldással (a `results` köteg összetétele előre nem ismert, a mock-kliens
 * kulcs szerint olvas). A térkép saját kulcsa elsőbbséget élvez; csak a `/fixtures?ids=…` (egyetlen paraméter) alakra válaszol.
 */
export function withFixturesByIds(map: MockFixtures, items: readonly ById[]): MockFixtures {
	return new Proxy(map, {
		get(target, key, receiver) {
			const own: unknown = Reflect.get(target, key, receiver);
			if (own !== undefined || typeof key !== 'string' || !key.startsWith(IDS_PREFIX)) return own;
			const qs = new URLSearchParams(key.slice('/fixtures?'.length));
			const ids = qs.get('ids');
			return [...qs.keys()].length === 1 && ids ? fixturesByIdsEnvelope(ids, items) : undefined;
		}
	});
}

const INJURIES_PREFIX = '/injuries?';

/**
 * `/injuries?ids=<a-b-c>` envelope mentett sérült-elemekből (3.6): a kért meccsek elemei (meccsenként a mentett sorrendben);
 * > 20 id → API-szerű `errors`. A repóban nincs mentett `/injuries` válasz, ezért a valódi forrás üres → a dev-tick
 * `mock-missing`-gel zár; a teszt kézi, egyértelműen szintetikus elemeket ad át (DECISIONS 3.6).
 */
export function injuriesByIdsEnvelope(ids: string, items: readonly ApiInjuryItem[]) {
	const list = ids.split('-').map(Number);
	if (list.length > 20) return { ...envelope('injuries', { ids }, []), errors: { ids: 'Maximum of 20 fixtures ids' } };
	return envelope(
		'injuries',
		{ ids },
		list.flatMap((id) => items.filter((i) => i.fixture?.id === id))
	);
}

/**
 * A mock-térkép kiegészítése `/injuries?ids=…` feloldással. Csak azokra a meccsekre válaszol, amelyekhez van mentett elem;
 * ha a kötegből egyikhez sincs, `undefined` (`mock-missing`) – így a hiányzó adatot nem rejti el egy üres („nincs sérült”) lista.
 */
export function withInjuries(map: MockFixtures, items: readonly ApiInjuryItem[]): MockFixtures {
	const known = new Set(items.map((i) => i.fixture?.id));
	return new Proxy(map, {
		get(target, key, receiver) {
			const own: unknown = Reflect.get(target, key, receiver);
			if (own !== undefined || typeof key !== 'string' || !key.startsWith(INJURIES_PREFIX)) return own;
			const qs = new URLSearchParams(key.slice(INJURIES_PREFIX.length));
			const ids = qs.get('ids');
			if ([...qs.keys()].length !== 1 || !ids) return undefined;
			return ids.split('-').some((id) => known.has(Number(id))) ? injuriesByIdsEnvelope(ids, items) : undefined;
		}
	});
}

const FINISHED = new Set(['FT', 'AET', 'PEN']);
const STANDINGS_PREFIX = '/standings?';

/**
 * `/standings?league&season` envelope a mentett meccsekből (3.4; mentett `/standings` válasz nincs): a core `deriveStandings`
 * az `asOf` (a mentett szezonba visszajátszott időpont) előtt befejezett meccsekből, API-alakra képezve. Minden mentett csapat
 * szerepel (meccs nélkül 0 ponttal). TODO(polish): `form` és `description` (zóna) – a mentett adatból nem képezhető, `null`.
 */
export function standingsEnvelope(league: number, season: number, asOf: string, items: readonly SavedFixtureItem[]) {
	const matches: PlayedMatch[] = [];
	const teams = new Map<number, { id: number; name: string; logo: string | null }>();
	for (const i of items) {
		const [h, a] = [i.teams?.home, i.teams?.away];
		for (const t of [h, a])
			if (t && typeof t.id === 'number' && t.name) teams.set(t.id, { id: t.id, name: t.name, logo: t.logo ?? null });
		const [gh, ga] = [i.goals?.home, i.goals?.away];
		if (!FINISHED.has(i.fixture?.status?.short ?? '') || typeof gh !== 'number' || typeof ga !== 'number') continue;
		if (typeof i.fixture?.id !== 'number' || !i.fixture.date || typeof h?.id !== 'number' || typeof a?.id !== 'number') continue;
		matches.push({ id: i.fixture.id, kickoff: i.fixture.date, homeTeamId: h.id, awayTeamId: a.id, homeGoals: gh, awayGoals: ga });
	}
	const group = items.find((i) => i.league?.name)?.league?.name ?? null;
	const table = deriveStandings(matches, asOf, [...teams.keys()]).map((r) => ({
		rank: r.position,
		team: teams.get(r.teamId)!,
		points: r.points,
		goalsDiff: r.goalDiff,
		group,
		form: null,
		description: null,
		all: { played: r.played, win: r.won, draw: r.drawn, lose: r.lost, goals: { for: r.goalsFor, against: r.goalsAgainst } }
	}));
	const response: ApiStandingsItem[] = table.length ? [{ league: { id: league, season, standings: [table] } }] : [];
	return envelope('standings', { league: String(league), season: String(season) }, response);
}

/** A `now` időpont a mentett szezonba vetítve (`replayDay` + a nap ideje), ISO. */
export const replayInstant = (now: Date, season: number) =>
	`${replayDay(isoDay(now.getTime()), season)}${now.toISOString().slice(10)}`;

/**
 * A mock-térkép kiegészítése `/standings?league&season` feloldással: a tabella a `clock()` pillanatának visszajátszott
 * időpontjáig számol (a kulcsban nincs dátum). Ismeretlen liga×szezon → `undefined` (`mock-missing`).
 */
export function withStandings(
	map: MockFixtures,
	fixtures: readonly { league: number; season: number; items: readonly SavedFixtureItem[] }[],
	clock: () => Date = () => new Date()
): MockFixtures {
	return new Proxy(map, {
		get(target, key, receiver) {
			const own: unknown = Reflect.get(target, key, receiver);
			if (own !== undefined || typeof key !== 'string' || !key.startsWith(STANDINGS_PREFIX)) return own;
			const qs = new URLSearchParams(key.slice(STANDINGS_PREFIX.length));
			if ([...qs.keys()].length !== 2) return undefined;
			const league = Number(qs.get('league'));
			const season = Number(qs.get('season'));
			const saved = fixtures.find((f) => f.league === league && f.season === season);
			return saved ? standingsEnvelope(league, season, replayInstant(clock(), season), saved.items) : undefined;
		}
	});
}

const ODDS_PREFIX = '/odds?';
const ODDS_KEYS = new Set(['date', 'league', 'season', 'page']);

/**
 * `/odds?league&season&date&page` envelope (3.5): a mentett meccsek közül a `date` (UTC) napon játszottak, fixture-id szerint,
 * `pageSize`/oldal. Ezekre a meccsekre szóló mentett `/odds` válasz nincs (a `backend/stores` 2021-es): az azonos ligájú
 * mentett irodablokkok ciklikusan ráképezve, az `update` a kezdés előtt a mentett előnnyel. Csak a pipeline tesztjére
 * (DECISIONS); a ligához nincs mentett odds → üres válasz.
 */
export function oddsEnvelope(
	league: number,
	season: number,
	date: string,
	page: number,
	items: readonly SavedFixtureItem[],
	odds: readonly ApiOddsItem[],
	pageSize = 10
) {
	const day = items
		.filter((i) => typeof i.fixture?.id === 'number' && i.fixture.date && isoDay(Date.parse(i.fixture.date)) === date)
		.sort((a, b) => a.fixture!.id! - b.fixture!.id!);
	const source = odds.filter((o) => o.league?.id === league && o.bookmakers?.length);
	const mapped: ApiOddsItem[] = source.length
		? day.map((f, n) => {
				const o = source[n % source.length];
				const kickoff = Date.parse(f.fixture!.date!);
				const lead = Date.parse(o.fixture?.date ?? '') - Date.parse(o.update ?? '');
				return {
					league: { ...o.league, id: league, season },
					fixture: { id: f.fixture!.id, timezone: 'UTC', date: f.fixture!.date, timestamp: Math.floor(kickoff / 1000) },
					update: new Date(kickoff - (Number.isFinite(lead) ? lead : 0)).toISOString(),
					bookmakers: o.bookmakers
				};
		  })
		: [];
	const params: Record<string, string> = { league: String(league), season: String(season), date };
	if (page > 1) params.page = String(page);
	return {
		...envelope('odds', params, mapped.slice((page - 1) * pageSize, page * pageSize)),
		paging: { current: page, total: Math.max(1, Math.ceil(mapped.length / pageSize)) }
	};
}

/** A mock-térkép kiegészítése `/odds?date&league&season[&page]` feloldással (`oddsEnvelope`); ismeretlen liga×szezon → `undefined`. */
export function withOdds(
	map: MockFixtures,
	fixtures: readonly { league: number; season: number; items: readonly SavedFixtureItem[] }[],
	odds: readonly ApiOddsItem[]
): MockFixtures {
	return new Proxy(map, {
		get(target, key, receiver) {
			const own: unknown = Reflect.get(target, key, receiver);
			if (own !== undefined || typeof key !== 'string' || !key.startsWith(ODDS_PREFIX)) return own;
			const qs = new URLSearchParams(key.slice(ODDS_PREFIX.length));
			if (!['date', 'league', 'season'].every((k) => qs.has(k)) || [...qs.keys()].some((k) => !ODDS_KEYS.has(k)))
				return undefined;
			const league = Number(qs.get('league'));
			const season = Number(qs.get('season'));
			const page = Number(qs.get('page') ?? 1);
			const saved = fixtures.find((f) => f.league === league && f.season === season);
			return saved && Number.isInteger(page) && page >= 1
				? oddsEnvelope(league, season, qs.get('date')!, page, saved.items, odds)
				: undefined;
		}
	});
}

/** Tömb, `{ response: [] }` (API-envelope) vagy `{ odds: [] }` (backend/stores) alak. */
const asItems = <T>(json: unknown): T[] => {
	if (Array.isArray(json)) return json as T[];
	const o = json as { response?: unknown; odds?: unknown } | null;
	if (Array.isArray(o?.response)) return o.response as T[];
	if (Array.isArray(o?.odds)) return o.odds as T[];
	return [];
};

async function readJsonFiles(dir: string, re: RegExp): Promise<{ match: RegExpMatchArray; json: unknown }[]> {
	let names: string[];
	try {
		names = await readdir(dir);
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw e;
	}
	const out: { match: RegExpMatchArray; json: unknown }[] = [];
	for (const name of names.sort()) {
		const match = name.match(re);
		if (match) out.push({ match, json: JSON.parse(await readFile(join(dir, name), 'utf8')) });
	}
	return out;
}

/** A repó mentett adataiból (`<root>/data/history/api-football`, `<root>/backend/stores`) épített mock-térkép. */
export async function loadReferenceMocks(root: string): Promise<MockFixtures> {
	const fixtures = await loadSavedFixtures(root);
	return buildReferenceMocks({ fixtures, odds: await loadSavedOdds(root) });
}

async function loadSavedOdds(root: string) {
	return (await readJsonFiles(join(root, 'backend', 'stores'), /-odds\.json$/)).flatMap(({ json }) => asItems<ApiOddsItem>(json));
}

/** Mentett `/injuries` válaszok: `data/history/api-football/injuries-*.json` (ma nincs ilyen fájl → üres). */
async function loadSavedInjuries(root: string) {
	return (await readJsonFiles(join(root, 'data', 'history', 'api-football'), /^injuries-.+.json$/)).flatMap(({ json }) =>
		asItems<ApiInjuryItem>(json)
	);
}

async function loadSavedFixtures(root: string) {
	return (await readJsonFiles(join(root, 'data', 'history', 'api-football'), /^fixtures-(\d+)-(\d+)\.json$/)).map(
		({ match, json }) => ({ league: Number(match[1]), season: Number(match[2]), items: asItems<SavedFixtureItem>(json) })
	);
}

/**
 * Az ingest-worker teljes mock-térképe: `reference` (3.2) + `fixtures_window` (3.3a) a `now` előtti 1 és utáni 30 napra +
 * `results` (3.3b) `ids` szerint az összes mentett meccsből + `standings` (3.4) a `clock` visszajátszott pillanatáig + `odds`
 * (3.5) a mentett meccsnapokra (`withOdds`) + `injuries` (3.6) a mentett `/injuries` válaszokból (`withInjuries`).
 * TODO(polish): 30 napnál tovább futó dev-szervernél a későbbi napok kulcsa hiányzik (`mock-missing`) – újraindítás kell.
 */
export async function loadIngestMocks(
	root: string,
	now = new Date(),
	clock: () => Date = () => new Date()
): Promise<MockFixtures> {
	const start = Date.parse(isoDay(now.getTime())) - DAY_MS;
	const days = Array.from({ length: 32 }, (_, i) => isoDay(start + i * DAY_MS));
	const saved = await loadSavedFixtures(root);
	const map = { ...(await loadReferenceMocks(root)), ...buildFixturesWindowMocks(saved, days) };
	return withInjuries(
		withOdds(
			withStandings(
				withFixturesByIds(
					map,
					saved.flatMap((f) => f.items)
				),
				saved,
				clock
			),
			saved,
			await loadSavedOdds(root)
		),
		await loadSavedInjuries(root)
	);
}
