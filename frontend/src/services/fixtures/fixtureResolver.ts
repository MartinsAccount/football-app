// Fixture-mód (ROADMAP 0.5): az API-Football URL-ekre mentett valós válaszokból felelünk, élő hívás nélkül.
// A JSON-ok lustán (import()) töltődnek, így nem kerülnek a fő bundle-be. Terv: docs/plans/fixture-mode.md
import { LEAGUES } from '../../core/constants/Leagues';

export interface IApiResponse<T = any> {
	get: string;
	parameters: Record<string, string>;
	errors: any[];
	results: number;
	paging: { current: number; total: number };
	response: T[];
}

type Loader = () => Promise<any>;

// Mentett meccslisták ligánként és szezononként (frontend/src/data)
const FIXTURE_FILES: Record<number, Record<number, Loader>> = {
	[LEAGUES.ENGLAND]: {
		2020: () => import('../../data/allMatchPremierLeague_2020.json'),
		2021: () => import('../../data/allMatchPremierLeague_2021.json')
	},
	[LEAGUES.GERMANY]: {
		2020: () => import('../../data/allMatchBundesliga_2020.json'),
		2021: () => import('../../data/allMatchBundesliga_2021.json')
	},
	[LEAGUES.SPAIN]: {
		2020: () => import('../../data/allMatchLaLiga_2020.json'),
		2021: () => import('../../data/allMatchLaLiga_2021.json')
	},
	[LEAGUES.ITALY]: {
		2020: () => import('../../data/allMatchSeriaA_2020.json'),
		2021: () => import('../../data/allMatchSeriaA_2021.json')
	},
	[LEAGUES.FRANCE]: {
		2020: () => import('../../data/allMatchFrance_2020.json'),
		2021: () => import('../../data/allMatchFrance_2021.json')
	}
};

// Mentett Unibet-oddsok ligánként (backend/stores)
const ODDS_FILES: Record<number, Loader> = {
	[LEAGUES.ENGLAND]: () => import('../../../../backend/stores/england-odds.json'),
	[LEAGUES.FRANCE]: () => import('../../../../backend/stores/france-odds.json'),
	[LEAGUES.GERMANY]: () => import('../../../../backend/stores/germany-odds.json'),
	[LEAGUES.ITALY]: () => import('../../../../backend/stores/italy-odds.json'),
	[LEAGUES.SPAIN]: () => import('../../../../backend/stores/spain-odds.json')
};

const load = async (loader: Loader) => {
	const m = await loader();
	return m.default ?? m;
};

const wrap = <T>(get: string, parameters: Record<string, string>, response: T[]): IApiResponse<T> => ({
	get,
	parameters,
	errors: [],
	results: response.length,
	paging: { current: 1, total: 1 },
	response
});

const latestSeason = (leagueId: number): number => Math.max(...Object.keys(FIXTURE_FILES[leagueId] ?? {}).map(Number));

/** Egy liga mentett meccsei; ha a kért szezon nincs meg, a legutolsó mentett szezon. */
const loadLeagueFixtures = async (leagueId: number, season?: number): Promise<any[]> => {
	const seasons = FIXTURE_FILES[leagueId];
	if (!seasons) return [];
	const loader = seasons[season] ?? seasons[latestSeason(leagueId)];
	return (await load(loader)).response;
};

/** Minden liga minden mentett szezonja (id/dátum szerinti kereséshez). */
const loadAllFixtures = async (): Promise<any[]> => {
	const loaders = Object.values(FIXTURE_FILES).flatMap((seasons) => Object.values(seasons));
	const lists = await Promise.all(loaders.map(async (loader) => (await load(loader)).response));
	return lists.flat();
};

const loadOdds = async (leagueId?: number): Promise<any[]> => {
	const ids = leagueId ? [leagueId] : Object.keys(ODDS_FILES).map(Number);
	const lists = await Promise.all(ids.filter((id) => ODDS_FILES[id]).map(async (id) => (await load(ODDS_FILES[id])).odds));
	return lists.flat();
};

/** API-Football URL → mentett válasz. Ismeretlen végpontra üres választ ad (és figyelmeztet). */
export const resolveFixture = async (url: string): Promise<IApiResponse> => {
	const { pathname, searchParams } = new URL(url, 'http://fixture.local');
	const path = pathname.replace(/^.*\/v\d+/, '');
	const params = Object.fromEntries(searchParams.entries());
	const league = params.league ? Number(params.league) : undefined;
	const season = params.season ? Number(params.season) : undefined;

	switch (path) {
		case '/fixtures': {
			if (params.id) {
				const id = Number(params.id);
				return wrap(
					'fixtures',
					params,
					(await loadAllFixtures()).filter((f) => f.fixture.id === id)
				);
			}
			let list = league ? await loadLeagueFixtures(league, season) : await loadAllFixtures();
			if (params.date) list = list.filter((f) => f.fixture.date.startsWith(params.date));
			if (params.from && params.to) {
				list = list.filter((f) => f.fixture.date.slice(0, 10) >= params.from && f.fixture.date.slice(0, 10) <= params.to);
			}
			if (params.round) list = list.filter((f) => f.league.round === params.round);
			return wrap('fixtures', params, list);
		}
		case '/fixtures/rounds': {
			const list = league ? await loadLeagueFixtures(league, season) : [];
			const rounds = Array.from(new Set(list.map((f) => f.league.round)));
			return wrap('fixtures/rounds', params, params.current === 'true' ? rounds.slice(-1) : rounds);
		}
		case '/leagues':
			return { ...(await load(() => import('../../data/test.json'))), paging: { current: 1, total: 1 } };
		case '/odds/mapping':
			// A mentett minta 1 oldal (a valódi 30); 1 oldalra vágjuk, hogy a lapozó ciklus véget érjen.
			return { ...(await load(() => import('../../data/test2.json'))), paging: { current: 1, total: 1 } };
		case '/odds': {
			let list = await loadOdds(league);
			if (params.fixture) list = list.filter((o) => o.fixture.id === Number(params.fixture));
			if (params.bookmaker) {
				const bookmaker = Number(params.bookmaker);
				list = list.filter((o) => o.bookmakers.some((b) => b.id === bookmaker));
			}
			return wrap('odds', params, list);
		}
		case '/odds/bookmakers': {
			const all = (await loadOdds()).flatMap((o) => o.bookmakers.map((b) => ({ id: b.id, name: b.name })));
			const unique = Array.from(new Map(all.map((b) => [b.id, b])).values());
			return wrap('odds/bookmakers', params, unique);
		}
		default:
			console.warn(`[fixture-mód] nincs mentett válasz: ${path} — üres választ adunk`);
			return wrap(path.replace(/^\//, ''), params, []);
	}
};
