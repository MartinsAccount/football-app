import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { IHighestOdds } from '../../models/models';
import ModalShell from '../../../../components/ui/ModalShell';

interface IFixtureInformationModalProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class FixtureInformationModal extends Component<IFixtureInformationModalProps> {
	render() {
		const { ArbitrageStore } = this.props.MainStore;

		return (
			<ModalShell onClose={() => ArbitrageStore.setIsOpenFixtureInformationModal(false)}>
				{ArbitrageStore.isLoadingFixtureInformation ? (
					<div className="flex h-64 w-64 flex-col items-center justify-center gap-4">
						<span className="h-8 w-8 rounded-full border-2 border-border-subtle border-t-accent animate-spin" />
						<span className="text-text-muted">{this.props.MainStore.loadingText ?? 'Betöltés…'}</span>
					</div>
				) : (
					<div className="min-w-[20rem]">
						<dl className="flex flex-col gap-2 mb-5 text-sm">
							<div className="flex gap-2">
								<dt className="font-semibold text-text">Ország:</dt>
								<dd className="text-text-muted">{ArbitrageStore.fixtureInformation.league.country}</dd>
							</div>
							<div className="flex gap-2">
								<dt className="font-semibold text-text">Liga:</dt>
								<dd className="text-text-muted">{ArbitrageStore.fixtureInformation.league.name}</dd>
							</div>
							<div className="flex gap-2">
								<dt className="font-semibold text-text">Csapatok:</dt>
								<dd className="text-text-muted">
									{ArbitrageStore.fixtureInformation.teams.home.name} – {ArbitrageStore.fixtureInformation.teams.away.name}
								</dd>
							</div>
							<div className="flex gap-2">
								<dt className="font-semibold text-text">Dátum:</dt>
								<dd className="text-text-muted">
									{new Date(ArbitrageStore.fixtureInformation.fixture.date).toLocaleString('hu-HU')}
								</dd>
							</div>
						</dl>

						<table className="text-sm">
							<thead>
								<tr className="text-text-muted border-b border-border-subtle">
									<th className="px-4 py-2 text-left font-medium">Fogadóiroda</th>
									<th className="px-4 py-2 text-left font-medium">Kimenet</th>
									<th className="px-4 py-2 text-left font-medium">Odds</th>
								</tr>
							</thead>
							<tbody>
								{ArbitrageStore.selectedListItem.bookmakers.map((bookmaker: IHighestOdds, index: number) => (
									<tr key={index} className="border-b border-border-subtle last:border-0">
										<td className="px-4 py-2 text-text">{bookmaker?.bookmaker}</td>
										<td className="px-4 py-2 text-text-muted">{bookmaker?.name}</td>
										<td className="px-4 py-2 text-accent-text tabular-nums">{bookmaker?.odd}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</ModalShell>
		);
	}
}

export default FixtureInformationModal;
