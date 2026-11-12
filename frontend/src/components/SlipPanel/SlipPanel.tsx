import React, { Component, CSSProperties } from 'react';
import { observer } from 'mobx-react';
import { formatFt, legOdds } from '@football/core';
import { SlipStore, STAKE_OPTIONS } from '../../stores/SlipStore';
import RiskMeter from './RiskMeter';
import SlipLegs from './SlipLegs';
import SlipTotals from './SlipTotals';
import StakeSelector from './StakeSelector';
import TippmixTransfer from './TippmixTransfer';
import { v } from '../../design/tokens/tokens';
import { singlesNote, slipHeadText } from './slipView';

const emptyStyle: CSSProperties = { paddingTop: v('space.8'), gap: v('space.3') };

interface ISlipPanelProps {
	store: SlipStore;
	now?: Date;
}

/** DESIGN §7.6 – szelvény: fej, lábak, összesítő, esély + kockázat, tét, nyeremény, szingli-összevetés, CTA / Tippmixre vitel. */
@observer
class SlipPanel extends Component<ISlipPanelProps> {
	remove = (tipId: string) => this.props.store.remove(tipId);
	setStake = (stake: number) => this.props.store.setStake(stake);
	setInput = (tipId: string, value: string) => this.props.store.setTippmixInput(tipId, value);
	openTransfer = () => this.props.store.openTransfer();
	closeTransfer = () => this.props.store.closeTransfer();
	save = () => this.props.store.save();

	renderBody() {
		const { store, now } = this.props;
		const { summary, stake } = store;
		if (!summary) {
			return (
				<div className="flex flex-col" style={emptyStyle}>
					<strong>Még üres a szelvény</strong>
					<p className="oe-muted text-small m-0">Adj hozzá tippeket a listából, vagy kérd a motor javaslatát.</p>
					{store.lastSavedId && (
						<p className="oe-status m-0" role="status">
							Szelvény mentve ({store.saved.length} mentett szelvény).
						</p>
					)}
				</div>
			);
		}
		const note = singlesNote(summary, stake);
		return (
			<>
				<SlipLegs tips={store.tips} odds={store.legs.map(legOdds)} now={now} onRemove={this.remove} />
				<SlipTotals summary={summary} />
				<RiskMeter probability={summary.probability} level={summary.risk} />
				<StakeSelector options={STAKE_OPTIONS} value={stake} onChange={this.setStake} />
				<div className="oe-slip__payout">
					<span className="oe-muted">Lehetséges nyeremény</span>
					<strong>{formatFt(summary.payout)}</strong>
				</div>
				{note && <div className="oe-slip__note">{note}</div>}
				{store.transferOpen ? (
					<TippmixTransfer
						rows={store.transferRows}
						canSave={store.canSave}
						onInput={this.setInput}
						onSave={this.save}
						onClose={this.closeTransfer}
					/>
				) : (
					<button className="oe-btn oe-btn--primary oe-btn--cta" type="button" onClick={this.openTransfer}>
						Tippmixre viszem
					</button>
				)}
			</>
		);
	}

	render() {
		const count = this.props.store.tips.length;
		return (
			<aside className="oe-split__aside oe-slip" aria-label="Szelvény">
				<div className="oe-slip__head">
					<h2 className="oe-h2">Szelvényem</h2>
					{count > 0 && <span className="oe-muted text-small">{slipHeadText(count)}</span>}
				</div>
				<div className="oe-slip__body">{this.renderBody()}</div>
			</aside>
		);
	}
}

export default SlipPanel;
