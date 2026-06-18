import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import Card from '../../../../components/ui/Card';
import StatCard from '../../../../components/ui/StatCard';

interface IFixtureContentProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class FixtureContent extends Component<IFixtureContentProps> {
	render() {
		const { FixtureStore } = this.props.MainStore;

		if (!FixtureStore.fixtures || !FixtureStore.results) {
			return (
				<section className="flex-1 bg-bg p-8">
					<Card className="flex flex-col items-center justify-center gap-2 p-16 text-center">
						<h2 className="text-lg font-semibold text-text">Válassz ligát</h2>
						<p className="text-sm text-text-muted">A bal oldali menüből válaszd ki, melyik bajnokság statisztikáit nézzük.</p>
					</Card>
				</section>
			);
		}

		const fixturesCount = FixtureStore.getAllFixtures;
		const allGoals = FixtureStore.getAllGoals;
		const teams = FixtureStore.teamsNumber;

		// A százalék alapja megegyezik a korábbi CustomStat logikájával (szemantika változatlan).
		const stats: { label: string; value: number; base: number }[] = [
			{ label: 'Összes gól', value: allGoals, base: fixturesCount },
			{ label: 'Meccsek száma', value: fixturesCount, base: allGoals },
			{ label: 'Mindkét csapat gól', value: FixtureStore.bothTeamsScore, base: fixturesCount },
			{ label: 'Első félidő összes gól', value: FixtureStore.getFirstHalfGoals, base: allGoals },
			{ label: 'Döntetlen meccsek', value: FixtureStore.getDrawFixtures, base: fixturesCount },
			{ label: 'Hazai nyert meccsek', value: FixtureStore.getHomeWinners, base: fixturesCount },
			{ label: 'Páratlan gól', value: FixtureStore.getOddGoals, base: fixturesCount },
			{ label: 'Páros gól', value: FixtureStore.getEvenGoals, base: fixturesCount },
			{ label: '0,5 gól felett', value: FixtureStore.overNullGoal, base: fixturesCount },
			{ label: '1,5 gól felett', value: FixtureStore.overOneGoal, base: fixturesCount },
			{ label: 'Csapatok száma (min. 1 döntetlen)', value: FixtureStore.teamWithDraw, base: teams }
		];

		return (
			<section className="flex-1 bg-bg p-8">
				<header className="mb-6">
					<h1 className="text-2xl font-semibold text-text">Meccs statisztikák</h1>
					<p className="text-sm text-text-muted mt-1">{FixtureStore.currentLeague}</p>
				</header>

				<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
					{stats.map((s) => {
						const pct = s.base ? Math.round((s.value / s.base) * 100) : 0;
						return <StatCard key={s.label} label={s.label} value={s.value} sub={`${pct}%`} />;
					})}
				</div>
			</section>
		);
	}
}

export default FixtureContent;
