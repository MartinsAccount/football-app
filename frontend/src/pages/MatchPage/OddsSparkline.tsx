import React from 'react';
import { sparkline } from '@football/core';
import { v } from '../../design/tokens/tokens';

const W = 100;
const H = 24;

/**
 * Odds-mozgás mini-grafikon (I20): a kimenet legjobb oddja pillanatképenként, magasabb odds feljebb. A geometria a core
 * `sparkline`-jából, a szín tokenből. TODO(polish): pontjelölők és hover-tooltip (pillanatkép-idő, iroda), közös y-skála a
 * piac kimenetei közt.
 */
const OddsSparkline = ({ odds, label }: { odds: readonly number[]; label: string }) => (
	<svg
		viewBox={`0 0 ${W} ${H}`}
		preserveAspectRatio="none"
		role="img"
		aria-label={label}
		style={{ width: '100%', height: v('size.chip'), overflow: 'visible' }}
	>
		<line x1="0" y1={H} x2={W} y2={H} stroke={v('color.data.track')} strokeWidth="1" vectorEffect="non-scaling-stroke" />
		<polyline
			points={sparkline(odds, W, H, 2).points}
			fill="none"
			stroke={v('color.data.model')}
			strokeWidth="2"
			strokeLinejoin="round"
			vectorEffect="non-scaling-stroke"
		/>
	</svg>
);

export default OddsSparkline;
