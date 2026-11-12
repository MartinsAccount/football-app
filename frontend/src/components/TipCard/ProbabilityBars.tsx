import React, { Component, CSSProperties } from 'react';
import { formatPercent } from '@football/core';
import { barWidth, edgeText } from './tipView';

interface IProbabilityBarsProps {
	pModel: number;
	pMarket: number;
}

const fill = (p: number) => ({ '--p': barWidth(p) } as CSSProperties);

/** DESIGN §7.4/4: „Szerintünk” (accent) vs. „Irodák szerint” (market) + érték-sor. */
class ProbabilityBars extends Component<IProbabilityBarsProps> {
	render() {
		const { pModel, pMarket } = this.props;
		const edge = edgeText(pModel, pMarket);
		return (
			<div>
				<div className="oe-prob">
					<span className="oe-prob__label">Szerintünk</span>
					<div className="oe-prob__track" aria-hidden="true">
						<div className="oe-prob__fill oe-prob__fill--model" style={fill(pModel)} />
					</div>
					<span className="oe-prob__value">{formatPercent(pModel)}</span>
					<span className="oe-prob__label">Irodák szerint</span>
					<div className="oe-prob__track" aria-hidden="true">
						<div className="oe-prob__fill oe-prob__fill--market" style={fill(pMarket)} />
					</div>
					<span className="oe-prob__value oe-prob__value--market">{formatPercent(pMarket)}</span>
				</div>
				<div className={edge.positive ? 'oe-prob__edge' : 'oe-prob__edge oe-muted'}>{edge.text}</div>
			</div>
		);
	}
}

export default ProbabilityBars;
