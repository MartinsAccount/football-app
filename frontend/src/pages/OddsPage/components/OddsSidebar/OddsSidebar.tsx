import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { SIDEBAR_LEAGUES } from '../../constants/leagueMeta';

interface IOddsSidebarProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class OddsSidebar extends Component<IOddsSidebarProps> {
	render() {
		const { OddsStore } = this.props.MainStore;

		return (
			<aside className="w-64 shrink-0 bg-sidebar border-r border-border-subtle flex flex-col">
				<div className="px-4 pt-5 pb-2 text-xs uppercase tracking-wide text-text-faint">Ligák</div>

				<nav className="flex flex-col gap-1 px-2">
					{SIDEBAR_LEAGUES.map(({ key, label }) => {
						const active = OddsStore.currentLeague === key;

						return (
							<button
								key={key}
								type="button"
								onClick={() => OddsStore.changeLeague(key)}
								className={`appearance-none border-0 cursor-pointer w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
									active
										? 'bg-surface-2 text-accent font-medium'
										: 'bg-transparent text-text-muted hover:bg-surface-2 hover:text-text'
								}`}
							>
								{label}
							</button>
						);
					})}
				</nav>

				<div className="mt-auto p-4">
					<button
						type="button"
						onClick={() => OddsStore.saveOdds('all')}
						className="appearance-none border-0 cursor-pointer w-full bg-accent text-bg font-semibold rounded-lg px-4 py-3 text-sm transition-opacity hover:opacity-90"
					>
						Összes odds mentése
					</button>
				</div>
			</aside>
		);
	}
}

export default OddsSidebar;
