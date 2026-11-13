import React, { Component } from 'react';
import ArbitrageSidebar from './components/ArbitrageSidebar/ArbitrageSidebar';
import ArbitrageContent from './components/ArbitrageContent/ArbitrageContent';

class LegacyArbitragePage extends Component {
	render() {
		return (
			<main className="flex items-stretch min-h-[calc(100vh-3.5rem)]">
				<ArbitrageSidebar />
				<ArbitrageContent />
			</main>
		);
	}
}

export default LegacyArbitragePage;
