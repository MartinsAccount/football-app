import React, { Component } from 'react';
import { BacktestMarket, BacktestReport, calibrationError, evaluationVerdict, formatDecimal } from '@football/core';
import PageHead from '../../components/PageIntro/PageHead';
import EmptyState from '../../components/PageIntro/EmptyState';
import RemoteData from '../../components/PageIntro/RemoteData';
import { readApi } from '../../services/readApi';
import { CalibrationChart, CalibrationTable } from './CalibrationChart';
import { AccuracyTable, GoalsTable, KpiRow, SegmentTable, VerdictBar } from './EvaluationSections';
import {
	calibrationAria,
	calibrationRows,
	calibrationSummary,
	EVAL_MARKETS,
	evaluationHeadChips,
	goalRows,
	kpis,
	scoreRows,
	segmentOptions,
	segmentRows,
	selectSegment
} from './evaluationView';

interface IEvaluationPageState {
	market: BacktestMarket;
	segment: string;
}

/**
 * `/evaluation` – Kiértékelés (PRD 5.8, CHANGES 3.) a walk-forward backtest riportjából (olvasó API `/api/backtest`, SB5;
 * `npm run backtest -w @football/db`; 0 külső hívás). Sorrend (DESIGN §2 „Ítélet előbb”): fej → ítélet-sáv → sikermutatók →
 * KPI-k → pontosság → kalibráció → bontás. Az ítélet és a célok a core `evaluationVerdict`-ből.
 * TODO(polish): élő predikció-napló (DB `prediction`); időbeli ROI-görbe; szegmentált kalibráció (a backtest nem adja).
 */
class EvaluationView extends Component<{ report: BacktestReport }, IEvaluationPageState> {
	report = this.props.report;
	options = segmentOptions(this.report);
	state: IEvaluationPageState = { market: 'h2h', segment: 'all' };

	render() {
		const { report, options } = this;
		if (!report.matches) {
			return (
				<div className="oe-stack">
					<PageHead title="Kiértékelés" chips={['Mennyire jók a tippjeink?']} />
					<EmptyState
						title="Még nincs kiértékelt tipp"
						text="A backtest lefutása után itt látod a találati arányt, a hozamot, a Brier-pontszámot, a kalibrációt és a CLV-t."
					/>
				</div>
			);
		}
		const { market, segment } = this.state;
		const cmp = selectSegment(report, segment)[market];
		const marketLabel = EVAL_MARKETS.find((m) => m.key === market)!.label;
		const calib = report.calibration[market];
		// A kalibráció csak összesítve létezik (terv „Hiányzó adat” 4.), a célsor is ebből számol.
		const verdict = evaluationVerdict(cmp, calib);
		const calibErr = calibrationError(calib);
		const calibRows = calibrationRows(calib);
		const groups = ['Összes', 'Szezon', 'Liga'] as const;

		return (
			<div className="oe-stack">
				<PageHead
					title="Kiértékelés"
					chips={evaluationHeadChips(report)}
					filters={
						<>
							<div className="oe-segmented" role="group" aria-label="Piac">
								{EVAL_MARKETS.map((m) => (
									<button
										key={m.key}
										type="button"
										className="oe-segmented__btn"
										aria-pressed={m.key === market}
										title={m.hint}
										onClick={() => this.setState({ market: m.key })}
									>
										{m.label}
									</button>
								))}
							</div>
							<label className="oe-field">
								Szegmens
								<select
									className="oe-select max-w-full"
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
						</>
					}
				/>

				<VerdictBar verdict={verdict} />
				<GoalsTable rows={goalRows(verdict.goals, marketLabel)} met={verdict.met} total={verdict.total} />
				<KpiRow k={kpis(cmp.bets)} />
				<AccuracyTable rows={scoreRows(cmp)} />

				<section aria-labelledby="h-cal">
					<div className="oe-section-head">
						<h2 className="oe-h2" id="h-cal">
							Kalibráció · {marketLabel}
						</h2>
						<span className="oe-section-sub">
							átlagos eltérés <strong>{formatDecimal(calibErr, 1)} pp</strong> · cél &lt; 5 pp
						</span>
						{segment !== 'all' && <span className="oe-pill oe-pill--warning">összesített adat · minden szezon és liga</span>}
					</div>
					<div className="oe-calib">
						<div className="oe-calib__chart">
							<CalibrationChart rows={calibRows} label={calibrationAria(marketLabel, calib, calibErr)} />
							<div className="oe-legend">
								<span>vízszintes: becsült esély · függőleges: tényleges arány</span>
								<span>szaggatott: tökéletes kalibráció · pont mérete: mintaméret</span>
							</div>
						</div>
						<CalibrationTable rows={calibRows} summary={calibrationSummary(calib)} />
					</div>
				</section>

				<SegmentTable
					rows={segmentRows(report, market)}
					marketLabel={marketLabel}
					selected={segment}
					onSelect={(key) => this.setState({ segment: key })}
				/>
			</div>
		);
	}
}

const EvaluationPage = () => (
	<RemoteData title="Kiértékelés" load={readApi.getBacktest}>
		{(report) => <EvaluationView report={report} />}
	</RemoteData>
);

export default EvaluationPage;
