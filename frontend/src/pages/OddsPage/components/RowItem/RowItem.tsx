import React, { Component } from 'react';
import { ITableRow } from '../../models/ITableRow';
import Bar from '../../../../components/ui/Bar';

interface IRowItemProps {
	data: ITableRow;
}

const DASH = '—';

// Az aggregált sorok (csak data/onCustomData) egyetlen számát a mockup a hozzá
// tartozó kimenet-oszlopba teszi. Ezt a címkéből vezetjük le (presentational).
const aggregateColumn = (title: string): 'GY' | 'D' | 'V' => {
	const t = title.toLowerCase();
	if (t.includes('döntetlen')) return 'D';
	if (t.includes('esélytelenebb')) return 'V';
	return 'GY';
};

class RowItem extends Component<IRowItemProps> {
	render() {
		const { data } = this.props;
		const isResultRow = data.GY !== undefined;

		let gy: number | string = DASH;
		let d: number | string = DASH;
		let v: number | string = DASH;
		let percent = 0;

		if (isResultRow) {
			gy = data.GY ?? DASH;
			d = data.D ?? DASH;
			v = data.V ?? DASH;
			const total = (data.GY ?? 0) + (data.D ?? 0) + (data.V ?? 0);
			percent = total ? ((data.GY ?? 0) / total) * 100 : 0;
		} else {
			const col = aggregateColumn(data.title);
			const value = data.data ?? DASH;
			if (col === 'GY') gy = value;
			else if (col === 'D') d = value;
			else v = value;
			percent = data.onCustomData ? ((data.data ?? 0) / data.onCustomData) * 100 : 0;
		}

		return (
			<tr className="border-b border-border-subtle last:border-0 hover:bg-surface-2 transition-colors">
				<td className="px-5 py-3 text-text">{data.title}</td>
				<td className="px-3 py-3 text-center tabular-nums text-positive">{gy}</td>
				<td className="px-3 py-3 text-center tabular-nums text-text-muted">{d}</td>
				<td className="px-3 py-3 text-center tabular-nums text-negative">{v}</td>
				<td className="px-5 py-3">
					<div className="flex justify-end">
						<Bar percent={percent} />
					</div>
				</td>
			</tr>
		);
	}
}

export default RowItem;
