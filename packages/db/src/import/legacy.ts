// Régi JSON-ok importja (ROADMAP 1.4, S08): `frontend/src/data/allMatch*_YYYY.json` (API-Football `/fixtures` válasz)
// és `backend/stores/*-odds.json` (`{ odds: [...] }`, 2021, Unibet). 0 élő hívás. Idempotens: a 2. futás 0 új sort ír.
import type { Repository } from '../repository';
import type { Bookmaker, Fixture, League, Market, OddsQuote, OddsSnapshotInput, Season, Team, UpsertResult } from '../types';

// --- A régi fájlok (API-Football v3) releváns mezői ---

interface LegacyFixtureItem {
	fixture: { id: number; referee?: string | null; date: string; status: { short: string } };
	league: { id: number; name: string; country?: string | null; logo?: string | null; season: number; round?: string | null };
	teams: { home: LegacyTeam; away: LegacyTeam };
	goals: { home: number | null; away: number | null };
	score?: { halftime?: LegacyScore; fulltime?: LegacyScore };
}
interface LegacyTeam {
	id: number;
	name: string;
	logo?: string | null;
}
interface LegacyScore {
	home: number | null;
	away: number | null;
}
export interface LegacyFixturesFile {
	response: LegacyFixtureItem[];
}

interface LegacyOddsItem {
	fixture: { id: number; date: string };
	update: string;
	bookmakers: {
		id: number;
		name: string;
		bets: { id: number; name: string; values: { value: string | number; odd: string }[] }[];
	}[];
}
export interface LegacyOddsFile {
	odds: LegacyOddsItem[];
}

export interface MappedFixtures {
	leagues: League[];
	seasons: Season[];
	teams: Team[];
	fixtures: Fixture[];
}

export interface MappedOdds {
	bookmakers: Bookmaker[];
	markets: Market[];
	snapshots: OddsSnapshotInput[];
}

/** Egyedi kulcs szerint az utolsó előfordulás marad (ugyanaz a csapat sok meccsben szerepel). */
function uniqueBy<T>(rows: T[], key: (row: T) => string | number): T[] {
	return [...new Map(rows.map((r) => [key(r), r])).values()];
}

/** API-Football `/fixtures` válaszok → liga, szezon, csapat, meccs sorok. */
export function mapLegacyFixtures(files: LegacyFixturesFile[]): MappedFixtures {
	const items = files.flatMap((f) => f.response);
	const leagues = uniqueBy(
		items.map(
			(i): League => ({
				id: i.league.id,
				name: i.league.name,
				country: i.league.country ?? null,
				type: 'league',
				logoUrl: i.league.logo ?? null
			})
		),
		(l) => l.id
	);
	const seasons = uniqueBy(
		items.map((i): Season => ({ leagueId: i.league.id, year: i.league.season })),
		(s) => `${s.leagueId}-${s.year}`
	);
	const teams = uniqueBy(
		items.flatMap((i) =>
			[i.teams.home, i.teams.away].map(
				(t): Team => ({ id: t.id, name: t.name, country: i.league.country ?? null, logoUrl: t.logo ?? null })
			)
		),
		(t) => t.id
	);
	const fixtures = uniqueBy(
		items.map(
			(i): Fixture => ({
				id: i.fixture.id,
				leagueId: i.league.id,
				season: i.league.season,
				round: i.league.round ?? null,
				kickoffAt: new Date(i.fixture.date).toISOString(),
				status: i.fixture.status.short,
				homeTeamId: i.teams.home.id,
				awayTeamId: i.teams.away.id,
				goalsHome: i.goals.home,
				goalsAway: i.goals.away,
				htHome: i.score?.halftime?.home ?? null,
				htAway: i.score?.halftime?.away ?? null,
				ftHome: i.score?.fulltime?.home ?? null,
				ftAway: i.score?.fulltime?.away ?? null,
				referee: i.fixture.referee ?? null
			})
		),
		(f) => f.id
	);
	return { leagues, seasons, teams, fixtures };
}

