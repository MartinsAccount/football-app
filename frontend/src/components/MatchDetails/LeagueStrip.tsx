import React, { Component, CSSProperties } from 'react';
import { v } from '../../design/tokens/tokens';
import { ITipTeam } from '../TipCard/tipView';
import { STRIP_CELL_CLASS, stripAriaLabel, stripCells, teamTableLine } from './matchDetailsView';

interface ILeagueStripProps {
	league: string;
	leagueSize: number;
	home: ITipTeam;
	away: ITipTeam;
}

const legendStyle: CSSProperties = { columnGap: v('space.6'), rowGap: v('space.2'), marginTop: v('space.3') };
const teamStyle: CSSProperties = { marginTop: v('space.6') };

const Swatch = ({ token }: { token: Parameters<typeof v>[0] }) => (
	<span className="oe-swatch" style={{ background: v(token) }} aria-hidden="true" />
);

/** DESIGN §7.5 – „Tabella · {liga}”: zónás hely-sáv, jelmagyarázat, csapatonként helyezés/pont/gólkülönbség + tét. */
class LeagueStrip extends Component<ILeagueStripProps> {
	renderTeam(team: ITipTeam, token: 'color.zone.home' | 'color.zone.away') {
		return (
			<p className="text-small m-0" style={teamStyle}>
				<Swatch token={token} /> <strong>{teamTableLine(team)}</strong>
				{team.stake && (
					<>
						<br />
						<span className="oe-muted text-caption">Tét: {team.stake}</span>
					</>
				)}
			</p>
		);
	}

	render() {
		const { league, leagueSize, home, away } = this.props;
		return (
			<div className="min-w-0">
				<h4 className="oe-label">Tabella · {league}</h4>
				<div className="oe-strip" role="img" aria-label={stripAriaLabel(home, away, leagueSize)}>
					{stripCells(leagueSize, home.rank, away.rank).map((zone, i) => (
						<span key={i} className={STRIP_CELL_CLASS[zone]} />
					))}
				</div>
				<div className="oe-legend flex flex-wrap" style={legendStyle}>
					<span>1.–{leagueSize}. hely</span>
					<span>
						<Swatch token="color.zone.champions" /> BL
					</span>
					<span>
						<Swatch token="color.zone.europe" /> európai kupa
					</span>
					<span>
						<Swatch token="color.zone.relegation" /> kiesés
					</span>
				</div>
				{this.renderTeam(home, 'color.zone.home')}
				{this.renderTeam(away, 'color.zone.away')}
			</div>
		);
	}
}

export default LeagueStrip;
