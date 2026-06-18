import React, { Component } from 'react';
import OddsContent from './components/OddsContent/OddsContent';
import OddsSidebar from './components/OddsSidebar/OddsSidebar';

class OddsPage extends Component {
	render() {
		return (
			<main className="flex items-stretch min-h-[calc(100vh-3.5rem)]">
				<OddsSidebar />
				<OddsContent />
			</main>
		);
	}
}

export default OddsPage;
