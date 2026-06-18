import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import SidebarItem from '../../../../components/ui/SidebarItem';
import { FIXTURE_LEAGUE_FULL, FIXTURE_SIDEBAR_LEAGUES } from '../../../OddsPage/constants/leagueMeta';

interface IFixtureSidebarProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class FixtureSidebar extends Component<IFixtureSidebarProps> {
	render() {
		const { FixtureStore } = this.props.MainStore;

		return (
			<aside className="w-64 shrink-0 bg-sidebar border-r border-border-subtle flex flex-col">
				<div className="px-4 pt-5 pb-2 text-xs uppercase tracking-wide text-text-faint">Ligák</div>

				<nav className="flex flex-col gap-1 px-2">
					{FIXTURE_SIDEBAR_LEAGUES.map(({ key, label }) => (
						<SidebarItem
							key={key}
							label={label}
							active={FixtureStore.currentLeague === FIXTURE_LEAGUE_FULL[key]}
							onClick={() => FixtureStore.leaguesStatistics(key)}
						/>
					))}
				</nav>
			</aside>
		);
	}
}

export default FixtureSidebar;
