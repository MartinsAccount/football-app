import React, { Component, CSSProperties } from 'react';
import { formatPercent } from '@football/core';
import { v } from '../../design/tokens/tokens';
import { ICalibrationPoint } from './evaluationView';

interface ICalibrationChartProps {
	points: ICalibrationPoint[];
	/** Szöveges összefoglaló a képernyőolvasónak. */
	label: string;
}

// Geometria a viewBox koordinátáiban (nem képernyő-px): a diagram a szélességhez skálázódik.
const SIZE = 300;
const PAD = 36;
const PLOT = SIZE - PAD - 12;
const TICKS = [0, 0.25, 0.5, 0.75, 1];

const sx = (p: number) => PAD + p * PLOT;
const sy = (p: number) => SIZE - PAD - p * PLOT;

const svgStyle: CSSProperties = { width: '100%', maxWidth: v('size.card-min'), height: 'auto', display: 'block' };
const tickStyle: CSSProperties = { fontSize: v('font.size.micro'), fill: v('color.text.muted') };

/**
 * Kalibrációs (reliability) diagram: x = becsült valószínűség, y = tényleges arány. Az átló a tökéletes kalibráció;
 * a pont mérete a vödör mintaméretével nő. TODO(polish): hover-tooltip, piaci összevetés-görbe.
 */
class CalibrationChart extends Component<ICalibrationChartProps> {
	render() {
		const { points, label } = this.props;
		const path = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
		return (
			<svg viewBox={`0 0 ${SIZE} ${SIZE}`} style={svgStyle} role="img" aria-label={label}>
				{TICKS.map((t) => (
					<g key={t}>
						<line x1={sx(0)} x2={sx(1)} y1={sy(t)} y2={sy(t)} style={{ stroke: v('color.border.default') }} />
						<text x={PAD - 6} y={sy(t) + 4} textAnchor="end" style={tickStyle}>
							{formatPercent(t)}
						</text>
						<text x={sx(t)} y={SIZE - PAD + 16} textAnchor="middle" style={tickStyle}>
							{formatPercent(t)}
						</text>
					</g>
				))}
				<line
					x1={sx(0)}
					y1={sy(0)}
					x2={sx(1)}
					y2={sy(1)}
					strokeDasharray="4 4"
					style={{ stroke: v('color.data.market'), strokeWidth: 1.5 }}
				/>
				<path d={path} fill="none" style={{ stroke: v('color.data.model'), strokeWidth: 2 }} />
				{points.map((p) => (
					<circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={3 + 5 * p.weight} style={{ fill: v('color.data.model') }}>
						<title>{p.label}</title>
					</circle>
				))}
			</svg>
		);
	}
}

export default CalibrationChart;
