import React from 'react';
import { formatKickoff, formatOdds, formatPairing } from '@football/core';
import { ITip } from '../TipCard/tipView';

interface ISlipLegsProps {
	tips: ITip[];
	/** A számításhoz használt odds lábanként (beírt Tippmix-odds vagy legjobb odds). */
	odds: number[];
	now?: Date;
	onRemove: (tipId: string) => void;
}

/** DESIGN §7.6/3 – lábak: párosítás, Tippmix-piac · időpont, odds + „min. X”, ✕. */
const SlipLegs = ({ tips, odds, now, onRemove }: ISlipLegsProps) => (
	<ol className="oe-slip__legs">
		{tips.map((tip, i) => (
			<li key={tip.id} className="oe-slip__leg">
				<div className="min-w-0">
					<strong className="block truncate text-small">{formatPairing(tip.home.name, tip.away.name)}</strong>
					<div className="oe-muted truncate text-caption">
						{tip.tippmixLabel} · {formatKickoff(tip.kickoff, now)}
					</div>
				</div>
				<div className="text-right">
					<div className="oe-stat__value">{formatOdds(odds[i])}</div>
					<div className="oe-stat__label">min. {formatOdds(tip.minOdds)}</div>
				</div>
				<button
					className="oe-btn oe-btn--icon"
					type="button"
					aria-label="Tipp levétele a szelvényről"
					onClick={() => onRemove(tip.id)}
				>
					✕
				</button>
			</li>
		))}
	</ol>
);

export default SlipLegs;
