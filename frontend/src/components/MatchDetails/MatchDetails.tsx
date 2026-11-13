import React, { Component } from 'react';
import { ITip } from '../TipCard/tipView';
import H2HList from './H2HList';
import LeagueStrip from './LeagueStrip';
import { DEFAULT_LEAGUE_SIZE } from './matchDetailsView';
import RecentList from './RecentList';

interface IMatchDetailsProps {
	tip: ITip;
}

/**
 * DESIGN §7.5 – a TipCard lenyitott része: `.oe-details` rács: tabella, egymás elleni, két csapat utolsó 5 meccse.
 * TODO(polish): „Hiányzók” blokk (sérültek/eltiltottak), ha az ingestion menti; odds-mozgás (ROADMAP H).
 */
class MatchDetails extends Component<IMatchDetailsProps> {
	render() {
		const { tip } = this.props;
		return (
			<div className="oe-details">
				<LeagueStrip league={tip.league} leagueSize={tip.leagueSize ?? DEFAULT_LEAGUE_SIZE} home={tip.home} away={tip.away} />
				<H2HList homeName={tip.home.name} h2h={tip.h2h} />
				<RecentList team={tip.home} />
				<RecentList team={tip.away} />
			</div>
		);
	}
}

export default MatchDetails;
