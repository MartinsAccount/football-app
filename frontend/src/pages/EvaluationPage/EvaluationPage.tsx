import React, { Component, CSSProperties } from 'react';
import { BacktestMarket, BacktestReport, formatDecimal, formatPercent } from '@football/core';
import PageIntro from '../../components/PageIntro/PageIntro';
import EmptyState from '../../components/PageIntro/EmptyState';
import { v } from '../../design/tokens/tokens';
import reportJson from '../../../../data/backtest/backtest-v0.json';
import CalibrationChart from './CalibrationChart';
import {
	betTiles,
	calibrationError,
	calibrationPoints,
	EVAL_MARKETS,
	scoreRows,
	segmentOptions,
	segmentRows,
	selectSegment,
	seasonLabel,
	Tone,
	verdict
} from './evaluationView';

interface IEvaluationPageState {
	market: BacktestMarket;
	segment: string;
}

const toneColor = (tone: Tone): string | undefined =>
	tone === 'positive' ? v('color.accent.text') : tone === 'negative' ? v('color.signal.negative-text') : undefined;

const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: v('space.7'), marginTop: v('space.14') };
const filterStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: v('space.6'), alignItems: 'flex-end' };
const tilesStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} * 3 / 4)), 1fr))`,
	gap: v('space.6')
};
const panelStyle: CSSProperties = {
	background: v('color.bg.surface'),
	border: `1px solid ${v('color.border.default')}`,
	borderRadius: v('radius.2xl'),
	padding: v('space.9')
};
// A táblázat a saját dobozában görgethető, az oldal nem (DESIGN §6).
const tableWrapStyle: CSSProperties = { overflowX: 'auto', maxWidth: '100%' };
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: v('font.size.small') };
const thStyle: CSSProperties = {
	textAlign: 'right',
	padding: `${v('space.4')} ${v('space.5')}`,
	color: v('color.text.muted'),
	fontWeight: v('font.weight.semibold'),
	whiteSpace: 'nowrap',
	borderBottom: `1px solid ${v('color.border.default')}`
};
const thFirst: CSSProperties = { ...thStyle, textAlign: 'left' };
const tdStyle: CSSProperties = {
	textAlign: 'right',
	padding: `${v('space.4')} ${v('space.5')}`,
	fontVariantNumeric: 'tabular-nums',
	whiteSpace: 'nowrap',
	borderBottom: `1px solid ${v('color.border.default')}`
};
const tdFirst: CSSProperties = { ...tdStyle, textAlign: 'left', fontVariantNumeric: 'normal' };
const calibGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${v('size.aside-basis')}), 1fr))`,
	gap: v('space.10'),
	alignItems: 'start'
};
const rowButtonStyle: CSSProperties = {
	minHeight: v('size.touch'),
	padding: 0,
	border: 0,
	background: 'transparent',
	color: 'inherit',
	font: 'inherit',
	cursor: 'pointer',
	textAlign: 'left'
};
const listStyle: CSSProperties = {
	margin: 0,
	paddingLeft: v('space.9'),
	fontSize: v('font.size.small'),
	lineHeight: v('font.line-height.body')
};

/**
 * `/evaluation` – Kiértékelés (PRD 5.8, ROADMAP S21) a walk-forward backtest riportjából (`data/backtest/backtest-v0.json`,
 * `npm run backtest -w @football/db`; 0 külső hívás). Szűrők: piac (1X2 / Gól 2,5) és szegmens (szezon / liga).
 * TODO(polish): élő predikció-napló (DB `prediction`) a backtest mellett; időbeli ROI-görbe; piaci kalibráció-görbe.
 */
class EvaluationPage extends Component<{}, IEvaluationPageState> {
	report = reportJson as unknown as BacktestReport;
	options = segmentOptions(this.report);
	state: IEvaluationPageState = { market: 'h2h', segment: 'all' };

