// Feature-ök közös bemenete (S12): lejátszott meccsek minimális alakja. A DB `fixture` soraiból képezhető.
// Minden feature pont-idejű: csak az `asOf` ELŐTT kezdődött meccsekből számol (nincs jövőbe látás a backtestben).

export type TeamId = number;

export interface PlayedMatch {
	id: number;
	/** Kezdés, ISO 8601. */
	kickoff: string;
	homeTeamId: TeamId;
	awayTeamId: TeamId;
	homeGoals: number;
	awayGoals: number;
}

export type MatchResult = 'W' | 'D' | 'L';

/** Az `asOf` előtt kezdődött meccsek, kezdés szerint növekvő sorrendben (új tömb). */
export const playedBefore = (matches: readonly PlayedMatch[], asOf: string): PlayedMatch[] => {
	const limit = Date.parse(asOf);
	if (Number.isNaN(limit)) throw new Error(`Érvénytelen asOf: ${asOf}`);
	return matches
		.filter((m) => Date.parse(m.kickoff) < limit)
		.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
};

export interface TeamView {
	isHome: boolean;
	opponentId: TeamId;
	goalsFor: number;
	goalsAgainst: number;
	result: MatchResult;
	points: number;
}

/** Egy meccs a csapat szemszögéből; `null`, ha a csapat nem játszott rajta. */
export const teamView = (m: PlayedMatch, teamId: TeamId): TeamView | null => {
	const isHome = m.homeTeamId === teamId;
	if (!isHome && m.awayTeamId !== teamId) return null;
	const goalsFor = isHome ? m.homeGoals : m.awayGoals;
	const goalsAgainst = isHome ? m.awayGoals : m.homeGoals;
	const result: MatchResult = goalsFor > goalsAgainst ? 'W' : goalsFor === goalsAgainst ? 'D' : 'L';
	return {
		isHome,
		opponentId: isHome ? m.awayTeamId : m.homeTeamId,
		goalsFor,
		goalsAgainst,
		result,
		points: result === 'W' ? 3 : result === 'D' ? 1 : 0
	};
};
