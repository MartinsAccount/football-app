// Teszt-segéd: rövid meccs-konstruktor (nem teszt-fájl, hogy importálható legyen).
import type { PlayedMatch } from './types';

export const day = (d: number) => `2024-01-${String(d).padStart(2, '0')}T15:00:00Z`;

export const m = (id: number, d: number, home: number, away: number, hg: number, ag: number): PlayedMatch => ({
	id,
	kickoff: day(d),
	homeTeamId: home,
	awayTeamId: away,
	homeGoals: hg,
	awayGoals: ag
});
