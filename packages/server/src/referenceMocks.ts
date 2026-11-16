import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixtureKey, type ApiEnvelope, type MockFixtures } from '@football/api-client';

/**
 * Mock-válaszok a `reference` jobokhoz (ROADMAP 3.2) a mentett API-adatból, 0 élő hívással:
 * - `/teams?league&season` ← `data/history/api-football/fixtures-<liga>-<szezon>.json` (a meccsek hazai/vendég csapatai);
 * - `/odds/bookmakers`, `/odds/bets` ← `backend/stores/*-odds.json` (a mentett `/odds` válaszok irodái és piacai).
 * TODO(polish): valódi `/teams` és `/odds/bets` válasz mentése (💸 1–1 hívás), ha a csapatkód/ország vagy a teljes piaclista kell.
 */

interface SavedFixtureItem {
	league?: { id?: number; season?: number; country?: string };
	teams?: { home?: { id?: number; name?: string; logo?: string }; away?: { id?: number; name?: string; logo?: string } };
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
	const fixtures = (await readJsonFiles(join(root, 'data', 'history', 'api-football'), /^fixtures-(\d+)-(\d+)\.json$/)).map(
		({ match, json }) => ({ league: Number(match[1]), season: Number(match[2]), items: asItems<SavedFixtureItem>(json) })
	);
	const odds = (await readJsonFiles(join(root, 'backend', 'stores'), /-odds\.json$/)).flatMap(({ json }) =>
		asItems<SavedOddsItem>(json)
	);
	return buildReferenceMocks({ fixtures, odds });
}