const LINE_SELECTION = /^(Home|Away|Draw|Over|Under) ([-+]?\d+(?:\.\d+)?)$/;

/** `"Over 2.5"` → `{ Over, 2.5 }`, `"Home -0.25"` → `{ Home, -0.25 }`; minden más (1X2, `"1:0"`, `"Home/Draw"`) vonal nélkül. */
export function parseSelection(value: string | number): { selection: string; line: number | null } {
	const text = String(value).trim();
	const m = LINE_SELECTION.exec(text);
	return m ? { selection: m[1], line: Number(m[2]) } : { selection: text, line: null };
}

/** `{ odds: [...] }` fájlok → iroda, piac és `legacy-json` snapshot sorok (a `captured_at` = a szolgáltató `update` ideje). */
export function mapLegacyOdds(files: LegacyOddsFile[]): MappedOdds {
	const items = uniqueBy(
		files.flatMap((f) => f.odds),
		(i) => i.fixture.id
	);
	const books = items.flatMap((i) => i.bookmakers);
	const bookmakers = uniqueBy(
		books.map((b): Bookmaker => ({ id: b.id, name: b.name, stored: true })),
		(b) => b.id
	);
	const markets = uniqueBy(
		books.flatMap((b) => b.bets.map((bet): Market => ({ id: bet.id, name: bet.name, stored: true }))),
		(m) => m.id
	);
	const snapshots = items.map((i): OddsSnapshotInput => {
		const capturedAt = new Date(i.update).toISOString();
		const quotes = i.bookmakers.flatMap((b) =>
			b.bets.flatMap((bet) =>
				bet.values.map(
					(v): OddsQuote => ({ bookmakerId: b.id, marketId: bet.id, ...parseSelection(v.value), odd: Number(v.odd) })
				)
			)
		);
		return { fixtureId: i.fixture.id, capturedAt, providerUpdatedAt: capturedAt, source: 'legacy-json', kind: 'legacy', quotes };
	});
	return { bookmakers, markets, snapshots };
}

export interface LegacyImportReport {
	leagues: UpsertResult;
	seasons: UpsertResult;
	teams: UpsertResult;
	fixtures: UpsertResult;
	bookmakers: UpsertResult;
	markets: UpsertResult;
	/** `created` = új snapshot, `existing` = már bent volt (2. futás), `skipped` = nincs hozzá meccs a DB-ben (FK). */
	odds: { created: number; existing: number; skipped: number; quotes: number };
}

/** A teljes import a repository-n át; FK-sorrend: törzsadat → meccs → odds. */
/** Snapshot-köteg mérete (távoli DB-n kötegenként ~5 hálózati kör). */
export const SNAPSHOT_BATCH = 500;

export async function importLegacy(
	repo: Repository,
	input: { fixtureFiles: LegacyFixturesFile[]; oddsFiles: LegacyOddsFile[] }
): Promise<LegacyImportReport> {
	const fx = mapLegacyFixtures(input.fixtureFiles);
	const od = mapLegacyOdds(input.oddsFiles);

	const leagues = await repo.upsertLeagues(fx.leagues);
	const seasons = await repo.upsertSeasons(fx.seasons);
	const teams = await repo.upsertTeams(fx.teams);
	const fixtures = await repo.upsertFixtures(fx.fixtures);
	const bookmakers = await repo.upsertBookmakers(od.bookmakers);
	const markets = await repo.upsertMarkets(od.markets);

	const odds = { created: 0, existing: 0, skipped: 0, quotes: 0 };
	const known = new Set((await repo.listFixtures()).map((f) => f.id));
	const present = od.snapshots.filter((snap) => known.has(snap.fixtureId));
	odds.skipped = od.snapshots.length - present.length;
	for (let i = 0; i < present.length; i += SNAPSHOT_BATCH) {
		const r = await repo.insertOddsSnapshots(present.slice(i, i + SNAPSHOT_BATCH));
		odds.created += r.created;
		odds.existing += r.existing;
		odds.quotes += r.quotes;
	}
	return { leagues, seasons, teams, fixtures, bookmakers, markets, odds };
}