	render() {
		const { report, options } = this;
		if (!report.matches) {
			return (
				<>
					<PageIntro date={null} title="Kiértékelés." subtitle="Mennyire jók a tippjeink?" />
					<EmptyState
						title="Még nincs kiértékelt tipp"
						text="A backtest lefutása után itt látod a találati arányt, a hozamot, a Brier-pontszámot, a kalibrációt és a CLV-t."
					/>
				</>
			);
		}
		const { market, segment } = this.state;
		const cmp = selectSegment(report, segment)[market];
		const marketLabel = EVAL_MARKETS.find((m) => m.key === market)!.label;
		const calib = report.calibration[market];
		const points = calibrationPoints(calib);
		const calibErr = formatDecimal(calibrationError(calib), 1);
		const seasons = report.evalSeasons.map(seasonLabel).join(', ');
		const groups = ['Összes', 'Szezon', 'Liga'] as const;

		return (
			<>
				<PageIntro
					date={null}
					title="Kiértékelés."
					subtitle={`Backtest ${report.modelVersion} · ${seasons} · ${report.matches} meccs · value-küszöb EV ≥ ${formatPercent(
						report.evThreshold
					)}`}
				/>

				<div style={filterStyle}>
					<div className="oe-segmented" role="group" aria-label="Piac">
						{EVAL_MARKETS.map((m) => (
							<button
								key={m.key}
								type="button"
								className="oe-segmented__btn"
								aria-pressed={m.key === market}
								onClick={() => this.setState({ market: m.key })}
							>
								{m.label}
								<small>{m.hint}</small>
							</button>
						))}
					</div>
					<label className="oe-field" style={{ minWidth: `min(100%, ${v('size.aside-basis')})` }}>
						Szegmens
						<select
							className="oe-select w-full min-w-0"
							value={segment}
							onChange={(e) => this.setState({ segment: e.target.value })}
						>
							{groups.map((g) => (
								<optgroup key={g} label={g}>
									{options
										.filter((o) => o.group === g)
										.map((o) => (
											<option key={o.key} value={o.key}>
												{o.label}
											</option>
										))}
								</optgroup>
							))}
						</select>
					</label>
				</div>

				<section style={sectionStyle} aria-labelledby="eval-bets">
					<h2 className="oe-h2" id="eval-bets">
						Value tippek · {marketLabel}
					</h2>
					<div style={tilesStyle}>
						{betTiles(cmp.bets).map((t) => (
							<div key={t.label} className="oe-tile">
								<div className="oe-tile__label">{t.label}</div>
								<div className="oe-tile__value" style={{ color: toneColor(t.tone) }}>
									{t.value}
								</div>
								<div className="oe-tile__foot">{t.foot}</div>
							</div>
						))}
					</div>
				</section>

				<section style={sectionStyle} aria-labelledby="eval-scores">
					<h2 className="oe-h2" id="eval-scores">
						Pontosság: modell vs. piac
					</h2>
					<p className="oe-muted m-0">{verdict(cmp)}</p>
					<div style={{ ...panelStyle, ...tableWrapStyle }}>
						<table style={tableStyle}>
							<thead>
								<tr>
									<th style={thFirst} scope="col">
										Forrás
									</th>
									<th style={thStyle} scope="col">
										Meccs
									</th>
									<th style={thStyle} scope="col">
										Brier
									</th>
									<th style={thStyle} scope="col">
										Log-loss
									</th>
									<th style={thStyle} scope="col">
										vs. záró
									</th>
								</tr>
							</thead>
							<tbody>
								{scoreRows(cmp).map((r) => (
									<tr key={r.label}>
										<th style={{ ...tdFirst, fontWeight: r.best ? v('font.weight.bold') : v('font.weight.regular') }} scope="row">
											{r.label}
											{r.best ? ' · legjobb' : ''}
										</th>
										<td style={tdStyle}>{r.n}</td>
										<td style={tdStyle}>{r.brier}</td>
										<td style={tdStyle}>{r.logLoss}</td>
										<td style={{ ...tdStyle, color: toneColor(r.tone) }}>{r.vsClosing}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<p className="oe-muted text-small m-0">
						Kisebb Brier és log-loss = pontosabb. Csak a nyitó és záró oddsszal is rendelkező meccsek.
					</p>
				</section>

				<section style={sectionStyle} aria-labelledby="eval-calib">
					<h2 className="oe-h2" id="eval-calib">
						Kalibráció · {marketLabel}
					</h2>
					<div style={{ ...panelStyle, ...calibGridStyle }}>
						<CalibrationChart points={points} label={`Kalibrációs diagram, ${marketLabel}: átlagos eltérés ${calibErr} pp`} />
						<div>
							<p className="m-0">
								Átlagos eltérés a becsült és a tényleges arány között: <strong>{calibErr} pp</strong>. A szaggatott átló a
								tökéletes kalibráció; a pont mérete a mintaméret.
							</p>
							<ul style={listStyle} className="oe-muted">
								{points.map((p) => (
									<li key={p.x}>{p.label}</li>
								))}
							</ul>
						</div>
					</div>
					<p className="oe-muted text-small m-0">A kalibráció a teljes backtestre vonatkozik (a szegmens-szűrő nem hat rá).</p>
				</section>

				<section style={{ ...sectionStyle, marginBottom: v('space.14') }} aria-labelledby="eval-segments">
					<h2 className="oe-h2" id="eval-segments">
						Bontás szezon és liga szerint · {marketLabel}
					</h2>
					<div style={{ ...panelStyle, ...tableWrapStyle }}>
						<table style={tableStyle}>
							<thead>
								<tr>
									<th style={thFirst} scope="col">
										Szegmens
									</th>
									<th style={thStyle} scope="col">
										Tipp
									</th>
									<th style={thStyle} scope="col">
										Találat
									</th>
									<th style={thStyle} scope="col">
										ROI
									</th>
									<th style={thStyle} scope="col">
										CLV
									</th>
									<th style={thStyle} scope="col">
										LL vs. záró
									</th>
								</tr>
							</thead>
							<tbody>
								{segmentRows(report, market).map((r) => (
									<tr key={r.key}>
										<th
											style={{ ...tdFirst, fontWeight: r.key === segment ? v('font.weight.bold') : v('font.weight.regular') }}
											scope="row"
										>
											<button
												type="button"
												style={rowButtonStyle}
												aria-pressed={r.key === segment}
												onClick={() => this.setState({ segment: r.key })}
											>
												{r.label}
											</button>
										</th>
										<td style={tdStyle}>{r.bets}</td>
										<td style={tdStyle}>{r.hitRate}</td>
										<td style={{ ...tdStyle, color: toneColor(r.roiTone) }}>{r.roi}</td>
										<td style={{ ...tdStyle, color: toneColor(r.clvTone) }}>{r.clv}</td>
										<td style={{ ...tdStyle, color: toneColor(r.vsClosingTone) }}>{r.vsClosing}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			</>
		);
	}
}

export default EvaluationPage;
