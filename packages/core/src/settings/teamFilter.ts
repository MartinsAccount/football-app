// Csapatszűrő alkalmazása (ROADMAP 2.3, I18e): mely meccsekre gyűjtünk oddsot/sérültlistát, és melyiken lehet ajánlás.
// Jelentés (DECISIONS.md, I18c): „Kizár” = a csapat meccsei kimaradnak; „Csak” = a csapat ligájában csak az include-csapatok
// meccsei maradnak, a többi liga érintetlen. Egy meccsen include- és exclude-csapat is → az exclude nyer. Tiszta függvények.
import type { ISettingsTeamFilter } from './settings';

export interface TeamFilterFixture {
	leagueId: number;
	homeTeamId?: number | null;
	awayTeamId?: number | null;
}

/** Csapat ↔ liga tagság (a db `season_team` ∪ `fixture` tábla adja). */
export interface TeamLeagueMembership {
	teamId: number;
	leagueId: number;
}

export interface TeamFilterIndex {
	include: ReadonlySet<number>;
	exclude: ReadonlySet<number>;
	/** Ligák, amelyekben van include-csapat: itt csak az include-csapatok meccsei maradnak. */
	includeLeagues: ReadonlySet<number>;
}

export const NO_TEAM_FILTER: TeamFilterIndex = { include: new Set(), exclude: new Set(), includeLeagues: new Set() };

export function buildTeamFilterIndex(
	filters: readonly ISettingsTeamFilter[],
	memberships: readonly TeamLeagueMembership[]
): TeamFilterIndex {
	const include = new Set(filters.filter((f) => f.mode === 'include').map((f) => f.teamId));
	const exclude = new Set(filters.filter((f) => f.mode === 'exclude').map((f) => f.teamId));
	const includeLeagues = new Set(memberships.filter((m) => include.has(m.teamId)).map((m) => m.leagueId));
	return { include, exclude, includeLeagues };
}

/** Átengedi-e a szűrő a meccset (gyűjtés / ajánlás). Ismeretlen csapat-id nem zár ki. */
export function teamFilterAllows(fixture: TeamFilterFixture, index: TeamFilterIndex): boolean {
	const teams = [fixture.homeTeamId, fixture.awayTeamId].filter((t): t is number => typeof t === 'number');
	if (teams.some((t) => index.exclude.has(t))) return false;
	if (index.includeLeagues.has(fixture.leagueId)) return teams.some((t) => index.include.has(t));
	return true;
}
