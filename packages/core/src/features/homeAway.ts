// Hazai / vendég bontás (strategy.md §3): csapatonkénti hazai és vendég átlagok + a liga globális hazai előnye.
import { playedBefore, teamView, type PlayedMatch, type TeamId } from './types';

export interface VenueSplit {
	matches: number;
	ppg: number | null;
	goalsFor: number | null;
	goalsAgainst: number | null;
}

export interface HomeAwaySplit {
	home: VenueSplit;
	away: VenueSplit;
}

interface Acc {
	n: number;
	pts: number;
	gf: number;
	ga: number;
}

const toSplit = (a: Acc): VenueSplit =>
	a.n === 0
		? { matches: 0, ppg: null, goalsFor: null, goalsAgainst: null }
		: { matches: a.n, ppg: a.pts / a.n, goalsFor: a.gf / a.n, goalsAgainst: a.ga / a.n };

export const homeAwaySplit = (matches: readonly PlayedMatch[], teamId: TeamId, asOf: string): HomeAwaySplit => {
	const home: Acc = { n: 0, pts: 0, gf: 0, ga: 0 };
	const away: Acc = { n: 0, pts: 0, gf: 0, ga: 0 };
	for (const m of playedBefore(matches, asOf)) {
		const v = teamView(m, teamId);
		if (!v) continue;
		const a = v.isHome ? home : away;
		a.n++;
		a.pts += v.points;
		a.gf += v.goalsFor;
		a.ga += v.goalsAgainst;
	}
	return { home: toSplit(home), away: toSplit(away) };
};

export interface LeagueHomeAdvantage {
	matches: number;
	homeGoals: number;
	awayGoals: number;
	/** Hazai − vendég gól/meccs. */
	goalAdvantage: number;
	homeWinRate: number;
	drawRate: number;
	awayWinRate: number;
}

/** A liga hazai előnye az `asOf` előtti meccsekből; `null`, ha nincs meccs. */
export const leagueHomeAdvantage = (matches: readonly PlayedMatch[], asOf: string): LeagueHomeAdvantage | null => {
	const ms = playedBefore(matches, asOf);
	if (ms.length === 0) return null;
	let hg = 0;
	let ag = 0;
	let hw = 0;
	let d = 0;
	for (const m of ms) {
		hg += m.homeGoals;
		ag += m.awayGoals;
		if (m.homeGoals > m.awayGoals) hw++;
		else if (m.homeGoals === m.awayGoals) d++;
	}
	const n = ms.length;
	return {
		matches: n,
		homeGoals: hg / n,
		awayGoals: ag / n,
		goalAdvantage: (hg - ag) / n,
		homeWinRate: hw / n,
		drawRate: d / n,
		awayWinRate: (n - hw - d) / n
	};
};
