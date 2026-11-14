import { inject } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../stores/MainStore';
import OddsContent from './components/OddsContent/OddsContent';
import OddsSidebar from './components/OddsSidebar/OddsSidebar';

interface IOddsPageProps {
	MainStore?: MainStore;
}

@inject('MainStore')
class OddsPage extends Component<IOddsPageProps> {
	componentDidMount() {
		this.props.MainStore.OddsStore.Init();
	}

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
