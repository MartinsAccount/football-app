import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { IAnalyzedFixture, IArbitrage } from '../../models/models';
import Modal from '../Modal/Modal';
import RowItem from '../RowItem/RowItem';
import { IArbitrageByBetType } from '../../models/IArbitrageByBetType';
import FixtureInformationModal from '../FixtureInformationModal/FixtureInformationModal';
import Card from '../../../../components/ui/Card';
import StatCard from '../../../../components/ui/StatCard';
import Button from '../../../../components/ui/Button';

interface IArbitrageContentProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class ArbitrageContent extends Component<IArbitrageContentProps> {
	componentDidMount(): void {
		this.props.MainStore.ArbitrageStore.Init();
	}

	render() {
		const { ArbitrageStore } = this.props.MainStore;

		if (this.props.MainStore.isLoading) {
			return (
				<section className="flex-1 bg-bg p-8">
					<Card className="flex items-center justify-center gap-3 p-16">
						<span className="h-6 w-6 rounded-full border-2 border-border-subtle border-t-accent animate-spin" />
						<span className="text-text-muted">{this.props.MainStore.loadingText ?? 'Betöltés…'}</span>
					</Card>
				</section>
			);
		}

		// Bet-type szerinti lista nézet
		if (ArbitrageStore.isBetTypeView) {
			const rows = ArbitrageStore.getArbitragesByBetType;

			return (
				<section className="flex-1 bg-bg p-8 overflow-x-auto">
					<header className="mb-6">
						<h1 className="text-2xl font-semibold text-text">Arbitrázs</h1>
						<p className="text-sm text-text-muted mt-1">Fogadástípus szerint · {rows.length} találat</p>
					</header>

					<Card className="overflow-hidden">
						<div className="flex px-5 py-3 text-sm text-text-muted border-b border-border-subtle">
							<div className="flex-1">Fogadástípus</div>
							<div className="flex-1">Arbitrázs</div>
							<div className="flex-[4] flex gap-2">
								{[...Array(3)].map((_, i) => (
									<div key={i} className="flex-1">
										Fogadóiroda – Odds – Tipp
									</div>
								))}
							</div>
						</div>

						{rows.map((data: IArbitrageByBetType) => {
							const selected = ArbitrageStore.isSelectedListItem(data);
							return (
								<button
									key={`${data.data.fixture}-${data.betType}`}
									type="button"
									onClick={() => ArbitrageStore.selectArbitrageByBetTypeItem(data)}
									className={`appearance-none border-0 cursor-pointer w-full flex px-5 py-3 text-sm text-left border-b border-border-subtle last:border-0 transition-colors ${
										selected ? 'bg-accent/10' : 'bg-transparent hover:bg-surface-2'
									}`}
								>
									<div className="flex-1 text-text">{data.betType}</div>
									<div className="flex-1 text-accent-text tabular-nums">{data.arbitrage}</div>
									<div className="flex-[4] flex gap-2">
										{[...Array(3)].map((_, i) => {
											const bm = i < data.bookmakers.length ? data.bookmakers[i] : null;
											return (
												<div key={i} className="flex-1 text-text-muted">
													{bm ? (
														<>
															<span className="text-text font-medium">{bm.bookmaker}</span> – {bm.odd} – {bm.name}
														</>
													) : null}
												</div>
											);
										})}
									</div>
								</button>
							);
						})}
					</Card>

					{ArbitrageStore.isOpenFixtureInformationModal && <FixtureInformationModal />}
				</section>
			);
		}

		// Eredeti táblázat nézet
		const info = ArbitrageStore.getInformations;
		const fixtures = ArbitrageStore.getArbitrages;
		const betTypeNames: string[] = fixtures.length > 0 ? fixtures[0].arbitrages.map((a: IArbitrage) => a.name) : [];

		return (
			<section className="flex-1 bg-bg p-8 overflow-x-auto">
				<header className="mb-6">
					<h1 className="text-2xl font-semibold text-text">Arbitrázs</h1>
					<p className="text-sm text-text-muted mt-1">Eredeti táblázat</p>
				</header>

				<div className="grid grid-cols-3 gap-4 mb-6">
					<StatCard label="Meccsek" value={info.fixtures} />
					<StatCard label="Összes arbitrázs" value={info.allArbitrage} />
					<StatCard
						label="Jó arbitrázs"
						value={info.goodArbitrage}
						accent
						sub={`${info.goodWithTwoParams} két kimenet · ${info.gooWithThreeParams} három`}
					/>
				</div>

				<div className="flex items-center gap-2 mb-4">
					<Button active={ArbitrageStore.filtering === 'goodArbitrage'} onClick={() => ArbitrageStore.setFilter('goodArbitrage')}>
						Arbitrázs &lt; 1
					</Button>
					<Button active={!ArbitrageStore.filtering} onClick={() => ArbitrageStore.setFilter(null)}>
						Összes ({ArbitrageStore.Arbitrages.length})
					</Button>
				</div>

				<Card className="overflow-hidden">
					<table className="w-full text-sm">
						<thead>
							<tr className="text-text-muted border-b border-border-subtle">
								<th className="text-left font-medium px-4 py-3">Meccs</th>
								<th className="text-left font-medium px-4 py-3">Ország</th>
								<th className="text-left font-medium px-4 py-3">Liga</th>
								<th className="text-left font-medium px-4 py-3">Dátum</th>
								{betTypeNames.map((name) => (
									<th key={name} className="text-center font-medium px-3 py-3">
										{name}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{fixtures.map((data: IAnalyzedFixture) => (
								<RowItem key={data.fixture} data={data} />
							))}
						</tbody>
					</table>
				</Card>

				{ArbitrageStore.selectedItem && <Modal />}
			</section>
		);
	}
}

export default ArbitrageContent;
