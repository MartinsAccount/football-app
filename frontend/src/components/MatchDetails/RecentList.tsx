import React, { Component } from 'react';
import { formatScore } from '@football/core';
import { formChipTitle, ITipTeam, RESULT_CHIP_CLASS, RESULT_LETTER } from '../TipCard/tipView';
import { recentRows, recentSummary } from './matchDetailsView';

interface IRecentListProps {
	team: ITipTeam;
}

/** DESIGN §7.5 – „{csapat} · utolsó 5”: chip · vs/@ ellenfél · eredmény, legutóbbi felül. */
class RecentList extends Component<IRecentListProps> {
	render() {
		const { team } = this.props;
		const rows = recentRows(team.last5);
		return (
			<div className="min-w-0">
				<h4 className="oe-label">
					{team.name} · utolsó {rows.length}
				</h4>
				{rows.map((r) => (
					<div key={r.date.toISOString()} className="oe-row" title={formChipTitle(r)}>
						<span className={`oe-chip ${RESULT_CHIP_CLASS[r.result]}`}>{RESULT_LETTER[r.result]}</span>
						<span className="oe-row__ellipsis">
							<span className="oe-muted">{r.home ? 'vs' : '@'}</span> {r.opponent}
						</span>
						<span className="oe-row__score">{formatScore(r.goalsFor, r.goalsAgainst)}</span>
					</div>
				))}
				{rows.length > 0 && <div className="oe-summary">{recentSummary(rows)}</div>}
			</div>
		);
	}
}

export default RecentList;
