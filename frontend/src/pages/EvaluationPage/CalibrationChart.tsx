import React, { CSSProperties } from 'react';
import { ICalibrationRow } from './evaluationView';

/** CSS egyedi tulajdonságok (`--x`, `--s` …) a React style-ban. */
const vars = (o: Record<string, string>): CSSProperties => o as CSSProperties;

const TICKS = [100, 75, 50, 25, 0];
const GRID = [25, 50, 75];

interface ICalibrationChartProps {
	rows: ICalibrationRow[];
	/** Szöveges összefoglaló a képernyőolvasónak (`role="img"`). */
	label: string;
}

/**
 * Kalibrációs grafikon (`.oe-chart`, DESIGN §6 „Kiértékelés”): x = becsült esély, y = tényleges arány; szaggatott átló =
 * tökéletes kalibráció. A pont átmérője `8 + √n / 4,5` px, `n < 30` → `data-low-n`. A színek a `components.css`-ből (téma).
 * TODO(polish): hover-tooltip a `title` helyett; piaci kalibrációs görbe.
 */
export const CalibrationChart = ({ rows, label }: ICalibrationChartProps) => (
	<div className="oe-chart">
		<div className="oe-chart__y" aria-hidden="true">
			{TICKS.map((t) => (
				<span key={t} style={{ top: `${100 - t}%` }}>
					{t}%
				</span>
			))}
		</div>
		<div className="oe-chart__plot" role="img" aria-label={label}>
			{GRID.map((g) => (
				<div key={g} className="oe-chart__grid" style={{ top: `${g}%` }} />
			))}
			<svg className="oe-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
				<line className="oe-chart__diag" x1="0" y1="100" x2="100" y2="0" vectorEffect="non-scaling-stroke" />
				<polyline
					className="oe-chart__line"
					points={rows.map((r) => `${r.x.toFixed(1)},${(100 - r.y).toFixed(1)}`).join(' ')}
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
			{rows.map((r) => (
				<span
					key={r.key}
					className="oe-chart__dot"
					data-low-n={r.lowN ? 'true' : undefined}
					style={vars({ '--x': `${r.x}%`, '--y': `${r.y}%`, '--s': `${r.size.toFixed(1)}px` })}
					title={r.title}
				/>
			))}
		</div>
		<div className="oe-chart__x" aria-hidden="true">
			{[...TICKS].reverse().map((t) => (
				<span key={t}>{t}%</span>
			))}
		</div>
	</div>
);

/** Kalibrációs táblázat (`.oe-calib-row`): sáv, becsült, tényleges, eltérés (`.oe-dev[data-flag|data-low-n]`), minta. */
export const CalibrationTable = ({ rows, summary }: { rows: ICalibrationRow[]; summary: string }) => (
	<div className="oe-calib__table">
		<div className="oe-calib-row oe-calib-row--head">
			<span>Sáv</span>
			<span>Becsült</span>
			<span>Tényl.</span>
			<span>Eltérés</span>
			<span>Minta</span>
		</div>
		{rows.map((r) => (
			<div key={r.key} className="oe-calib-row">
				<span className="oe-muted">{r.band}</span>
				<span>{r.estimated}</span>
				<strong>{r.actual}</strong>
				<span className="oe-dev" data-flag={r.flag ? 'true' : undefined} data-low-n={r.lowN ? 'true' : undefined}>
					{r.deviation}
				</span>
				<span className="oe-muted">{r.sample}</span>
			</div>
		))}
		<p className="oe-summary">{summary}</p>
	</div>
);

export { vars };
