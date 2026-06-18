import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { IAnalyzedFixture, IArbitrage } from '../../models/models';

interface IRowItemProps {
	MainStore?: MainStore;
	data: IAnalyzedFixture;
}

@inject('MainStore')
@observer
class RowItem extends Component<IRowItemProps> {
	render() {
		const { data } = this.props;
		const { ArbitrageStore } = this.props.MainStore;

		const options: Intl.DateTimeFormatOptions = { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' };
		const formattedDate = new Date(data?.date).toLocaleString('hu-HU', options);

		return (
			<tr className="border-b border-border-subtle last:border-0 hover:bg-surface-2 transition-colors">
				<td className="px-4 py-3 text-text">{data?.fixture}</td>
				<td className="px-4 py-3 text-text-muted">{data?.country}</td>
				<td className="px-4 py-3 text-text-muted">{data?.leagueName}</td>
				<td className="px-4 py-3 text-text-muted whitespace-nowrap">{formattedDate}</td>

				{data.arbitrages.map((item: IArbitrage) => {
					const good = item.arbitrage < 1 && item.arbitrage !== null;
					return (
						<td
							key={item.name}
							onClick={() => ArbitrageStore.setSelectedItem(item)}
							className={`px-3 py-3 text-center cursor-pointer tabular-nums transition-colors hover:underline ${
								good ? 'bg-accent/15 text-accent font-semibold' : 'text-text-muted'
							}`}
						>
							{!item.arbitrage ? '–' : item.arbitrage}
						</td>
					);
				})}
			</tr>
		);
	}
}

export default RowItem;
