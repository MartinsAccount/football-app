import React, { Component } from 'react';
import { slipToggleText } from './tipView';
import Disclosure from './Disclosure';

interface ITipActionsProps {
	selected: boolean;
	/** Ha meg van adva, a toggle tiltott, és ez a magyarázat (pl. ugyanarról a meccsről már van tipp). */
	blockedReason?: string;
	onToggleSlip: () => void;
	expanded: boolean;
	detailsId: string;
	onToggleExpand: () => void;
}

/** DESIGN §6 Ma – tippkártya, 6.: két egyenrangú gomb – SlipToggle (`aria-pressed`) és a lenyitó. */
class TipActions extends Component<ITipActionsProps> {
	render() {
		const { selected, blockedReason, onToggleSlip, expanded, detailsId, onToggleExpand } = this.props;
		const blocked = !selected && !!blockedReason;
		return (
			<div className="oe-tip__actions">
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
				<Disclosure expanded={expanded} controlsId={detailsId} onToggle={onToggleExpand} />
			</div>
		);
	}
}

export default TipActions;
