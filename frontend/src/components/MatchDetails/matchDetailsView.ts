import { formatDecimal, formatSignedInt, MatchResult } from '@football/core';
import { IFormEntry, IH2HEntry, ITipTeam, RESULT_LETTER } from '../TipCard/tipView';

// MatchDetails nézet-logika (DESIGN §7.5): csak csoportosítás és magyar szöveg, a számolás triviális összegzés.

export type StripZone = 'cl' | 'eu' | 'rel' | 'mid' | 'home' | 'away';

export const STRIP_CELL_CLASS: Record<StripZone, string> = {
	cl: 'oe-strip__cell oe-strip__cell--cl',
	eu: 'oe-strip__cell oe-strip__cell--eu',
	rel: 'oe-strip__cell oe-strip__cell--rel',
	mid: 'oe-strip__cell',
	home: 'oe-strip__cell oe-strip__cell--home',
	away: 'oe-strip__cell oe-strip__cell--away'
};

export const DEFAULT_LEAGUE_SIZE = 20;
/** Legfeljebb ennyi egymás elleni meccs látszik. */
export const H2H_MAX = 5;
/** Ennél kevesebb H2H-nál figyelmeztetés. */
export const H2H_MIN_RELIABLE = 4;

/**
 * Tabella-sáv cellái (1. hely balra). Alapzónák: BL 1–4., európai kupa 5–6., kiesés az utolsó 3.
 * TODO(polish): ligánkénti zónák a `standings.description`-ből (core `Zone`), ha az ingestion menti.
 */
export const stripCells = (leagueSize: number, homeRank?: number, awayRank?: number): StripZone[] =>
	Array.from({ length: leagueSize }, (_, i): StripZone => {
		const pos = i + 1;
		if (pos === homeRank) return 'home';
		if (pos === awayRank) return 'away';
		if (pos <= 4) return 'cl';
		if (pos <= 6) return 'eu';
		if (pos > leagueSize - 3) return 'rel';
		return 'mid';
	});

/** „Bologna 7., Lazio 6. a 20-ból” */
export const stripAriaLabel = (home: ITipTeam, away: ITipTeam, leagueSize: number): string => {
	const part = (t: ITipTeam) => (t.rank !== undefined ? `${t.name} ${t.rank}.` : `${t.name} helyezése ismeretlen`);
	return `${part(home)}, ${part(away)} a ${leagueSize}-ból`;
};

/** „7. Bologna · 18 pont · gólkül. +4” (a hiányzó mezők kimaradnak). */
export const teamTableLine = (team: ITipTeam): string =>
	[
		team.rank !== undefined ? `${team.rank}. ${team.name}` : team.name,
		team.points !== undefined ? `${team.points} pont` : undefined,
		team.goalDiff !== undefined ? `gólkül. ${formatSignedInt(team.goalDiff)}` : undefined
	]
		.filter(Boolean)
		.join(' · ');

const resultCounts = (results: readonly MatchResult[]): string => {
	const count = (r: MatchResult) => results.filter((x) => x === r).length;
	return (['W', 'D', 'L'] as MatchResult[]).map((r) => `${count(r)} ${RESULT_LETTER[r]}`).join(' · ');
};

const mean = (values: readonly number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

/** Utolsó 5, legutóbbi felül. */
export const recentRows = (last5: readonly IFormEntry[]): IFormEntry[] =>
	[...last5].sort((a, b) => b.date.getTime() - a.date.getTime());

/** „3 Gy · 1 D · 1 V · átl. 2,4 gól/meccs” (gól = a meccs összes gólja). */
export const recentSummary = (entries: readonly IFormEntry[]): string =>
	`${resultCounts(entries.map((e) => e.result))} · átl. ${formatDecimal(
		mean(entries.map((e) => e.goalsFor + e.goalsAgainst))
	)} gól/meccs`;

/** Egymás elleni sorok: legutóbbi felül, legfeljebb `H2H_MAX`. */
export const h2hRows = (h2h: readonly IH2HEntry[]): IH2HEntry[] =>
	[...h2h].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, H2H_MAX);

/** „Bologna szemszögéből: 1 Gy · 3 D · 1 V · átl. 1,8 gól · 4/5 meccs 2,5 alatt” */
export const h2hSummary = (homeName: string, rows: readonly IH2HEntry[]): string => {
	const goals = rows.map((r) => r.homeGoals + r.awayGoals);
	const under = goals.filter((g) => g < 2.5).length;
	return `${homeName} szemszögéből: ${resultCounts(rows.map((r) => r.result))} · átl. ${formatDecimal(
		mean(goals)
	)} gól · ${under}/${rows.length} meccs 2,5 alatt`;
};

export const H2H_FEW_WARNING = 'Kevés egymás elleni meccs, a H2H súlya kicsi.';
