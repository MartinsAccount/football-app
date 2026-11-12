import React, { Component } from 'react';
import { formAriaLabel, formChipTitle, ITipTeam, RESULT_CHIP_CLASS, RESULT_LETTER } from './tipView';

interface ITeamFormProps {
	home: ITipTeam;
	away: ITipTeam;
}

/** DESIGN §7.4/3: két oszlop, helyezés + név + 5 FormChip (legrégebbi balra). */
class TeamForm extends Component<ITeamFormProps> {
	renderTeam(team: ITipTeam) {
		return (
			<div className="min-w-0">
				<div className="oe-team__name" title={team.name}>
					{team.rank !== undefined && <strong>{team.rank}.</strong>} {team.name}
				</div>
				<ol className="oe-form" aria-label={formAriaLabel(team.name, team.last5)}>
					{team.last5.map((entry, i) => (
						<li key={i} className={`oe-chip ${RESULT_CHIP_CLASS[entry.result]}`} title={formChipTitle(entry)}>
							{RESULT_LETTER[entry.result]}
						</li>
					))}
				</ol>
			</div>
		);
	}

	render() {
		const { home, away } = this.props;
		return (
			<div className="oe-teams">
				{this.renderTeam(home)}
				{this.renderTeam(away)}
			</div>
		);
	}
}

export default TeamForm;
