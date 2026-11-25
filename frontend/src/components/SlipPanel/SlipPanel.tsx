import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { formatFt, legOdds, slipSyncText } from '@football/core';
import { SlipStore } from '../../stores/SlipStore';
import RiskMeter from './RiskMeter';
import SlipLegs from './SlipLegs';
import SlipTotals from './SlipTotals';
import StakeSelector from './StakeSelector';
import TippmixTransfer from './TippmixTransfer';
import SlipBar from './SlipBar';
import SlipPresets from '../SlipPresets/SlipPresets';
import { ITip } from '../TipCard/tipView';
import { singlesNote, slipHeadText } from './slipView';
import { cx, note, slipBarSpacer, statusDot } from '../ui/oeClasses';

export const SLIP_PANEL_ID = 'szelveny';

interface ISlipPanelProps {
	store: SlipStore;
	now?: Date;
	/** A nap(ok) tippjei: ebből számolja a mag az üres állapot kész szelvényeit (§8.2). */
	presetTips?: ITip[];
}

/**
 * DESIGN v0.2 §6 „Ma – szelvény”: üresen tipp + kész szelvények; kitöltve lábak, két csempe, esély + kockázat, tét,
 * nyeremény, szingli-összevetés, „Tippmixre viszem” (→ beírt Tippmix-odds, mentés), „Szelvény ürítése”.
 */
@observer
class SlipPanel extends Component<ISlipPanelProps> {
	remove = (tipId: string) => this.props.store.remove(tipId);
	setStake = (stake: number) => this.props.store.setStake(stake);
	setInput = (tipId: string, value: string) => this.props.store.setTippmixInput(tipId, value);
	openTransfer = () => this.props.store.openTransfer();
	closeTransfer = () => this.props.store.closeTransfer();
	save = () => this.props.store.save();
	clear = () => this.props.store.clear();

	renderEmpty() {
		const { store, presetTips = [] } = this.props;
		const hasPresets = presetTips.some((t) => t.ev > 0);
		return (
			<>
				<p className="oe-slip__hint">
					{hasPresets
						? 'Még üres. Válassz a motor javaslatai közül, vagy adj hozzá tippet a listából.'
						: 'Még üres. Adj hozzá tippet a listából.'}
				</p>
				{store.lastSavedId && (
					<p className={cx(statusDot, 'm-0')} role="status">
						Szelvény mentve ({store.saved.length} mentett szelvény) – {slipSyncText(store.lastSaved?.sync)}.
					</p>
				)}
				<SlipPresets tips={presetTips} store={store} />
			</>
		);
	}

	renderBody() {
		const { store, now } = this.props;
		const { summary, stake } = store;
		if (!summary) return this.renderEmpty();
		const note = singlesNote(summary, stake);
		return (
			<>
				<SlipLegs tips={store.tips} odds={store.legs.map(legOdds)} now={now} onRemove={this.remove} />
				<SlipTotals summary={summary} />
				<RiskMeter probability={summary.probability} level={summary.risk} />
				<StakeSelector options={store.stakeOptions} value={stake} onChange={this.setStake} />
				<div className="oe-slip__payout">
					<span className="oe-muted">Lehetséges nyeremény</span>
					<strong>{formatFt(summary.payout)}</strong>
				</div>
				{note && <div className={note}>{note}</div>}
				{store.transferOpen ? (
					<TippmixTransfer
						rows={store.transferRows}
						canSave={store.canSave}
						onInput={this.setInput}
						onSave={this.save}
						onClose={this.closeTransfer}
						idPrefix="slip"
					/>
				) : (
					<button className="oe-btn oe-btn--primary oe-btn--cta" type="button" onClick={this.openTransfer}>
						Tippmixre viszem
					</button>
				)}
				<button className="oe-linkbtn oe-linkbtn--muted" type="button" onClick={this.clear}>
					Szelvény ürítése
				</button>
			</>
		);
	}

	/**
	 * Asztalon sticky oldalsáv; 1000 px alatt statikus, a lista alá kerül (DESIGN §5). < 640 px-en kitöltött szelvénynél a
	 * lebegő SlipBar a panelre ugrik (a BottomSheet megszűnt, DECISIONS 2026-11-13).
	 */
	render() {
		const { store } = this.props;
		const { summary } = store;
		const count = store.tips.length;
		return (
			<>
				<aside className="oe-split__aside oe-slip" id={SLIP_PANEL_ID} aria-labelledby="slip-title">
					<div className="oe-slip__head">
						<h2 className="oe-h2" id="slip-title">
							Szelvényem
						</h2>
						<span className="oe-section-sub">{count > 0 ? slipHeadText(count) : 'nincs tipp'}</span>
					</div>
					<div className="oe-slip__body">{this.renderBody()}</div>
				</aside>
				{summary && <div className={slipBarSpacer} aria-hidden="true" />}
				{summary && <SlipBar summary={summary} href={`#${SLIP_PANEL_ID}`} />}
			</>
		);
	}
}

export default SlipPanel;
