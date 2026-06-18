// Az OddsStore liga-kulcsai ('england' | 'germany' | ...) → megjelenítendő címke,
// és az ArbitrageStore.Arbitrages country mezőjéhez használt ország-név.

export type LeagueKey = 'england' | 'germany' | 'france' | 'italy' | 'spain' | 'all';

export const LEAGUE_LABEL: Record<LeagueKey, string> = {
	england: 'Angol',
	germany: 'Német',
	france: 'Francia',
	italy: 'Olasz',
	spain: 'Spanyol',
	all: 'Összes'
};

// Liga-kulcs → az arbitrage-adatban szereplő ország-név (country mező).
export const LEAGUE_COUNTRY: Record<Exclude<LeagueKey, 'all'>, string> = {
	england: 'England',
	germany: 'Germany',
	france: 'France',
	italy: 'Italy',
	spain: 'Spain'
};

// A sidebar liga-listája (kulcs + rövid címke).
export const SIDEBAR_LEAGUES: { key: LeagueKey; label: string }[] = [
	{ key: 'england', label: 'Angol' },
	{ key: 'germany', label: 'Német' },
	{ key: 'spain', label: 'Spanyol' },
	{ key: 'france', label: 'Francia' },
	{ key: 'italy', label: 'Olasz' },
	{ key: 'all', label: 'Összes odds' }
];

// CURRENT_SEASON (pl. 2025) → "25/26".
export const seasonLabel = (season: number): string => `${season % 100}/${(season + 1) % 100}`;

// A FixtureStore.currentLeague egy teljes címke-string ("Olasz bajnokság"),
// amit a leaguesStatistics állít be — ezzel ellenőrizzük az aktív menüpontot.
export const FIXTURE_LEAGUE_FULL: Record<Exclude<LeagueKey, 'all'>, string> = {
	england: 'Angol bajnokság',
	germany: 'Német bajnokság',
	spain: 'Spanyol bajnokság',
	france: 'Francia bajnokság',
	italy: 'Olasz bajnokság'
};

// A Fixtures sidebar liga-listája (a törött 'all' opció nélkül).
export const FIXTURE_SIDEBAR_LEAGUES: { key: Exclude<LeagueKey, 'all'>; label: string }[] = [
	{ key: 'england', label: 'Angol' },
	{ key: 'germany', label: 'Német' },
	{ key: 'spain', label: 'Spanyol' },
	{ key: 'france', label: 'Francia' },
	{ key: 'italy', label: 'Olasz' }
];
