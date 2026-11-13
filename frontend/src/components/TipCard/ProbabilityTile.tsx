import React, { Component, CSSProperties } from 'react';
import { formatPercent } from '@football/core';
import { barWidth, probabilityAriaLabel } from './tipView';

interface IProbabilityTileProps {
	pModel: number;
	pMarket: number;
}

/** DESIGN §6 Ma – tippkártya, 3. csempe: „Esély · szerintünk / irodák” + egy `.oe-pbar` (kitöltés = mi, marker = irodák). */
class ProbabilityTile extends Component<IProbabilityTileProps> {
	render() {
		const { pModel, pMarket } = this.props;
		const bar = { '--p': barWidth(pModel), '--m': barWidth(pMarket) } as CSSProperties;
		return (
			<div className="oe-tile">
				<div className="oe-tile__label">Esély · szerintünk / irodák</div>
				<div className="oe-tile__value">
					{formatPercent(pModel)}
					<small>/ {formatPercent(pMarket)}</small>
				</div>
				<div className="oe-pbar" style={bar} role="img" aria-label={probabilityAriaLabel(pModel, pMarket)}>
					<div className="oe-pbar__fill" />
					<div className="oe-pbar__marker" />
				</div>
			</div>
		);
	}
}

export default ProbabilityTile;
