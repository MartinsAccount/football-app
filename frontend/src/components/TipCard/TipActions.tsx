import React, { Component } from 'react';
import { formatEv, formatOdds } from '@football/core';
import { slipToggleText } from './tipView';

interface ITipActionsProps {
	odds: number;
	minOdds: number;
	ev: number;
	selected: boolean;
	/** Ha meg van adva, a toggle tiltott, és ez a magyarázat (pl. ugyanarról a meccsről már van tipp). */
	blockedReason?: string;
	onToggleSlip: () => void;
}

/** DESIGN §7.4/5: odds · Tippmix min. · EV + SlipToggle (`aria-pressed`). */
class TipActions extends Component<ITipActionsProps> {
	render() {
		const { odds, minOdds, ev, selected, blockedReason, onToggleSlip } = this.props;
		const blocked = !selected && !!blockedReason;
		return (
			<div className="oe-card__actions">
				<div>
					<div className="oe-stat__label">odds</div>
					<div className="oe-stat__value">{formatOdds(odds)}</div>
				</div>
				<div>
					<div className="oe-stat__label">Tippmix min.</div>
					<div className="oe-stat__value">{formatOdds(minOdds)}</div>
				</div>
				<div>
					<div className="oe-stat__label">EV</div>
					<div className="oe-stat__value oe-stat__value--ev">{formatEv(ev)}</div>
				</div>
				<button
					className="oe-btn oe-btn--toggle"
					type="button"
					aria-pressed={selected}
					disabled={blocked}
					title={blocked ? blockedReason : undefined}
					onClick={onToggleSlip}
				>
					{slipToggleText(selected)}
				</button>
			</div>
		);
	}
}

export default TipActions;
