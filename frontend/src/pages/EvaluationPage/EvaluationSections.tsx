import React from 'react';
import { Verdict as VerdictModel } from '@football/core';
import { v } from '../../design/tokens/tokens';
import { vars } from './CalibrationChart';
import { IGoalRow, IKpis, IScoreRow, ISegmentRow, Tone } from './evaluationView';

/** A Kiértékelés oldal szekciói a `reference/kiertekeles.html` markupja szerint (DESIGN §6 „Kiértékelés”). */

// Táblázat-rácsok: a sor-oszlopok aránya a referenciából; a `--min` alatt a tábla a saját dobozában görget (390 px).
const GOALS_GRID = vars({
	'--cols': 'minmax(0, 1.4fr) repeat(3, minmax(0, 1fr))',
	'--min': v('size.main-basis')
});
const ACC_GRID = vars({ '--cols': 'minmax(0, 1.4fr) repeat(4, minmax(0, 1fr))', '--min': v('size.main-basis') });
const SEG_GRID = vars({ '--cols': 'minmax(0, 1.4fr) repeat(5, minmax(0, 1fr))', '--min': v('size.main-basis') });

const VERDICT_ICON: Record<VerdictModel['tone'], string> = {
	negative: 'M3 7 L10 14 L14 10 L21 17 M15 17 H21 V11',
	positive: 'M3 17 L10 10 L14 14 L21 7 M15 7 H21 V13',
	neutral: 'M4 12 H20'
};

export const VerdictBar = ({ verdict }: { verdict: VerdictModel }) => (
	<section className="oe-verdict" data-tone={verdict.tone} aria-labelledby="h-verdict">
		<span className="oe-verdict__icon">
			<svg
				width="20"
				height="20"
				viewBox="0 0 24 24"
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				strokeWidth="2.2"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d={VERDICT_ICON[verdict.tone]} />
			</svg>
		</span>
		<div>
			<h2 className="oe-h2" id="h-verdict">
				{verdict.title}
			</h2>
			<p className="oe-verdict__text">{verdict.text}</p>
		</div>
	</section>
);

const PILL_CLASS: Record<IGoalRow['status'], string> = {
	ok: 'oe-goal-pill oe-goal-pill--ok',
	fail: 'oe-goal-pill oe-goal-pill--fail',
	info: 'oe-goal-pill'
};

export const GoalsTable = ({ rows, met, total }: { rows: IGoalRow[]; met: number; total: number }) => (
	<section aria-labelledby="h-goals">
		<div className="oe-section-head">
			<h2 className="oe-h2" id="h-goals">
				Sikermutatók
			</h2>
			<span className="oe-section-sub">
				a PRD céljaihoz mérve · {met} / {total} teljesül
			</span>
		</div>
		<div className="oe-table" style={GOALS_GRID}>
			<div className="oe-table__inner">
				<div className="oe-table__row oe-table__row--head">
					<span>Mutató</span>
					<span>Cél</span>
					<span>Most</span>
					<span>Állapot</span>
				</div>
				{rows.map((r) => (
					<div key={r.key} className="oe-table__row">
						<div>
							<strong>{r.label}</strong>
							<div className="oe-table__sub">{r.sub}</div>
						</div>
						<span className="oe-muted">{r.target}</span>
						<strong className="oe-num">{r.now}</strong>
						<span className={PILL_CLASS[r.status]}>{r.pillText}</span>
					</div>
				))}
			</div>
		</div>
	</section>
);

const kpiTone = (t: Tone) => (t === 'neutral' ? undefined : t);

export const KpiRow = ({ k }: { k: IKpis }) => (
	<section className="oe-kpis" aria-label="Value tippek">
		<div className="oe-kpi">
			<div className="oe-kpi__label">Value tippek</div>
			<div className="oe-kpi__value">{k.bets.value}</div>
			<div className="oe-compare" style={vars({ '--v': k.bets.fill })} aria-hidden="true">
				<div className="oe-compare__fill" />
			</div>
			<div className="oe-kpi__foot">
				<span>{k.bets.foot}</span>
			</div>
		</div>
		<div className="oe-kpi">
			<div className="oe-kpi__label">Találati arány</div>
			<div className="oe-kpi__value" data-tone={kpiTone(k.hit.tone)}>
				{k.hit.value}
				{k.hit.expected && <small>{k.hit.expected}</small>}
			</div>
			<div
				className="oe-compare"
				style={vars({ '--v': k.hit.fill, ...(k.hit.ref ? { '--ref': k.hit.ref } : {}) })}
				role="img"
				aria-label={k.hit.aria}
			>
				<div className="oe-compare__fill" data-tone={k.hit.tone === 'negative' ? 'negative' : undefined} />
				{k.hit.ref && <div className="oe-compare__ref" />}
			</div>
			<div className="oe-kpi__foot">
				<span>{k.hit.foot}</span>
			</div>
		</div>
		<div className="oe-kpi">
			<div className="oe-kpi__label">ROI · flat 1 egység</div>
			<div className="oe-kpi__value" data-tone={kpiTone(k.roi.tone)}>
				{k.roi.value}
			</div>
			{k.roi.ci && (
				<div
					className="oe-ci"
					style={vars({
						'--from': `${k.roi.ci.from.toFixed(1)}%`,
						'--to': `${k.roi.ci.to.toFixed(1)}%`,
						'--at': `${k.roi.ci.at.toFixed(1)}%`,
						'--zero': `${k.roi.ci.zero.toFixed(1)}%`
					})}
					role="img"
					aria-label={k.roi.aria}
				>
					{/* A vendor CSS a sávot negatív tónusra festi; pozitív ROI-nál tokenből felülírjuk. */}
					<div
						className="oe-ci__range"
						style={k.roi.tone === 'positive' ? { background: v('color.tint.positive-border') } : undefined}
					/>
					<div
						className="oe-ci__point"
						style={k.roi.tone === 'positive' ? { background: v('color.accent.default') } : undefined}
					/>
					<div className="oe-ci__zero" />
				</div>
			)}
			<div className="oe-kpi__foot">
				<span>{k.roi.foot}</span>
				{k.roi.ci && <span>0%</span>}
			</div>
		</div>
		<div className="oe-kpi">
			<div className="oe-kpi__label">Átlagos CLV</div>
			<div className="oe-kpi__value" data-tone={kpiTone(k.clv.tone)}>
				{k.clv.value}
			</div>
			<div className="oe-kpi__foot" style={{ marginTop: v('space.6') }}>
				<span>{k.clv.foot}</span>
			</div>
		</div>
	</section>
);

