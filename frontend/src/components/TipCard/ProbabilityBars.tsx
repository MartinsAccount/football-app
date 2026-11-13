import React, { Component, CSSProperties } from 'react';
import { formatPercent } from '@football/core';
import { barWidth, edgeText } from './tipView';

interface IProbabilityBarsProps {
	pModel: number;
	pMarket: number;
}

const fill = (p: number) => ({ '--p': barWidth(p) } as CSSProperties);

/**
 * DESIGN §7.4/4: „Szerintünk” (modell) vs. „Irodák szerint” (piac) + érték-sor. A sáv a v0.2 `.oe-pbar`.
 * TODO(polish): S27a – a referencia egy sávban, piaci markerrel mutatja (`.oe-pbar__marker`).
 */
class ProbabilityBars extends Component<IProbabilityBarsProps> {
	render() {
		const { pModel, pMarket } = this.props;
		const edge = edgeText(pModel, pMarket);
		return (
			<div className="flex flex-col gap-sp-4 text-caption">
				<div>
					<div className="flex justify-between gap-sp-4">
						<span className="oe-muted">Szerintünk</span>
						<span className="font-bold tabular-nums">{formatPercent(pModel)}</span>
					</div>
					<div className="oe-pbar" aria-hidden="true">
						<div className="oe-pbar__fill" style={fill(pModel)} />
					</div>
				</div>
				<div>
					<div className="flex justify-between gap-sp-4">
						<span className="oe-muted">Irodák szerint</span>
						<span className="oe-muted tabular-nums">{formatPercent(pMarket)}</span>
					</div>
					<div className="oe-pbar" aria-hidden="true">
						<div className="oe-pbar__fill bg-data-market" style={fill(pMarket)} />
					</div>
				</div>
				<div className={edge.positive ? 'font-bold text-accent-text' : 'oe-muted'}>{edge.text}</div>
			</div>
		);
	}
}

export default ProbabilityBars;
