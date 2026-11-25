import React, { Component } from 'react';
import { ownBetsChip, ownBetsRows } from '@football/core';
import type { PlacedBetsResponse } from '@football/contract';
import { v } from '../../design/tokens/tokens';
import EmptyState from '../../components/PageIntro/EmptyState';
import { loadErrorText } from '../../components/PageIntro/RemoteData';
import { card, dangerBox } from '../../components/ui/oeClasses';
import { readApi } from '../../services/readApi';
import { vars } from './CalibrationChart';

const OWN_GRID = vars({ '--cols': 'minmax(0, 1.6fr) repeat(4, minmax(0, 1fr))', '--min': v('size.main-basis') });

type OwnState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: PlacedBetsResponse };

/**
 * „Saját fogadások” blokk (ROADMAP 5.6, I23b): a rögzített (szingli) szelvények saját ROI-ja a modell ROI-ja mellett
 * (`GET /api/bets`). Kombinált szelvény nem kerül ide (DECISIONS I23b).
 * TODO(polish): fogadáslista (függő/elszámolt), szűrés időszakra, CLV a saját tippeken.
 */
class OwnBets extends Component<{}, OwnState> {
	state: OwnState = { status: 'loading' };
	private alive = false;

	componentDidMount() {
		this.alive = true;
		this.load();
	}

	componentWillUnmount() {
		this.alive = false;
	}

	load = () => {
		this.setState({ status: 'loading' });
		readApi.listPlacedBets().then(
			(data) => this.alive && this.setState({ status: 'ready', data }),
			(e) => this.alive && this.setState({ status: 'error', message: loadErrorText(e) })
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
						<button type="button" className="oe-btn oe-btn--neutral" onClick={this.load}>
							Újra
						</button>
					</div>
				</div>
			);
		if (!s.data.summary.own.n)
			return (
				<EmptyState
					title="Még nincs rögzített fogadás"
					text="Az egylábú szelvény a „Megtettem – szelvény mentése” gombbal kerül ide; a kombinált szelvény csak helyben marad."
				/>
			);
		return (
			<div className="oe-table" style={OWN_GRID}>
				<div className="oe-table__inner">
					<div className="oe-table__row oe-table__row--head">
						<span>Kinek a hozama</span>
						<span className="oe-table__num">Tipp</span>
						<span className="oe-table__num">Találat</span>
						<span className="oe-table__num">ROI</span>
						<span className="oe-table__num">Profit</span>
					</div>
					{ownBetsRows(s.data.summary).map((r) => (
						<div key={r.key} className="oe-table__row">
							{r.key === 'own' ? <strong>{r.label}</strong> : <span>{r.label}</span>}
							<span className="oe-table__num">{r.bets}</span>
							<span className="oe-table__num">{r.hitRate}</span>
							<span
								className="oe-delta"
								data-tone={r.roiTone === 'positive' ? 'good' : r.roiTone === 'negative' ? 'bad' : undefined}
							>
								{r.roi}
							</span>
							<span className="oe-table__num">{r.profit}</span>
						</div>
					))}
				</div>
			</div>
		);
	}

	render() {
		const s = this.state;
		return (
			<section aria-labelledby="h-own" className="oe-stack">
				<div className="oe-section-head">
					<h2 className="oe-h2" id="h-own">
						Saját fogadások
					</h2>
					<span className="oe-section-sub">
						{s.status === 'ready' && s.data.summary.own.n
							? ownBetsChip(s.data.summary)
							: 'a ténylegesen megtett tippek hozama a modell mellett'}
					</span>
				</div>
				{this.renderBody()}
			</section>
		);
	}
}

export default OwnBets;
