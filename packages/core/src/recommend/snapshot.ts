// Ajánlás-pillanatkép (S18): a generátor (`npm run recommendations -w @football/db`) írja JSON-ba, a `/` oldal olvassa.
// Csak típusok; a dátumok ISO 8601 szövegek. A mezőnevek a PRD 6. fejezetét (és a frontend `ITip`-et) követik.
import type { MatchResult } from '../features/types';
import type { ConfidenceLevel, RecommendationRules } from './recommend';

export type SnapshotMarket = 'h2h' | 'ou25' | 'btts';
export type SnapshotOutcome = 'Home' | 'Draw' | 'Away' | 'Over' | 'Under' | 'Yes' | 'No';

export const SNAPSHOT_OUTCOMES: Record<SnapshotMarket, SnapshotOutcome[]> = {
	h2h: ['Home', 'Draw', 'Away'],
	ou25: ['Over', 'Under'],
	btts: ['Yes', 'No']
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
