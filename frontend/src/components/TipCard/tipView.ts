import { formatPp, formatScore, MatchResult, NBSP } from '@football/core';

/** Egy forma-bejegyzés egy csapat szemszögéből (DESIGN §7.4–7.5). */
export interface IFormEntry {
	result: MatchResult;
	opponent: string;
	/** A csapat hazai pályán játszott-e. */
	home: boolean;
	goalsFor: number;
	goalsAgainst: number;
	date: Date;
}

export interface ITipTeam {
	name: string;
	rank?: number;
	points?: number;
	goalDiff?: number;
	/** Tét magyarul, pl. „európai kupahelyért”. */
	stake?: string;
	/** Utolsó 5 meccs, legrégebbi elöl. */
	last5: IFormEntry[];
}

/** Egymás elleni meccs; az eredmény a mostani hazai csapat szemszögéből. */
export interface IH2HEntry {
	date: Date;
	homeName: string;
	awayName: string;
	homeGoals: number;
	awayGoals: number;
	result: MatchResult;
}

export type Confidence = 'low' | 'medium' | 'high';

/** A TipCard nézet-modellje: a PRD 6. fejezet mezői (DESIGN §7.4 „Adat”). A számok a magból jönnek, itt csak formázás van. */
export interface ITip {
	id: string;
	fixtureId: number;
	league: string;
	kickoff: Date;
	market: string;
	outcome: string;
	/** Piac Tippmix-nyelven, pl. „Gólok száma 2,5 · Alatt”. */
	tippmixLabel: string;
	pModel: number;
	pMarket: number;
	bestOdds: number;
	bookmaker: string;
	oddsAt: Date;
	minOdds: number;
	ev: number;
	confidence: Confidence;
	warnings: string[];
	home: ITipTeam;
	away: ITipTeam;
	h2h: IH2HEntry[];
	/** A liga csapatszáma (tabella-sáv, DESIGN §7.5); alapból 20. */
	leagueSize?: number;
	modelVersion: string;
}

export const RESULT_LETTER: Record<MatchResult, string> = { W: 'Gy', D: 'D', L: 'V' };
export const RESULT_CHIP_CLASS: Record<MatchResult, string> = { W: 'oe-chip--win', D: 'oe-chip--draw', L: 'oe-chip--loss' };

const CONFIDENCE_LABEL: Record<Confidence, string> = { low: 'alacsony', medium: 'közepes', high: 'magas' };

/** „bizonyosság: magas” */
export const confidenceText = (confidence: Confidence): string => `bizonyosság: ${CONFIDENCE_LABEL[confidence]}`;

/** Form-chip sor felolvasása (DESIGN §11): „Bologna utolsó 5: Gy D V Gy D”. */
export const formAriaLabel = (team: string, entries: readonly IFormEntry[]): string =>
	`${team} utolsó ${entries.length}: ${entries.map((e) => RESULT_LETTER[e.result]).join(' ')}`;

/** Chip `title`: „Gy vs Lecce 2–0”, idegenben „V @ Inter 0–1”. */
export const formChipTitle = (entry: IFormEntry): string =>
	`${RESULT_LETTER[entry.result]} ${entry.home ? 'vs' : '@'} ${entry.opponent} ${formatScore(
		entry.goalsFor,
		entry.goalsAgainst
	)}`;

/** Az érték-sor szövege; `positive` → accent kiemelés. */
export const edgeText = (pModel: number, pMarket: number): { text: string; positive: boolean } => {
	const pp = Math.round((pModel - pMarket) * 100);
	return pp > 0
		? { text: `${formatPp(pp)} érték a javunkra`, positive: true }
		: { text: `${formatPp(pp)} a piachoz képest`, positive: false };
};

/** Sáv-szélesség CSS-értékként (0–100%), a `--p` változóhoz. */
export const barWidth = (p: number): string => `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%`;

export const slipToggleText = (selected: boolean): string => (selected ? '✓ Szelvényen' : `+${NBSP}Szelvényre`);
