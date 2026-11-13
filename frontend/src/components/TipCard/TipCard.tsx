import React, { Component, ReactNode } from 'react';
import { formatEv, formatKickoff, formatOdds, formatPairing, NBSP } from '@football/core';
import ProbabilityTile from './ProbabilityTile';
import TeamForm from './TeamForm';
import TipActions from './TipActions';
import { confidenceText, ITip, tipMarketParts } from './tipView';

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
	/** Lenyitott tartalom az indoklás után (MatchDetails: `.oe-details` rács). */
	children?: ReactNode;
}

/**
 * DESIGN §6 „Ma – tippkártya” (`reference/ma.html`): fej + nagy EV, döntési csempék, forma, figyelmeztetések, két gomb,
 * lenyitva indoklás + részletek + forrás. A „Miért?” csip-sor rejtve: a pillanatképben nincs strukturált pp-adat (DECISIONS.md).
 */
class TipCard extends Component<ITipCardProps> {
	toggleSlip = () => this.props.onToggleSlip(this.props.tip);
	toggleExpand = () => this.props.onToggleExpand(this.props.tip);

	render() {
		const { tip, selected, expanded, blockedReason, now, children } = this.props;
		const detailsId = `tip-details-${tip.id}`;
		const { market, badge } = tipMarketParts(tip.tippmixLabel, tip.outcome);
		const oddsAt = `${tip.bookmaker} · ${formatKickoff(tip.oddsAt, now)}`;
		return (
			<article className="oe-tip min-w-0" data-selected={selected}>
				<div className="oe-tip__head">
					<div className="min-w-0">
						<div className="oe-tip__meta">
							{tip.league} · {formatKickoff(tip.kickoff, now)} · {confidenceText(tip.confidence)}
						</div>
						<h3 className="oe-tip__title">{formatPairing(tip.home.name, tip.away.name)}</h3>
						<div className="oe-tip__market">
							{market} <span className="oe-badge">{badge}</span>
						</div>
					</div>
					<div className="oe-tip__ev">
						<div className="oe-tip__ev-label">várható érték</div>
						<div className="oe-tip__ev-value">{formatEv(tip.ev)}</div>
					</div>
				</div>
				<div className="oe-decision">
					<div className="oe-tile">
						<div className="oe-tile__label">Legjobb odds</div>
						<div className="oe-tile__value">{formatOdds(tip.bestOdds)}</div>
						<div className="oe-tile__foot">{oddsAt}</div>
					</div>
					<div className="oe-tile">
						<div className="oe-tile__label">Tippmixen legalább</div>
						<div className="oe-tile__value">{formatOdds(tip.minOdds)}</div>
						<div className="oe-tile__foot">ennél rosszabbra ne</div>
					</div>
					<ProbabilityTile pModel={tip.pModel} pMarket={tip.pMarket} />
				</div>
				<TeamForm home={tip.home} away={tip.away} />
				{tip.warnings.map((w) => (
					<div key={w} className="oe-warning">
						⚠ {w}
					</div>
				))}
				<TipActions
					selected={selected}
					blockedReason={blockedReason}
					onToggleSlip={this.toggleSlip}
					expanded={expanded}
					detailsId={detailsId}
					onToggleExpand={this.toggleExpand}
				/>
				<div className="oe-tip__details" id={detailsId} hidden={!expanded}>
					{tip.reasons && tip.reasons.length > 0 && (
						<div>
							<h4 className="oe-label">A modell indoklása</h4>
							<ul className="oe-reasons list-disc">
								{tip.reasons.map((r) => (
									<li key={r}>{r}</li>
								))}
							</ul>
						</div>
					)}
					{children}
					<div className="oe-tip__source">
						Forrás: {oddsAt}
						{tip.stakeUnits !== undefined && ` · tét ${tip.stakeUnits}${NBSP}egység`} · {tip.modelVersion}
					</div>
				</div>
			</article>
		);
	}
}

export default TipCard;