export const AccuracyTable = ({ rows }: { rows: IScoreRow[] }) => (
	<section aria-labelledby="h-acc">
		<div className="oe-section-head">
			<h2 className="oe-h2" id="h-acc">
				Pontosság: modell vs. piac
			</h2>
			<span className="oe-section-sub">kisebb = pontosabb · csak nyitó és záró oddsszal is rendelkező meccsek</span>
		</div>
		<div className="oe-table" style={ACC_GRID}>
			<div className="oe-table__inner">
				<div className="oe-table__row oe-table__row--head">
					<span>Forrás</span>
					<span className="oe-table__num">Meccs</span>
					<span className="oe-table__num">Brier</span>
					<span className="oe-table__num">Log-loss</span>
					<span className="oe-table__num">Log-loss vs. záró</span>
				</div>
				{rows.map((r) => (
					<div key={r.label} className={r.best ? 'oe-table__row oe-table__row--best' : 'oe-table__row'}>
						<strong className="flex items-center gap-sp-4">
							{r.label}
							{r.best && <span className="oe-tag">legjobb</span>}
						</strong>
						<span className="oe-table__num oe-muted">{r.n}</span>
						<span className="oe-table__num">{r.brier}</span>
						<span className="oe-table__num">{r.logLoss}</span>
						<span className="oe-delta" data-tone={r.tone}>
							{r.reference ? 'viszonyítási alap' : r.vsClosing}
						</span>
					</div>
				))}
			</div>
		</div>
	</section>
);

const toneText = (t: Tone): string | undefined =>
	t === 'positive' ? 'text-accent-text' : t === 'negative' ? 'text-negative-text' : undefined;

export const SegmentTable = ({
	rows,
	marketLabel,
	selected,
	onSelect
}: {
	rows: ISegmentRow[];
	marketLabel: string;
	selected: string;
	onSelect: (key: string) => void;
}) => (
	<section aria-labelledby="h-segments">
		<div className="oe-section-head">
			<h2 className="oe-h2" id="h-segments">
				Bontás szezon és liga szerint · {marketLabel}
			</h2>
			<span className="oe-section-sub">a sorra kattintva a fenti mutatók erre a szegmensre szűrnek</span>
		</div>
		<div className="oe-table" style={SEG_GRID}>
			<div className="oe-table__inner">
				<div className="oe-table__row oe-table__row--head">
					<span>Szegmens</span>
					<span className="oe-table__num">Tipp</span>
					<span className="oe-table__num">Találat</span>
					<span className="oe-table__num">ROI</span>
					<span className="oe-table__num">CLV</span>
					<span className="oe-table__num">LL vs. záró</span>
				</div>
				{rows.map((r) => (
					<div key={r.key} className={r.key === selected ? 'oe-table__row oe-table__row--best' : 'oe-table__row'}>
						<button
							type="button"
							className="oe-linkbtn min-h-touch justify-self-start text-left"
							aria-pressed={r.key === selected}
							onClick={() => onSelect(r.key)}
						>
							{r.label}
						</button>
						<span className="oe-table__num oe-muted">{r.bets}</span>
						<span className="oe-table__num">{r.hitRate}</span>
						<span className={`oe-table__num ${toneText(r.roiTone) ?? ''}`}>{r.roi}</span>
						<span className={`oe-table__num ${toneText(r.clvTone) ?? ''}`}>{r.clv}</span>
						<span className={`oe-table__num ${toneText(r.vsClosingTone) ?? ''}`}>{r.vsClosing}</span>
					</div>
				))}
			</div>
		</div>
	</section>
);
