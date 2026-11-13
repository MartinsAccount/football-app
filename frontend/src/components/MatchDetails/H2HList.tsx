import React, { Component, CSSProperties } from 'react';
import { formatPairing, formatScore, formatYearMonth } from '@football/core';
import { v } from '../../design/tokens/tokens';
import { IH2HEntry, RESULT_CHIP_CLASS, RESULT_LETTER } from '../TipCard/tipView';
import { H2H_FEW_WARNING, H2H_MIN_RELIABLE, h2hRows, h2hSummary } from './matchDetailsView';

interface IH2HListProps {
	homeName: string;
	h2h: IH2HEntry[];
}

const summaryStyle: CSSProperties = { marginTop: v('space.4') };

/** DESIGN §7.5 – „Egymás ellen · utolsó N”: dátum · párosítás · eredmény · chip (a mostani hazai szemszögéből). */
class H2HList extends Component<IH2HListProps> {
	render() {
		const { homeName, h2h } = this.props;
		const rows = h2hRows(h2h);
		return (
			<div className="min-w-0">
				<h4 className="oe-label">Egymás ellen · utolsó {rows.length}</h4>
				{rows.length === 0 && <p className="oe-muted text-small m-0">Nincs mentett egymás elleni meccs.</p>}
				{rows.map((r) => (
					<div key={r.date.toISOString()} className="oe-row oe-row--h2h">
						<span className="oe-muted">{formatYearMonth(r.date)}</span>
						<span className="oe-row__ellipsis">{formatPairing(r.homeName, r.awayName)}</span>
						<span className="oe-row__score">{formatScore(r.homeGoals, r.awayGoals)}</span>
						<span className={`oe-chip ${RESULT_CHIP_CLASS[r.result]}`}>{RESULT_LETTER[r.result]}</span>
					</div>
				))}
				{rows.length > 0 && <div className="oe-summary">{h2hSummary(homeName, rows)}</div>}
				{rows.length < H2H_MIN_RELIABLE && (
					<div className="oe-warning" style={summaryStyle}>
						⚠ {H2H_FEW_WARNING}
					</div>
				)}
			</div>
		);
	}
}

export default H2HList;
