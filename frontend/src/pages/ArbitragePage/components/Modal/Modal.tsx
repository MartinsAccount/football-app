import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { MainStore } from '../../../../stores/MainStore';
import { IHighestOdds } from '../../models/models';
import ModalShell from '../../../../components/ui/ModalShell';

interface IModalProps {
	MainStore?: MainStore;
}

@inject('MainStore')
@observer
class Modal extends Component<IModalProps> {
	render() {
		const { ArbitrageStore } = this.props.MainStore;

		return (
			<ModalShell onClose={() => ArbitrageStore.setSelectedItem()}>
				<table className="text-sm">
					<thead>
						<tr className="text-text-muted border-b border-border-subtle">
							<th className="px-4 py-2 text-left font-medium">Fogadóiroda</th>
							<th className="px-4 py-2 text-left font-medium">Kimenet</th>
							<th className="px-4 py-2 text-left font-medium">Odds</th>
						</tr>
					</thead>
					<tbody>
						{ArbitrageStore.selectedItem.highestOdds.map((item: IHighestOdds, index: number) => (
							<tr key={index} className="border-b border-border-subtle last:border-0">
								<td className="px-4 py-2 text-text">{item?.bookmaker}</td>
								<td className="px-4 py-2 text-text-muted">{item?.name}</td>
								<td className="px-4 py-2 text-accent-text tabular-nums">{item?.odd}</td>
							</tr>
						))}
					</tbody>
				</table>
			</ModalShell>
		);
	}
}

export default Modal;
