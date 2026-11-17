// Saját stílus (ROADMAP 12.1, terv: docs/plans/owner-style-and-draws.md A): kvíz-kérdés és válasz.
// A kérdés egy LEJÁTSZOTT 2022–2024-es meccs nyitó adataiból áll; az eredményt a UI csak a válasz után mutatja.
import type { MatchResult } from '../features/types';

/** Egy tipp a kvízben: 1X2 vagy O/U 2,5. */
export type QuizPick = '1' | 'X' | '2' | 'over' | 'under';
export const QUIZ_PICKS: readonly QuizPick[] = ['1', 'X', '2', 'over', 'under'];

export interface QuizTeam {
	id: number;
	name: string;
	/** Utolsó (legfeljebb) 5 meccs eredménye, a legrégebbitől a legfrissebbig. */
	form: readonly MatchResult[];
	/** Tabellahely a meccs előtt (1 = első); `null`, ha nincs tabella (szezon eleje). */
	tablePosition: number | null;
}

export interface QuizQuestion {
	fixtureId: number;
	league: { id: number; name: string };
	/** Kezdés, ISO 8601. */
	kickoff: string;
	home: QuizTeam;
	away: QuizTeam;
	/** Nyitó 1X2 odds. */
	odds1x2: { home: number; draw: number; away: number };
	/** Nyitó O/U 2,5 odds; `null`, ha nincs → az over/under opció nem kínálható. */
	oddsOu25: { over: number; under: number } | null;
	/** A liga csapatszáma (a tabella-különbség skálázásához); alapból 20. */
	tableSize?: number;
}

export interface QuizAnswer {
	fixtureId: number;
	pick: QuizPick | 'skip';
	/** Opcionális bizalom 1–3 (v1-ben a tanítás nem súlyoz vele – DECISIONS 2026-11-17). */
	confidence?: 1 | 2 | 3;
}

/** Egy tanítóminta: kérdés + a tulajdonos válasza (kvíz vagy rögzített saját fogadás). */
export interface ProfileSample {
	question: QuizQuestion;
	answer: QuizAnswer;
}

/** A kérdésnél választható opciók (O/U csak, ha van rá odds). */
export const availablePicks = (q: QuizQuestion): QuizPick[] => (q.oddsOu25 ? [...QUIZ_PICKS] : ['1', 'X', '2']);
