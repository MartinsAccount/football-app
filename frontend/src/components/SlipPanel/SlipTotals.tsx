import React from 'react';
import { formatEv, formatOdds, SlipSummary } from '@football/core';

/** DESIGN §7.6/4 – két csempe: eredő odds + Tippmix-minimum, várható érték. */
const SlipTotals = ({ summary }: { summary: SlipSummary }) => (
	<div className="oe-slip__totals">
		<div className="oe-tile">
			<div className="oe-stat__label">Eredő odds</div>
			<div className="oe-stat__value">{formatOdds(summary.combinedOdds)}</div>
			<div className="oe-tile__foot">Tippmixen min. {formatOdds(summary.minCombinedOdds)}</div>
		</div>
		<div className="oe-tile">
			<div className="oe-stat__label">Várható érték</div>
			<div className={summary.ev > 0 ? 'oe-stat__value oe-stat__value--ev' : 'oe-stat__value'}>{formatEv(summary.ev)}</div>
			<div className="oe-tile__foot">
				{summary.estimated ? 'modell szerint, legjobb oddsból' : 'modell szerint, Tippmix-oddsból'}
			</div>
		</div>
	</div>
);

export default SlipTotals;
