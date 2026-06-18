import React, { Component } from 'react';
import FixtureSidebar from './components/FixtureSidebar/FixtureSidebar';
import FixtureContent from './components/FixtureContent/FixtureContent';

class FixturePage extends Component {
	render() {
		return (
			<main className="flex items-stretch min-h-[calc(100vh-3.5rem)]">
				<FixtureSidebar />
				<FixtureContent />
			</main>
		);
	}
}

export default FixturePage;
