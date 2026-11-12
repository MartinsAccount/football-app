import React, { Component, CSSProperties, ReactNode } from 'react';
import { formatKickoff, formatPairing, NBSP } from '@football/core';
import Disclosure from './Disclosure';
import ProbabilityBars from './ProbabilityBars';
import TeamForm from './TeamForm';
import TipActions from './TipActions';
import { confidenceText, ITip } from './tipView';
import { v } from '../../design/tokens/tokens';

const detailsStyle: CSSProperties = { gap: v('space.8') };
const reasonsStyle: CSSProperties = { paddingLeft: v('space.10') };

interface ITipCardProps {
	tip: ITip;
	selected: boolean;
	expanded: boolean;
	/** Tiltott „+ Szelvényre” magyarázata (egy meccs = egy tipp, DESIGN §9). */
	blockedReason?: string;
	onToggleSlip: (tip: ITip) => void;
	onToggleExpand: (tip: ITip) => void;
	/** „Most” a relatív időpontokhoz (teszt / fixture-mód). */
	now?: Date;
	/** Lenyitott tartalom (S17: MatchDetails). */
	children?: ReactNode;
}

/** DESIGN §7.4 – a fő egység: meta, cím, forma, valószínűségek, akciók, forrás, figyelmeztetések, lenyitó. */
class TipCard extends Component<ITipCardProps> {
	toggleSlip = () => this.props.onToggleSlip(this.props.tip);
	toggleExpand = () => this.props.onToggleExpand(this.props.tip);

	render() {
		const { tip, selected, expanded, blockedReason, now, children } = this.props;
		const detailsId = `tip-details-${tip.id}`;
		return (
			<article className="oe-card min-w-0" data-selected={selected} data-expanded={expanded}>
				<div className="oe-card__meta">
					<span className="truncate">
						{tip.league} · {formatKickoff(tip.kickoff, now)}
					</span>
					<span className="shrink-0">{confidenceText(tip.confidence)}</span>
				</div>
				<div className="min-w-0">
					<h3 className="oe-card__title truncate">{formatPairing(tip.home.name, tip.away.name)}</h3>
					<div className="oe-card__market">{tip.tippmixLabel}</div>
				</div>
				<TeamForm home={tip.home} away={tip.away} />
				<ProbabilityBars pModel={tip.pModel} pMarket={tip.pMarket} />
				<TipActions
					odds={tip.bestOdds}
					minOdds={tip.minOdds}
					ev={tip.ev}
					selected={selected}
					blockedReason={blockedReason}
					onToggleSlip={this.toggleSlip}
				/>
				<div className="oe-muted text-caption">
					{tip.bookmaker} · {formatKickoff(tip.oddsAt, now)}
					{tip.stakeUnits !== undefined && ` · tét ${tip.stakeUnits}${NBSP}egység`} · {tip.modelVersion}
				</div>
				{tip.warnings.map((w) => (
					<div key={w} className="oe-warning">
						⚠ {w}
					</div>
				))}
				<Disclosure expanded={expanded} controlsId={detailsId} onToggle={this.toggleExpand} />
				{expanded && (
					<div id={detailsId} className="flex flex-col" style={detailsStyle}>
						{tip.reasons?.length > 0 && (
							<div>
								<div className="oe-label">Miért?</div>
								<ul className="oe-muted text-small list-disc" style={reasonsStyle}>
									{tip.reasons.map((r) => (
										<li key={r}>{r}</li>
									))}
								</ul>
							</div>
						)}
						{children}
					</div>
				)}
			</article>
		);
	}
}

export default TipCard;
