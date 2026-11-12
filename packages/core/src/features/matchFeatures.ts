// Egy közelgő meccs összes feature-e egy objektumban (a `prediction.features` JSON-ba és az indoklásba).
import { teamForm, type TeamForm } from './form';
import { headToHead, type HeadToHead } from './h2h';
import { homeAwaySplit, leagueHomeAdvantage, type HomeAwaySplit, type LeagueHomeAdvantage } from './homeAway';
import { motivationDiff, teamMotivation, type Motivation, type Zone } from './motivation';
import { seasonPhase, seasonProgress, tableTier, totalRounds, type SeasonPhase, type TableTier } from './season';
import { deriveStandings, tablePosition, type TablePosition } from './standings';
import type { PlayedMatch, TeamId } from './types';

export interface UpcomingFixture {
	id: number;
	kickoff: string;
	homeTeamId: TeamId;
	awayTeamId: TeamId;
}

export interface MatchFeatureInput {
	/** A meccs ligájának és szezonjának meccsei (tabella, szezonszakasz, liga hazai előnye). */
	seasonMatches: readonly PlayedMatch[];
	/** Minden ismert meccs (forma szezonhatáron át, H2H); alap: `seasonMatches`. */
	history?: readonly PlayedMatch[];
	/** A liga csapatai (a még meccs nélküliek is a tabellára kerülnek). */
	teamIds?: readonly TeamId[];
	zones?: readonly Zone[];
	formN?: number;
}

export interface TeamFeatures {
	teamId: TeamId;
	form: TeamForm;
	/** Forma csak a mostani helyszínen (hazai csapatnál hazai meccsek). */
	venueForm: TeamForm;
	split: HomeAwaySplit;
	table: TablePosition | null;
	tier: TableTier | null;
	motivation: Motivation | null;
}

export interface MatchFeatures {
	fixtureId: number;
	asOf: string;
	home: TeamFeatures;
	away: TeamFeatures;
	/** A hazai csapat szemszögéből. */
	h2h: HeadToHead;
	season: { rounds: number; progress: number; phase: SeasonPhase };
	league: LeagueHomeAdvantage | null;
	/** Hazai − vendég motiváció-pontszám (−2…2). */
	motivationDiff: number;
}

export const buildMatchFeatures = (fixture: UpcomingFixture, input: MatchFeatureInput): MatchFeatures => {
	const asOf = fixture.kickoff;
	const history = input.history ?? input.seasonMatches;
	const teamIds = new Set<TeamId>(input.teamIds ?? []);
	teamIds.add(fixture.homeTeamId).add(fixture.awayTeamId);
	const table = deriveStandings(input.seasonMatches, asOf, [...teamIds]);
	const rounds = totalRounds(Math.max(2, table.length));
	const progress = seasonProgress(table, rounds);

	const team = (teamId: TeamId, venue: 'home' | 'away'): TeamFeatures => {
		const pos = tablePosition(table, teamId);
		return {
			teamId,
			form: teamForm(history, teamId, asOf, { n: input.formN }),
			venueForm: teamForm(history, teamId, asOf, { n: input.formN, venue }),
			split: homeAwaySplit(input.seasonMatches, teamId, asOf),
			table: pos,
			tier: pos ? tableTier(pos.position, pos.teamCount) : null,
			motivation: teamMotivation(table, teamId, { zones: input.zones, rounds })
		};
	};

	const home = team(fixture.homeTeamId, 'home');
	const away = team(fixture.awayTeamId, 'away');
	return {
		fixtureId: fixture.id,
		asOf,
		home,
		away,
		h2h: headToHead(history, fixture.homeTeamId, fixture.awayTeamId, asOf),
		season: { rounds, progress, phase: seasonPhase(progress) },
		league: leagueHomeAdvantage(input.seasonMatches, asOf),
		motivationDiff: motivationDiff(home.motivation, away.motivation)
	};
};
