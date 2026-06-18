import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import RowItem from '../RowItem/RowItem';
import { ITableRow } from '../../models/ITableRow';
import Card from '../../../../components/ui/Card';
import StatCard from '../../../../components/ui/StatCard';
import Pill from '../../../../components/ui/Pill';
import { CURRENT_SEASON } from '../../../../core/constants/constants';
import { LEAGUE_COUNTRY, LEAGUE_LABEL, seasonLabel } from '../../constants/leagueMeta';

interface IOddsContentProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class OddsContent extends Component<IOddsContentProps> {
	private get arbitrageCount(): number {
		const { currentLeague } = this.props.MainStore.OddsStore;
		const country = currentLeague && currentLeague !== 'all' ? LEAGUE_COUNTRY[currentLeague] : null;
		const arbitrages = this.props.MainStore.ArbitrageStore.Arbitrages || [];

		return arbitrages.filter((fx) => {
			const matchCountry = !country || fx.country === country;
			const good = fx.arbitrages?.some((a) => a.arbitrage != null && Number(a.arbitrage) < 1);
			return matchCountry && good;
		}).length;
	}

	render() {
		const { OddsStore } = this.props.MainStore;
		const { currentLeague, oddsInfos } = OddsStore;

		if (!currentLeague) {
			return (
				<section className="flex-1 bg-bg p-8">
					<Card className="flex flex-col items-center justify-center gap-2 p-16 text-center">
						<h2 className="text-lg font-semibold text-text">Válassz ligát</h2>
						<p className="text-sm text-text-muted">A bal oldali menüből válaszd ki, melyik bajnokság oddsait elemezzük.</p>
					</Card>
				</section>
			);
		}

		const sum = oddsInfos.sum;
		const favoritePct = sum ? Math.round((oddsInfos.favoriteWin / sum) * 100) : 0;

		return (
			<section className="flex-1 bg-bg p-8 overflow-x-auto">
				<header className="flex items-start justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-text">Odds eredmények</h1>
						<p className="text-sm text-text-muted mt-1">
							{LEAGUE_LABEL[currentLeague]} liga · {sum} mérkőzés
						</p>
					</div>
					<Pill>Szezon {seasonLabel(CURRENT_SEASON)}</Pill>
				</header>

				<div className="grid grid-cols-3 gap-4 mb-6">
					<StatCard label="Elemzett meccs" value={sum} />
					<StatCard label="Esélyes nyert" value={`${favoritePct}%`} accent />
					<StatCard label="Arbitrage" value={this.arbitrageCount} />
				</div>

				<Card className="overflow-hidden">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-text-muted border-b border-border-subtle">
								<th className="text-left font-medium px-5 py-3">Kimenet</th>
								<th className="text-center font-medium px-3 py-3">Győzelem</th>
								<th className="text-center font-medium px-3 py-3">Döntetlen</th>
								<th className="text-center font-medium px-3 py-3">Vereség</th>
								<th className="text-right font-medium px-5 py-3">Találati arány</th>
							</tr>
						</thead>
						<tbody>
							{OddsStore.getTableRows.map((data: ITableRow) => (
								<RowItem key={data.title} data={data} />
							))}
						</tbody>
					</table>
				</Card>
			</section>
		);
	}
}

export default OddsContent;
