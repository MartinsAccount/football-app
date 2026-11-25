import React, { Component } from 'react';
import { v } from '../../design/tokens/tokens';
import { ITipTeam } from '../TipCard/tipView';
import { STRIP_CELL_CLASS, stripAriaLabel, stripCells, teamTableLine } from './matchDetailsView';

interface ILeagueStripProps {
	league: string;
	leagueSize: number;
	home: ITipTeam;
	away: ITipTeam;
}

const Swatch = ({ token }: { token: Parameters<typeof v>[0] }) => (
	<i className="oe-swatch" style={{ background: v(token) }} aria-hidden="true" />
);

/** DESIGN §6 – „Tabella · {liga}”: hely-sáv a két csapattal, alatta `.oe-standing` sorok (helyezés/pont/gólkülönbség + tét). */
class LeagueStrip extends Component<ILeagueStripProps> {
	renderTeam(team: ITipTeam, token: 'color.zone.home' | 'color.zone.away') {
		return (
			<div className="oe-standing">
				<Swatch token={token} />
				<strong>{teamTableLine(team)}</strong>
				{team.stake && <small>Tét: {team.stake}</small>}
			</div>
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
				<div className="oe-legend">1.–{leagueSize}. hely</div>
				{this.renderTeam(home, 'color.zone.home')}
				{this.renderTeam(away, 'color.zone.away')}
			</div>
		);
	}
}

export default LeagueStrip;
