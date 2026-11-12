import React, { Component } from 'react';

interface IEmptyStateProps {
	title: string;
	text: string;
}

/** Üres állapot egy oldalon (ui-audit #4): mit fog itt látni, és miért nincs még semmi. */
class EmptyState extends Component<IEmptyStateProps> {
	render() {
		const { title, text } = this.props;
		return (
			<div className="oe-card" role="status">
				<h2 className="oe-h2">{title}</h2>
				<p className="oe-muted m-0">{text}</p>
			</div>
		);
	}
}

export default EmptyState;
