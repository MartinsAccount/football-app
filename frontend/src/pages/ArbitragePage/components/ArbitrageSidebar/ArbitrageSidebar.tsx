import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { ArrowRightSvg } from '../../../../assets/ArrowRightSvg';
import Button from '../../../../components/ui/Button';

interface IArbitrageSidebarProps {
	MainStore?: MainStore;
}

type FilterBlock = 'listView' | 'parameters' | 'arbitrageRanges' | 'bookmakers' | 'betTypes';

const optionLabel = 'flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted cursor-pointer hover:text-text';

@inject('MainStore')
@observer
class ArbitrageSidebar extends Component<IArbitrageSidebarProps> {
	private header(key: FilterBlock, label: string) {
		const { ArbitrageStore } = this.props.MainStore;
		const open = ArbitrageStore.openedFilterBlocks.includes(key);

		return (
			<button
				type="button"
				aria-expanded={open}
				onClick={() => ArbitrageStore.toggleFilterBlock(key)}
				className="appearance-none border-0 bg-transparent cursor-pointer w-full flex items-center justify-between px-3 py-2 text-sm font-medium text-text hover:text-accent transition-colors"
			>
				<span>{label}</span>
				<span className={`flex transition-transform ${open ? 'rotate-90' : ''}`}>
					<ArrowRightSvg />
				</span>
			</button>
		);
	}

	render() {
		const { ArbitrageStore } = this.props.MainStore;
		const betTypeCount = (ArbitrageStore.getArbitrages.length > 0 && ArbitrageStore.getArbitrages[0]?.arbitrages?.length) ?? 0;

		return (
			<aside className="w-64 shrink-0 bg-sidebar border-r border-border-subtle flex flex-col gap-2 p-3 overflow-y-auto">
				<Button variant="primary" onClick={() => ArbitrageStore.searchAllLeagueIds()}>
					Arbitrázs frissítése
				</Button>
				<Button variant="secondary" onClick={() => ArbitrageStore.resetFilters()}>
					Szűrők törlése
				</Button>

				<div className="mt-2 flex flex-col divide-y divide-border-subtle">
					{/* Nézet */}
					<div className="py-1">
						{this.header('listView', 'Nézet')}
						{ArbitrageStore.openedFilterBlocks.includes('listView') && (
							<div className="flex flex-col">
								<label className={optionLabel}>
									<input
										type="radio"
										name="listView"
										className="accent-accent"
										checked={ArbitrageStore.activeListView === 'original'}
										onChange={() => ArbitrageStore.changeListView('original')}
									/>
									<span>Táblázat</span>
								</label>
								<label className={optionLabel}>
									<input
										type="radio"
										name="listView"
										className="accent-accent"
										checked={ArbitrageStore.activeListView === 'betType'}
										onChange={() => ArbitrageStore.changeListView('betType')}
									/>
									<span>Fogadástípus szerint</span>
								</label>
							</div>
						)}
					</div>

					{/* Paraméterek */}
					<div className="py-1">
						{this.header('parameters', 'Paraméterek')}
						{ArbitrageStore.openedFilterBlocks.includes('parameters') && (
							<div className="flex flex-col">
								<label className={optionLabel}>
									<input
										type="checkbox"
										className="accent-accent"
										checked={ArbitrageStore.selectedParameters === 'twoParameter'}
										onChange={() => ArbitrageStore.selectParameters('twoParameter')}
									/>
									<span>Két kimenet ({ArbitrageStore.getParametersFrequency.twoParameter})</span>
								</label>
								<label className={optionLabel}>
									<input
										type="checkbox"
										className="accent-accent"
										checked={ArbitrageStore.selectedParameters === 'threeParameter'}
										onChange={() => ArbitrageStore.selectParameters('threeParameter')}
									/>
									<span>Három kimenet ({ArbitrageStore.getParametersFrequency.threeParameter})</span>
								</label>
							</div>
						)}
					</div>

					{/* Arbitrázs sávok */}
					<div className="py-1">
						{this.header('arbitrageRanges', 'Arbitrázs sávok')}
						{ArbitrageStore.openedFilterBlocks.includes('arbitrageRanges') &&
							ArbitrageStore.getArbitrageRanges.map((range) => (
								<label key={range.from} className={optionLabel}>
									<input
										type="checkbox"
										className="accent-accent"
										checked={ArbitrageStore.activeArbitrageRangeFilter?.from === range.from}
										onChange={() => ArbitrageStore.addArbitrageRangeFilter(range)}
									/>
									<span>
										{range.from} – {range.to} ({range.frequency})
									</span>
								</label>
							))}
					</div>

					{/* Fogadóirodák */}
					<div className="py-1">
						{this.header('bookmakers', `Fogadóirodák (${ArbitrageStore.getBookmakers.length})`)}
						{ArbitrageStore.openedFilterBlocks.includes('bookmakers') &&
							ArbitrageStore.getBookmakers.map((item) => (
								<label key={item[0]} className={optionLabel}>
									<input
										type="checkbox"
										className="accent-accent"
										checked={ArbitrageStore.filteredBookmakers.includes(item[0])}
										onChange={() => ArbitrageStore.toggleBookmakerFilter(item[0] as string)}
									/>
									<span>
										{item[0]} ({item[1]})
									</span>
								</label>
							))}
					</div>

					{/* Fogadástípusok */}
					<div className="py-1">
						{this.header('betTypes', `Fogadástípusok (${betTypeCount})`)}
						{ArbitrageStore.openedFilterBlocks.includes('betTypes') &&
							ArbitrageStore.getBetTypes.map((item) => (
								<label key={item[0]} className={optionLabel}>
									<input
										type="checkbox"
										className="accent-accent"
										checked={ArbitrageStore.filteredBetTypes.includes(item[0])}
										onChange={() => ArbitrageStore.toggleBetTypeFilter(item[0] as string)}
									/>
									<span>
										{item[0]} ({item[1]})
									</span>
								</label>
							))}
					</div>
				</div>
			</aside>
		);
	}
}

export default ArbitrageSidebar;
