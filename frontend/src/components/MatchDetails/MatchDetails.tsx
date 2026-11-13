import React, { Component, CSSProperties } from 'react';
import { v } from '../../design/tokens/tokens';
import { ITip } from '../TipCard/tipView';
import H2HList from './H2HList';
import LeagueStrip from './LeagueStrip';
import { DEFAULT_LEAGUE_SIZE } from './matchDetailsView';
import RecentList from './RecentList';

interface IMatchDetailsProps {
	tip: ITip;
}

const legendStyle: CSSProperties = { marginTop: v('space.9') };

/**
 * DESIGN §7.5 – a TipCard lenyitott része: tabella, egymás elleni, két csapat utolsó 5 meccse, alul jelmagyarázat.
 * TODO(polish): „Hiányzók” blokk (sérültek/eltiltottak), ha az ingestion menti; odds-mozgás (ROADMAP H).
 */
class MatchDetails extends Component<IMatchDetailsProps> {
	render() {
		const { tip } = this.props;
		return (
			<>
				<div className="oe-details">
					<LeagueStrip league={tip.league} leagueSize={tip.leagueSize ?? DEFAULT_LEAGUE_SIZE} home={tip.home} away={tip.away} />
					<H2HList homeName={tip.home.name} h2h={tip.h2h} />
					<RecentList team={tip.home} />
					<RecentList team={tip.away} />
				</div>
				<div className="oe-legend" style={legendStyle}>
					Gy = győzelem · D = döntetlen · V = vereség · „vs” = otthon, „@” = idegenben
				</div>
			</>
		);
	}
}

export default MatchDetails;
