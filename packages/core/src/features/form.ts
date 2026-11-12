// Forma (strategy.md §3): az utolsó N meccs pont/meccs és gólkülönbség, exponenciálisan súlyozva (a legfrissebb súlya 1).
// TODO(S13): ellenfél-erő korrekció (Elo-reziduum), ha az Elo kész.
import { playedBefore, teamView, type MatchResult, type PlayedMatch, type TeamId } from './types';

export type Venue = 'all' | 'home' | 'away';

export interface FormOptions {
	/** Hány meccset nézünk (alap 6). */
	n?: number;
	/** Súlycsökkenés meccsenként visszafelé (alap 0,8). */
	decay?: number;
	/** Csak hazai / csak vendég meccsek (alap: mind). */
	venue?: Venue;
}

export interface TeamForm {
	teamId: TeamId;
	matches: number;
	/** Eredmények, a legfrissebb elöl. */
	results: MatchResult[];
	/** Súlyozott pont/meccs; `null`, ha nincs meccs. */
	ppg: number | null;
	/** Súlyozott gólkülönbség/meccs. */
	goalDiff: number | null;
	goalsFor: number | null;
	goalsAgainst: number | null;
}

export const teamForm = (matches: readonly PlayedMatch[], teamId: TeamId, asOf: string, opts: FormOptions = {}): TeamForm => {
	const { n = 6, decay = 0.8, venue = 'all' } = opts;
	if (!(n > 0)) throw new Error('A forma-ablak (n) legyen pozitív.');
	if (!(decay > 0 && decay <= 1)) throw new Error('A decay a (0, 1] tartományba essen.');
	const views = playedBefore(matches, asOf)
		.map((m) => teamView(m, teamId))
		.filter((v): v is NonNullable<typeof v> => v !== null && (venue === 'all' || v.isHome === (venue === 'home')))
		.reverse()
		.slice(0, n);
	if (views.length === 0)
		return { teamId, matches: 0, results: [], ppg: null, goalDiff: null, goalsFor: null, goalsAgainst: null };
	let w = 1;
	let sw = 0;
	let pts = 0;
	let gf = 0;
	let ga = 0;
	for (const v of views) {
		sw += w;
		pts += w * v.points;
		gf += w * v.goalsFor;
		ga += w * v.goalsAgainst;
		w *= decay;
	}
	return {
		teamId,
		matches: views.length,
		results: views.map((v) => v.result),
		ppg: pts / sw,
		goalDiff: (gf - ga) / sw,
		goalsFor: gf / sw,
		goalsAgainst: ga / sw
	};
};
