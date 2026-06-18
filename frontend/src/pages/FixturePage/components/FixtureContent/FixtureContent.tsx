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

		// A `sub` az érték értelmezhető viszonyítása:
		// - meccs-arány a meccs-számláló statisztikáknál,
		// - a totáloknál (Összes gól, Meccsek száma) nincs %, hanem gól/meccs vagy semmi.
		const pctOf = (value: number, base: number, suffix: string): string | undefined =>
			base ? `${Math.round((value / base) * 100)}% ${suffix}` : undefined;

		const stats: { label: string; value: number; sub?: string }[] = [
			{ label: 'Összes gól', value: allGoals, sub: fixturesCount ? `${(allGoals / fixturesCount).toFixed(2)} gól / meccs` : undefined },
			{ label: 'Meccsek száma', value: fixturesCount },
			{ label: 'Mindkét csapat gól', value: FixtureStore.bothTeamsScore, sub: pctOf(FixtureStore.bothTeamsScore, fixturesCount, 'a meccsekből') },
			{ label: 'Első félidő összes gól', value: FixtureStore.getFirstHalfGoals, sub: pctOf(FixtureStore.getFirstHalfGoals, allGoals, 'az összes gólból') },
			{ label: 'Döntetlen meccsek', value: FixtureStore.getDrawFixtures, sub: pctOf(FixtureStore.getDrawFixtures, fixturesCount, 'a meccsekből') },
			{ label: 'Hazai nyert meccsek', value: FixtureStore.getHomeWinners, sub: pctOf(FixtureStore.getHomeWinners, fixturesCount, 'a meccsekből') },
			{ label: 'Páratlan gól', value: FixtureStore.getOddGoals, sub: pctOf(FixtureStore.getOddGoals, fixturesCount, 'a meccsekből') },
			{ label: 'Páros gól', value: FixtureStore.getEvenGoals, sub: pctOf(FixtureStore.getEvenGoals, fixturesCount, 'a meccsekből') },
			{ label: '0,5 gól felett', value: FixtureStore.overNullGoal, sub: pctOf(FixtureStore.overNullGoal, fixturesCount, 'a meccsekből') },
			{ label: '1,5 gól felett', value: FixtureStore.overOneGoal, sub: pctOf(FixtureStore.overOneGoal, fixturesCount, 'a meccsekből') },
			{ label: 'Csapatok száma (min. 1 döntetlen)', value: FixtureStore.teamWithDraw, sub: pctOf(FixtureStore.teamWithDraw, teams, 'a csapatokból') }
		];

		return (
			<section className="flex-1 bg-bg p-8">
				<header className="mb-6">
					<h1 className="text-2xl font-semibold text-text">Meccs statisztikák</h1>
					<p className="text-sm text-text-muted mt-1">{FixtureStore.currentLeague}</p>
				</header>

				<div className="grid grid-cols-2 md:grid-cols-3 gap-4">
					{stats.map((s) => (
						<StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} />
					))}
				</div>
			</section>
		);
	}
}

export default FixtureContent;
