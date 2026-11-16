import React, { Component } from 'react';
import { EvaluationSummary } from '@football/core';
import { v } from '../../design/tokens/tokens';
import EmptyState from '../../components/PageIntro/EmptyState';
import { loadErrorText } from '../../components/PageIntro/RemoteData';
import { card, dangerBox } from '../../components/ui/oeClasses';
import { readApi } from '../../services/readApi';
import { vars } from './CalibrationChart';
import { KpiRow } from './EvaluationSections';
import { kpis } from './evaluationView';
import { ALL_MODELS, liveChips, liveMarketRows, modelOptions } from './liveEvaluationView';

const LIVE_GRID = vars({ '--cols': 'minmax(0, 1.4fr) repeat(5, minmax(0, 1fr))', '--min': v('size.main-basis') });

type LiveState =
	| { status: 'loading'; model: string }
	| { status: 'error'; model: string; message: string }
	| { status: 'ready'; model: string; data: EvaluationSummary };

/**
 * „Élő (DB)” blokk a Kiértékelés oldalon (ROADMAP 5.5, I17b): a kiértékelő job (I15) DB-ben tárolt eredményei
 * (`GET /api/evaluation?model=`), a backtest-pillanatkép MELLETT (DECISIONS I17). Modellverzió-választó a `modelVersions`-ből.
 * TODO(polish): kalibrációs grafikon és ítélet-sáv a DB-adatból is; időbeli ROI-görbe.
 */
class LiveEvaluation extends Component<{}, LiveState> {
	state: LiveState = { status: 'loading', model: ALL_MODELS };
	private alive = false;

	componentDidMount() {
		this.alive = true;
		this.load(ALL_MODELS);
	}

	componentWillUnmount() {
		this.alive = false;
	}

	load = (model: string) => {
		this.setState({ status: 'loading', model });
		readApi.getEvaluation(model || undefined).then(
			(data) => this.alive && this.setState({ status: 'ready', model, data }),
			(e) => this.alive && this.setState({ status: 'error', model, message: loadErrorText(e) })
		);
	};

	renderBody() {
		const s = this.state;
		if (s.status === 'loading')
			return (
				<div className={card} role="status" aria-busy="true">
					<p className="oe-muted m-0">Betöltés…</p>
				</div>
			);
		if (s.status === 'error')
			return (
				<div className={card} role="alert">
					<p className={`${dangerBox} m-0`}>{s.message}</p>
					<div>
						<button type="button" className="oe-btn oe-btn--neutral" onClick={() => this.load(s.model)}>
							Újra
						</button>
					</div>
				</div>
			);
		const d = s.data;
		if (!d.records)
			return (
				<EmptyState
					title="Még nincs élő kiértékelés"
					text="A lejátszott meccsek predikcióit a kiértékelő job pontozza; az első lefutás után itt látod a tippek találati arányát, a hozamot és a Brier-pontszámot piaconként."
				/>
			);
		return (
			<>
				<KpiRow k={kpis(d.bets)} />
				<div className="oe-table" style={LIVE_GRID}>
					<div className="oe-table__inner">
						<div className="oe-table__row oe-table__row--head">
							<span>Piac</span>
							<span className="oe-table__num">Csoport</span>
							<span className="oe-table__num">Brier</span>
							<span className="oe-table__num">Log-loss</span>
							<span className="oe-table__num">Tipp</span>
							<span className="oe-table__num">ROI</span>
						</div>
						{liveMarketRows(d).map((r) => (
							<div key={r.key} className="oe-table__row">
								{r.total ? <strong>{r.label}</strong> : <span>{r.label}</span>}
								<span className="oe-table__num oe-muted">{r.groups}</span>
								<span className="oe-table__num">{r.brier}</span>
								<span className="oe-table__num">{r.logLoss}</span>
								<span className="oe-table__num">{r.bets}</span>
								<span
									className="oe-delta"
									data-tone={r.roiTone === 'positive' ? 'good' : r.roiTone === 'negative' ? 'bad' : undefined}
								>
									{r.roi}
								</span>
							</div>
						))}
					</div>
				</div>
			</>
		);
	}

	render() {
		const s = this.state;
		const options = s.status === 'ready' ? modelOptions(s.data) : [{ value: s.model, label: s.model || 'Minden verzió' }];
		return (
			<section aria-labelledby="h-live" className="oe-stack">
				<div className="oe-section-head">
					<h2 className="oe-h2" id="h-live">
						Élő (DB)
					</h2>
					<span className="oe-section-sub">
						{s.status === 'ready' && s.data.records
							? liveChips(s.data).join(' · ')
							: 'a kiértékelő job eredményei a tárolt predikciókon'}
					</span>
					<label className="oe-field">
						Modellverzió
						<select
							className="oe-select max-w-full"
							value={s.model}
							disabled={s.status === 'loading'}
							onChange={(e) => this.load(e.target.value)}
						>
							{options.map((o) => (
								<option key={o.value} value={o.value}>
									{o.label}
								</option>
							))}
						</select>
					</label>
				</div>
				{this.renderBody()}
			</section>
		);
	}
}

export default LiveEvaluation;
