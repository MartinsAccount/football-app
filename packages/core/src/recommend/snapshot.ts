// Ajánlás-pillanatkép (S18): a generátor (`npm run recommendations -w @football/db`) írja JSON-ba, a `/` oldal olvassa.
// Csak típusok; a dátumok ISO 8601 szövegek. A mezőnevek a PRD 6. fejezetét (és a frontend `ITip`-et) követik.
import type { MatchResult } from '../features/types';
import type { ConfidenceLevel, RecommendationRules } from './recommend';

export type SnapshotMarket = 'h2h' | 'ou15' | 'ou25' | 'ou35' | 'btts' | 'dc';
/** A 2,5-ös gólvonal kimenete történeti okból `Over`/`Under`; az 1,5 / 3,5 vonalé a vonallal képzett név (I28a). */
export type SnapshotOutcome =
	| 'Home'
	| 'Draw'
	| 'Away'
	| 'Over15'
	| 'Under15'
	| 'Over'
	| 'Under'
	| 'Over35'
	| 'Under35'
	| 'Yes'
	| 'No'
	| 'Home/Draw'
	| 'Home/Away'
	| 'Draw/Away';

export const SNAPSHOT_OUTCOMES: Record<SnapshotMarket, SnapshotOutcome[]> = {
	h2h: ['Home', 'Draw', 'Away'],
	ou15: ['Over15', 'Under15'],
	ou25: ['Over', 'Under'],
	ou35: ['Over35', 'Under35'],
	btts: ['Yes', 'No'],
	dc: ['Home/Draw', 'Home/Away', 'Draw/Away']
};

/** Pillanatkép-kimenet → API-Football piac-id, kimenet-név és vonal (a `placed_bet` / `prediction` sor kulcsa). */
export const SNAPSHOT_OUTCOME_MARKET: Readonly<
	Record<SnapshotOutcome, { marketId: number; selection: string; line: number | null }>
> = {
	Home: { marketId: 1, selection: 'Home', line: null },
	Draw: { marketId: 1, selection: 'Draw', line: null },
	Away: { marketId: 1, selection: 'Away', line: null },
	Over15: { marketId: 5, selection: 'Over', line: 1.5 },
	Under15: { marketId: 5, selection: 'Under', line: 1.5 },
	Over: { marketId: 5, selection: 'Over', line: 2.5 },
	Under: { marketId: 5, selection: 'Under', line: 2.5 },
	Over35: { marketId: 5, selection: 'Over', line: 3.5 },
	Under35: { marketId: 5, selection: 'Under', line: 3.5 },
	Yes: { marketId: 8, selection: 'Yes', line: null },
	No: { marketId: 8, selection: 'No', line: null },
	'Home/Draw': { marketId: 12, selection: 'Home/Draw', line: null },
	'Home/Away': { marketId: 12, selection: 'Home/Away', line: null },
	'Draw/Away': { marketId: 12, selection: 'Draw/Away', line: null }
};

export interface SnapshotFormEntry {
	result: MatchResult;
	opponent: string;
	home: boolean;
	goalsFor: number;
	goalsAgainst: number;
	date: string;
}

export interface SnapshotTeam {
	name: string;
	rank?: number;
	points?: number;
	goalDiff?: number;
	stake?: string;
	/** Legrégebbi elöl. */
	last5: SnapshotFormEntry[];
}

export interface SnapshotH2HEntry {
	date: string;
	homeName: string;
	awayName: string;
	homeGoals: number;
	awayGoals: number;
	/** A mostani hazai csapat szemszögéből. */
	result: MatchResult;
}

export interface RecommendationItem {
	fixtureId: number;
	league: string;
	leagueSize: number;
	kickoff: string;
	market: SnapshotMarket;
	outcome: SnapshotOutcome;
	/** Piaccal kombinált modell-valószínűség („Szerintünk”). */
	pModel: number;
	pModelRaw: number;
	pMarket: number;
	bestOdds: number;
	bookmaker: string;
	bookmakers: number;
	oddsAt: string;
	minOdds: number;
	ev: number;
	confidence: ConfidenceLevel;
	warnings: string[];
	reasons: string[];
	stakeUnits: number;
	modelVersion: string;
	home: SnapshotTeam;
	away: SnapshotTeam;
	h2h: SnapshotH2HEntry[];
}

export interface RecommendationSnapshot {
	modelVersion: string;
	/** Virtuális „most” (mentett adatnál) – ehhez képest „ma”/„holnap” és az adatok kora. */
	now: string;
	source: string;
	rules: RecommendationRules;
	/** Elemzett meccsek száma (ajánlással vagy anélkül). */
	analyzed: number;
	items: RecommendationItem[];
}
