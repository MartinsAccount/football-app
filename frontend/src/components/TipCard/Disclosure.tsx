import React, { Component } from 'react';

interface IDisclosureProps {
	expanded: boolean;
	controlsId: string;
	onToggle: () => void;
	closedLabel?: string;
	openLabel?: string;
}

/** DESIGN §7.4/7: lenyitó gomb (`aria-expanded` + `aria-controls`). */
class Disclosure extends Component<IDisclosureProps> {
	render() {
		const { expanded, controlsId, onToggle } = this.props;
		const { closedLabel = 'Forma, egymás elleni, tabella', openLabel = 'Részletek elrejtése' } = this.props;
		return (
			<button className="oe-disclosure" type="button" aria-expanded={expanded} aria-controls={controlsId} onClick={onToggle}>
				<span>{expanded ? openLabel : closedLabel}</span>
				<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
					<path
						d="M3 5 L7 9 L11 5"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.8"
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				</svg>
			</button>
		);
	}
}

export default Disclosure;
