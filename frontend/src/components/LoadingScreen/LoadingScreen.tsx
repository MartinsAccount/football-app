import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../stores/MainStore';

interface ILoadingScreenProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class LoadingScreen extends Component<ILoadingScreenProps> {
	render() {
		const { MainStore } = this.props;

		return (
			<>
				<div className="fixed inset-0 z-[998] bg-black/70" />
				<div className="fixed left-1/2 top-1/2 z-[999] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-6 rounded-xl border border-border-subtle bg-surface px-12 py-10 text-text">
					<span className="h-12 w-12 rounded-full border-4 border-border-subtle border-t-accent animate-spin" />
					<h2 className="text-lg font-semibold">{MainStore.loadingText}</h2>
				</div>
			</>
		);
	}
}

export default LoadingScreen;
