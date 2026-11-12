// Elo-értékelés (strategy.md §4.2): gólkülönbséggel súlyozott K, hazai előny, szezonváltáskor visszahúzás az átlag felé.
// Inkrementális állapot, hogy a walk-forward backtest (S15) meccsenként léptethesse; `eloRatings` a pont-idejű kényelmi forma.
import { playedBefore, type PlayedMatch, type TeamId } from '../features/types';

export interface EloParams {
	/** Kezdő (átlagos) érték. */
	initial: number;
	k: number;
	/** Hazai előny Elo-pontban (csak a várható eredményben). */
	homeAdvantage: number;
	/** Ennyi nap szünet után a csapat értéke az átlag felé húzódik (szezonváltás). */
	seasonGapDays: number;
	/** A visszahúzás aránya (0 = nincs, 1 = teljesen az átlagra). */
	seasonRegression: number;
	/** A később (feljutóként) belépő csapat eltolása az átlaghoz képest. */
	newcomerOffset: number;
	/** Ennyi nappal az első rögzített meccs után belépő csapat számít feljutónak. */
	newcomerAfterDays: number;
}

export const DEFAULT_ELO_PARAMS: EloParams = {
	initial: 1500,
	k: 20,
	homeAdvantage: 60,
	seasonGapDays: 45,
	seasonRegression: 1 / 3,
	newcomerOffset: -50,
	newcomerAfterDays: 60
};

export interface EloTeam {
	rating: number;
	matches: number;
	lastKickoff: number;
}

export interface EloState {
	teams: Map<TeamId, EloTeam>;
	firstKickoff: number | null;
}

const DAY_MS = 86_400_000;

export const createEloState = (): EloState => ({ teams: new Map(), firstKickoff: null });

/** Várható pontarány (0–1) a hazai szemszögéből. */
export const eloExpected = (homeRating: number, awayRating: number, homeAdvantage: number = DEFAULT_ELO_PARAMS.homeAdvantage) =>
	1 / (1 + Math.pow(10, -(homeRating + homeAdvantage - awayRating) / 400));

/** Gólkülönbség-szorzó (World Football Elo). */
export const goalDiffMultiplier = (goalDiff: number): number => {
	const gd = Math.abs(goalDiff);
	if (gd <= 1) return 1;
	if (gd === 2) return 1.5;
	return (11 + gd) / 8;
};

/** A csapat értéke `kickoff` időpontban (szezonszünet-visszahúzással, ismeretlen csapatnál kezdőértékkel). Nem módosít. */
export const ratingAt = (state: EloState, teamId: TeamId, kickoff: number, params: EloParams = DEFAULT_ELO_PARAMS): number => {
	const team = state.teams.get(teamId);
	if (!team) {
		const newcomer = state.firstKickoff !== null && kickoff - state.firstKickoff > params.newcomerAfterDays * DAY_MS;
		return params.initial + (newcomer ? params.newcomerOffset : 0);
	}
	if (kickoff - team.lastKickoff > params.seasonGapDays * DAY_MS) {
		return team.rating + (params.initial - team.rating) * params.seasonRegression;
	}
	return team.rating;
};

/** Egy lejátszott meccs beépítése (az állapotot módosítja). A meccseket kezdés szerint növekvő sorrendben kell adni. */
export const updateElo = (state: EloState, match: PlayedMatch, params: EloParams = DEFAULT_ELO_PARAMS): EloState => {
	const t = Date.parse(match.kickoff);
	const rh = ratingAt(state, match.homeTeamId, t, params);
	const ra = ratingAt(state, match.awayTeamId, t, params);
	const expected = eloExpected(rh, ra, params.homeAdvantage);
	const score = match.homeGoals > match.awayGoals ? 1 : match.homeGoals === match.awayGoals ? 0.5 : 0;
	const delta = params.k * goalDiffMultiplier(match.homeGoals - match.awayGoals) * (score - expected);
	const bump = (teamId: TeamId, rating: number) =>
		state.teams.set(teamId, { rating, matches: (state.teams.get(teamId)?.matches ?? 0) + 1, lastKickoff: t });
	bump(match.homeTeamId, rh + delta);
	bump(match.awayTeamId, ra - delta);
	if (state.firstKickoff === null || t < state.firstKickoff) state.firstKickoff = t;
	return state;
};

/** Pont-idejű Elo-állapot: az `asOf` előtt kezdődött meccsekből. */
export const eloRatings = (matches: readonly PlayedMatch[], asOf: string, params: EloParams = DEFAULT_ELO_PARAMS): EloState => {
	const state = createEloState();
	for (const m of playedBefore(matches, asOf)) updateElo(state, m, params);
	return state;
};
