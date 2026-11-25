// Pont-idejű tabella (ROADMAP 4.3 `standing_derived` magja) és tabellahely-feature (strategy.md §3).
// Holtverseny: pont → gólkülönbség → rúgott gól → teamId. TODO(polish): ligánkénti tiebreak (H2H) – most determinisztikus közelítés.
import { playedBefore, teamView, type PlayedMatch, type TeamId } from './types';

export interface StandingRow {
	position: number;
	teamId: TeamId;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDiff: number;
	points: number;
}

/**
 * Tabella az `asOf` előtti meccsekből. `teamIds`: a még meccs nélküli csapatok is bekerülnek (0 ponttal);
 * a `matches` egy liga egy szezonjának meccsei legyenek.
 */
export const deriveStandings = (
	matches: readonly PlayedMatch[],
	asOf: string,
	teamIds: readonly TeamId[] = []
): StandingRow[] => {
	const rows = new Map<TeamId, StandingRow>();
	const row = (teamId: TeamId) => {
		let r = rows.get(teamId);
		if (!r) {
			r = { position: 0, teamId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };
			rows.set(teamId, r);
		}
		return r;
	};
	teamIds.forEach(row);
	for (const m of playedBefore(matches, asOf)) {
		for (const teamId of [m.homeTeamId, m.awayTeamId]) {
			const v = teamView(m, teamId)!;
			const r = row(teamId);
			r.played++;
			r.goalsFor += v.goalsFor;
			r.goalsAgainst += v.goalsAgainst;
			r.goalDiff = r.goalsFor - r.goalsAgainst;
			r.points += v.points;
			if (v.result === 'W') r.won++;
			else if (v.result === 'D') r.drawn++;
			else r.lost++;
		}
	}
	return [...rows.values()]
		.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.teamId - b.teamId)
		.map((r, i) => ({ ...r, position: i + 1 }));
};

export interface TablePosition {
	position: number;
	teamCount: number;
	points: number;
	played: number;
	/** Pont/meccs; `null`, ha még nem játszott. */
	ppg: number | null;
	/** A felette álló pontjai − saját pont; az elsőnél `null`. */
	gapAbove: number | null;
	/** Saját pont − az alatta álló pontjai; az utolsónál `null`. */
	gapBelow: number | null;
}

export const tablePosition = (table: readonly StandingRow[], teamId: TeamId): TablePosition | null => {
	const i = table.findIndex((r) => r.teamId === teamId);
	if (i < 0) return null;
	const r = table[i];
	return {
		position: r.position,
		teamCount: table.length,
		points: r.points,
		played: r.played,
		ppg: r.played === 0 ? null : r.points / r.played,
		gapAbove: i === 0 ? null : table[i - 1].points - r.points,
		gapBelow: i === table.length - 1 ? null : r.points - table[i + 1].points
	};
};
