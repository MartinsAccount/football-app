import React, { Component } from 'react';

interface IOfflineIndicatorState {
	online: boolean;
}

/** PWA (M1): kapcsolat nélkül jelzi, hogy a SW cache-éből (legutóbb betöltött adat) olvasunk. Tokenes `.oe-pill--warning`. */
class OfflineIndicator extends Component<{}, IOfflineIndicatorState> {
	state: IOfflineIndicatorState = { online: typeof navigator === 'undefined' ? true : navigator.onLine };

	private update = () => this.setState({ online: navigator.onLine });

	componentDidMount() {
		window.addEventListener('online', this.update);
		window.addEventListener('offline', this.update);
	}

	componentWillUnmount() {
		window.removeEventListener('online', this.update);
		window.removeEventListener('offline', this.update);
	}

	render() {
		if (this.state.online) return null;
		return (
			<div className="oe-offline" role="status" aria-live="polite">
				<span className="oe-pill oe-pill--warning">Nincs kapcsolat · a legutóbb betöltött adatot látod</span>
			</div>
		);
	}
}

export default OfflineIndicator;
