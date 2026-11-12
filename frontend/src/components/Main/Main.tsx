import React, { Component } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import AppShell from '../AppShell/AppShell';
import RecommendationsPage from '../../pages/RecommendationsPage/RecommendationsPage';
import EvaluationPage from '../../pages/EvaluationPage/EvaluationPage';
import SettingsPage from '../../pages/SettingsPage/SettingsPage';
import OddsPage from '../../pages/OddsPage/OddsPage';
import FixturePage from '../../pages/FixturePage/FixturePage';
import ArbitragePage from '../../pages/ArbitragePage/ArbitragePage';

// Route-ok a PRD 5.8 szerint. A régi /odds és /fixtures a Ma oldalra irányít (az odds-mozgás és a
// meccs-statisztika a TipCard MatchDetails részébe olvad, ROADMAP H); a régi nézetek addig a
// /legacy/* alatt elérhetők, navigációs link nélkül (DECISIONS 2026-11-12).
class Main extends Component {
	render() {
		return (
			<Router>
				<AppShell>
					<Switch>
						<Route exact path="/">
							<RecommendationsPage />
						</Route>
						<Route path="/evaluation">
							<EvaluationPage />
						</Route>
						<Route path="/settings">
							<SettingsPage />
						</Route>
						<Route path="/arbitrage">
							<ArbitragePage />
						</Route>
						<Route path="/legacy/odds">
							<OddsPage />
						</Route>
						<Route path="/legacy/fixtures">
							<FixturePage />
						</Route>
						<Redirect from="/odds" to="/" />
						<Redirect from="/fixtures" to="/" />
						<Redirect to="/" />
					</Switch>
				</AppShell>
			</Router>
		);
	}
}

export default Main;
