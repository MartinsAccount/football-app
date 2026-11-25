import React, { CSSProperties } from 'react';
import { formatPercent, RiskLevel } from '@football/core';
import { barWidth } from '../TipCard/tipView';
import { v } from '../../design/tokens/tokens';
import { riskText } from './slipView';

const noteStyle: CSSProperties = { marginTop: v('space.3') };

interface IRiskMeterProps {
	probability: number;
	level: RiskLevel;
}

/** DESIGN §7.6/5 – találati esély + kockázat-sáv (szín + szöveg) + egymondatos magyarázat. */
const RiskMeter = ({ probability, level }: IRiskMeterProps) => (
	<div>
		<div className="flex justify-between text-small">
			<span className="oe-muted">Találati esély</span>
			<strong>{formatPercent(probability)}</strong>
		</div>
		<div className="oe-risk__track" aria-hidden="true">
			<div className="oe-risk__fill" data-level={level} style={{ '--p': barWidth(probability) } as CSSProperties} />
		</div>
		<div className="oe-muted text-caption" style={noteStyle}>
			{riskText(probability, level)}
		</div>
	</div>
);

export default RiskMeter;
