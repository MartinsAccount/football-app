import React, { Component, CSSProperties } from 'react';
import type { DrawsResponse } from '@football/contract';
import { v } from '../../design/tokens/tokens';
import { DRAW_FACTOR_LEGEND, DRAW_NOTE, DRAW_REPORT_PATH, drawRows, drawSubtitle } from '@football/core';
import { readApi } from '../../services/readApi';

const DAY = 86_400_000;

const sectionStyle: CSSProperties = { marginTop: v('space.14') };
const listStyle: CSSProperties = { listStyle: 'none', margin: 0, padding: 0 };
const rowStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: 'minmax(0, 1fr) auto',
	gap: v('space.6'),
	padding: `${v('space.6')} 0`,
	borderTop: `1px solid ${v('color.border.default')}`
};
const titleStyle: CSSProperties = {
	marginTop: v('space.2'),
	fontSize: v('font.size.body'),
	fontWeight: v('font.weight.semibold'),
	color: v('color.text.primary')
};
const chipsStyle: CSSProperties = { marginTop: v('space.4') };
const probStyle: CSSProperties = {
	fontFamily: v('font.family.display'),
	fontSize: v('font.size.num-l'),
	fontWeight: v('font.weight.bold'),
	lineHeight: 1.1,
	color: v('color.text.primary')
};
const noteStyle: CSSProperties = { margin: `${v('space.6')} 0 0`, fontSize: v('font.size.caption'), overflowWrap: 'anywhere' };

interface IDrawWatchProps {
	/** Az ablak eleje (a Ma oldal pillanatképének `now`-ja); az ablak 2 nap (Ma + Holnap). */
	now: Date;
}

interface IDrawWatchState {
	res: DrawsResponse | null;
}

/**
 * „Döntetlen-esélyek” (D2, ROADMAP 12.7): a `GET /api/draws` p(X)-rangsora top 10-ig, a top 3 magyarázó tényező csipként (indok
 * tooltipben). Rangsor, nem értéktipp: a D1-backtestben a modell nem verte kimutathatóan a piacot. Kiegészítő blokk: hibánál
 * vagy üres ablaknál nem jelenik meg. TODO(polish): érintésre lenyíló tényező-indok (a `title` mobilon nem látszik).
 */
class DrawWatch extends Component<IDrawWatchProps, IDrawWatchState> {
	state: IDrawWatchState = { res: null };

	componentDidMount() {
		const from = this.props.now;
		readApi
			.getDraws({ from: from.toISOString(), to: new Date(from.getTime() + 2 * DAY).toISOString(), limit: 10 })
			.then((res) => this.setState({ res }))
			.catch(() => undefined);
	}

	render() {
		const { res } = this.state;
		if (!res || !res.items.length) return null;
		return (
			<section aria-labelledby="draws-heading" style={sectionStyle}>
				<div className="oe-section-head">
					<h2 className="oe-h2" id="draws-heading">
						Döntetlen-esélyek
					</h2>
					<span className="oe-section-sub">{drawSubtitle(res)}</span>
				</div>
				<ol style={listStyle}>
					{drawRows(res, this.props.now).map((r) => (
						<li key={r.id} style={rowStyle}>
							<div>
								<div className="oe-tip__meta">{r.meta}</div>
								<div style={titleStyle}>{r.title}</div>
								<div className="oe-chips" style={chipsStyle}>
									{r.factors.map((f) => (
										<span key={f.key} className="oe-pill" title={f.detail} aria-label={f.aria}>
											{f.label}
										</span>
									))}
								</div>
							</div>
							<div className="text-right">
								<div className="oe-tip__ev-label">p(X)</div>
								<div className="oe-num" style={probStyle}>
									{r.pDraw}
								</div>
								<div className="oe-tip__meta oe-num">{r.market}</div>
							</div>
						</li>
					))}
				</ol>
				<p className="oe-muted" style={noteStyle} title={DRAW_REPORT_PATH}>
					{DRAW_FACTOR_LEGEND} {DRAW_NOTE} A modell ({res.modelVersion}) a 2024/25-ös backtestben nem verte kimutathatóan a piaci
					rangsort; riport: <code>{DRAW_REPORT_PATH}</code>
				</p>
			</section>
		);
	}
}

export default DrawWatch;
