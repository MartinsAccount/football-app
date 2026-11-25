import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { SIDEBAR_LEAGUES } from '../../constants/leagueMeta';
import SidebarItem from '../../../../components/ui/SidebarItem';

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
					{SIDEBAR_LEAGUES.map(({ key, label }) => (
						<SidebarItem
							key={key}
							label={label}
							active={OddsStore.currentLeague === key}
							onClick={() => OddsStore.changeLeague(key)}
						/>
					))}
				</nav>
			</aside>
		);
	}
}

export default OddsSidebar;
