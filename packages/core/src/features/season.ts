// Szezonszakasz és tabella-tier (strategy.md §3): eleje ≤ 20%, hajrá ≥ 80%; top 4 / közép / alsó 4.
import type { StandingRow } from './standings';

export type SeasonPhase = 'eleje' | 'kozepe' | 'hajra';
export type TableTier = 'felso' | 'kozep' | 'also';

/** Körmérkőzéses liga fordulószáma: 2 × (n − 1). */
export const totalRounds = (teamCount: number): number => {
	if (!(Number.isInteger(teamCount) && teamCount >= 2)) throw new Error(`Érvénytelen csapatszám: ${teamCount}`);
	return 2 * (teamCount - 1);
};

/** Szezon-előrehaladás 0–1: az átlagosan lejátszott meccsek / összes forduló. */
export const seasonProgress = (table: readonly StandingRow[], rounds?: number): number => {
	if (table.length < 2) return 0;
	const avgPlayed = table.reduce((s, r) => s + r.played, 0) / table.length;
	return Math.min(1, avgPlayed / (rounds ?? totalRounds(table.length)));
};

export const seasonPhase = (progress: number): SeasonPhase => (progress <= 0.2 ? 'eleje' : progress >= 0.8 ? 'hajra' : 'kozepe');

/** Tabella-tier a helyezésből (alap: felső 4 / alsó 4). */
export const tableTier = (position: number, teamCount: number, size = 4): TableTier =>
	position <= size ? 'felso' : position > teamCount - size ? 'also' : 'kozep';
