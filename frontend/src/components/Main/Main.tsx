import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { BrowserRouter as Router, Switch, Route, NavLink, Redirect } from 'react-router-dom';
import { MainStore } from '../../stores/MainStore';
import OddsPage from '../../pages/OddsPage/OddsPage';
import FixturePage from '../../pages/FixturePage/FixturePage';
import ArbitragePage from '../../pages/ArbitragePage/ArbitragePage';
import LoadingScreen from '../LoadingScreen/LoadingScreen';
import Pill from '../ui/Pill';

interface IMainProps {
	MainStore?: MainStore;
}

// Az aktív állapotot az aria-current variánssal stílusozzuk: a NavLink (RRv5)
// az aktív linkre aria-current="page"-et tesz, és az aria-[current=page]:* utility
// magasabb specificitású, ezért megbízhatóan felülírja az inaktív (text-text-muted /
// border-transparent) alapot — szemben az activeClassName-mel, ahol ütköző utility-knél
// a CSS-sorrend dönt, nem a class-string.
const tab =
	'inline-flex items-center h-14 border-b-2 border-transparent text-sm no-underline transition-colors ' +
	'text-text-muted hover:text-text ' +
	'aria-[current=page]:text-accent aria-[current=page]:border-accent aria-[current=page]:font-medium';

@inject('MainStore')
@observer
class Main extends Component<IMainProps> {
	render() {
		const { MainStore } = this.props;

		return (
			<Router>
				<div className="min-h-screen bg-bg text-text">
					{MainStore.isLoading && <LoadingScreen />}

					<nav className="sticky top-0 z-50 flex items-center gap-8 h-14 px-6 bg-surface border-b border-border-subtle">
						<div className="flex items-center gap-2">
							<span className="h-7 w-7 rounded-md bg-brand" />
							<span className="font-semibold text-text">Odds elemző</span>
						</div>

						<div className="flex items-center gap-6">
							<NavLink className={tab} to="/odds">
								Odds műveletek
							</NavLink>
							<NavLink className={tab} to="/fixtures">
								Meccs statisztikák
							</NavLink>
							<NavLink className={tab} to="/arbitrage">
								Arbitrage
							</NavLink>
						</div>

						<div className="ml-auto">
							<Pill>Fetch #{MainStore.fetchNumber}</Pill>
						</div>
					</nav>

					<Switch>
						<Route path="/odds">
							<OddsPage />
						</Route>
						<Route path="/fixtures">
							<FixturePage />
						</Route>
						<Route path="/arbitrage">
							<ArbitragePage />
						</Route>
						<Redirect exact from="/" to="/odds" />
					</Switch>
				</div>
			</Router>
		);
	}
}

export default Main;
