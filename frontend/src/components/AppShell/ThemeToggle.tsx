import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { ThemeStore } from '../../stores/ThemeStore';

interface IThemeToggleProps {
	store: ThemeStore;
}

/**
 * DESIGN §3.1 – fejléc-váltó (`.oe-theme-toggle`). Mindkét ikon a DOM-ban van; a `components.css` sötétben a napot,
 * világosban a holdat mutatja (`:root[data-theme]` alapján).
 */
@observer
class ThemeToggle extends Component<IThemeToggleProps> {
	toggle = () => this.props.store.toggle();

	render() {
		const next = this.props.store.effective === 'dark' ? 'világos' : 'sötét';
		return (
			<button className="oe-theme-toggle" type="button" aria-label={`Váltás ${next} témára`} onClick={this.toggle}>
				<svg
					className="oe-icon-sun"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				>
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
				</svg>
				<svg
					className="oe-icon-moon"
					width="18"
					height="18"
					viewBox="0 0 24 24"
					aria-hidden="true"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
				</svg>
			</button>
		);
	}
}

export default ThemeToggle;
