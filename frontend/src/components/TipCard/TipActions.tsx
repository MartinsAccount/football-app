import React, { Component } from 'react';
import { formatEv, formatOdds } from '@football/core';
import { slipToggleText } from './tipView';
import { cx, statLabel, statValue, statValueEv } from '../ui/oeClasses';

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
			<div className="flex flex-wrap items-center gap-sp-8 [&>:last-child]:ml-auto">
				<div>
					<div className={statLabel}>odds</div>
					<div className={statValue}>{formatOdds(odds)}</div>
				</div>
				<div>
					<div className={statLabel}>Tippmix min.</div>
					<div className={statValue}>{formatOdds(minOdds)}</div>
				</div>
				<div>
					<div className={statLabel}>EV</div>
					<div className={cx(statValue, statValueEv)}>{formatEv(ev)}</div>
				</div>
				<button
					className="oe-btn oe-btn--add"
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
