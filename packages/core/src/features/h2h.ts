// H2H (strategy.md §3): az utolsó max. 6 egymás elleni meccs átlagos gólkülönbsége, erős shrinkage-dzsel (kevés minta).
import { playedBefore, teamView, type PlayedMatch, type TeamId } from './types';

export interface H2HOptions {
	/** Max. ennyi egymás elleni meccs (alap 6). */
	limit?: number;
	/** Shrinkage-erősség: shrunk = átlag × n / (n + k) (alap 6). */
	k?: number;
}

export interface HeadToHead {
	teamId: TeamId;
	opponentId: TeamId;
	matches: number;
	wins: number;
	draws: number;
	losses: number;
	/** Átlagos GK a `teamId` szemszögéből; `null`, ha nincs meccs. */
	meanGoalDiff: number | null;
	/** Nullához húzott átlag; meccs nélkül 0. */
	shrunkGoalDiff: number;
	/** A figyelembe vett meccsek, a legfrissebb elöl. */
	recent: PlayedMatch[];
}

export const headToHead = (
	matches: readonly PlayedMatch[],
	teamId: TeamId,
	opponentId: TeamId,
	asOf: string,
	opts: H2HOptions = {}
): HeadToHead => {
	const { limit = 6, k = 6 } = opts;
	const recent = playedBefore(matches, asOf)
		.filter((m) => teamView(m, teamId)?.opponentId === opponentId)
		.reverse()
		.slice(0, limit);
	let wins = 0;
	let draws = 0;
	let gd = 0;
	for (const m of recent) {
		const v = teamView(m, teamId)!;
		gd += v.goalsFor - v.goalsAgainst;
		if (v.result === 'W') wins++;
		else if (v.result === 'D') draws++;
	}
	const n = recent.length;
	const mean = n === 0 ? null : gd / n;
	return {
		teamId,
		opponentId,
		matches: n,
		wins,
		draws,
		losses: n - wins - draws,
		meanGoalDiff: mean,
		shrunkGoalDiff: mean === null ? 0 : (mean * n) / (n + k),
		recent
	};
};
