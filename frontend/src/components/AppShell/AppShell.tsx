import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../stores/MainStore';
import LoadingScreen from '../LoadingScreen/LoadingScreen';
import AppHeader from './AppHeader';
import OfflineIndicator from './OfflineIndicator';

interface IAppShellProps {
	MainStore?: MainStore;
}

/** DESIGN §13: AppHeader + tartalom egy közös konténerben (max. 1280, gutter 28/18). */
@inject('MainStore')
@observer
class AppShell extends Component<IAppShellProps> {
	render() {
		const { MainStore, children } = this.props;

		return (
			<div className="oe-container">
				{MainStore.isLoading && <LoadingScreen />}
				<AppHeader />
				<OfflineIndicator />
				<main>{children}</main>
			</div>
		);
	}
}

export default AppShell;
