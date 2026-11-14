import { readApi } from '../../../services/readApi';
import { mapLimit, OddsMatch, toOddsMatch } from './oddsMatch';

/** A régi (Unibet, 2021) odds-mentés szezonja – ehhez van meccs + odds a DB-ben (S08 legacy-import). */
export const ODDS_STATS_SEASON = 2021;

/**
 * Az Odds-statisztika adatforrása: kizárólag az olvasó API (ROADMAP 1.8), külső API-Football-hívás nincs.
 * TODO(polish): tömeges odds-végpont a meccsenkénti `getOdds` helyett.
 */
class OddsService {
	public async loadLeagueMatches(leagueId: number): Promise<OddsMatch[]> {
		const { fixtures } = await readApi.listFixtures({ league: leagueId, season: ODDS_STATS_SEASON, status: ['FT'], limit: 1000 });
		const matches = await mapLimit(fixtures, 6, async (f) => toOddsMatch(f, (await readApi.getOdds(f.id)).snapshot));
		return matches.filter((m): m is OddsMatch => m !== null);
	}
}

export default new OddsService();
