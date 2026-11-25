import React, { Component } from 'react';
import { BrowserRouter as Router, Switch, Route, Redirect } from 'react-router-dom';
import AppShell from '../AppShell/AppShell';
import RecommendationsPage from '../../pages/RecommendationsPage/RecommendationsPage';
import EvaluationPage from '../../pages/EvaluationPage/EvaluationPage';
import SettingsPage from '../../pages/SettingsPage/SettingsPage';
import ArbitragePage from '../../pages/ArbitragePage/ArbitragePage';
import MatchPage from '../../pages/MatchPage/MatchPage';
import QuizPage from '../../pages/QuizPage/QuizPage';

// Route-ok a PRD 5.8 szerint. A régi /odds és /fixtures a Ma oldalra irányít (az odds-mozgás és a
// meccs-statisztika a TipCard MatchDetails részébe olvad, ROADMAP H). A régi /legacy/* nézetek az M1
// zárásával kikerültek a routingból (ui-audit P0/P1, DECISIONS 2026-11-13); a kódjuk a 8.3-ig marad.
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
						<Route path="/quiz">
							<QuizPage />
						</Route>
						<Route path="/settings">
							<SettingsPage />
						</Route>
						<Route path="/arbitrage">
							<ArbitragePage />
						</Route>
						<Route path="/match/:id" render={({ match }) => <MatchPage id={Number(match.params.id)} />} />
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
