import React, { Component } from 'react';
import { observer } from 'mobx-react';
import { buildSlipPresets, formatEv, formatOdds, formatPairing, formatPercent, SlipPreset } from '@football/core';
import { ITip } from '../TipCard/tipView';
import { SlipStore } from '../../stores/SlipStore';
import { presetTitle, riskText } from '../SlipPanel/slipView';

interface ISlipPresetsProps {
	tips: ITip[];
	store: SlipStore;
}

/**
 * DESIGN v0.2 §6 „Ma – szelvény” üres állapota: „KÉSZ SZELVÉNYEK” + `.oe-preset` gombok (név, „Ajánlott”, lábak,
 * odds/esély/EV, kockázat-pötty). A presetet a mag számolja (§8.2), a komponens csak megjelenít. Kattintás → `applyPreset`.
 */
@observer
class SlipPresets extends Component<ISlipPresetsProps> {
	legsOf = (preset: SlipPreset): ITip[] =>
		preset.legIds.map((id) => this.props.tips.find((t) => t.id === id)).filter((t): t is ITip => !!t);

	renderPreset(preset: SlipPreset, total: number) {
		const { summary } = preset;
		const legs = this.legsOf(preset);
		return (
			<button
				key={preset.id}
				type="button"
				className="oe-preset"
				data-recommended={preset.recommended}
				onClick={() => this.props.store.applyPreset(legs)}
			>
				<span className="oe-preset__top">
					{presetTitle(preset, legs, total)}
					{preset.recommended && <span className="oe-tag oe-tag--accent">Ajánlott</span>}
				</span>
				<span className="oe-preset__legs">
					{legs.map((tip) => `${formatPairing(tip.home.name, tip.away.name)} · ${tip.tippmixLabel}`).join('\n')}
				</span>
				<span className="oe-preset__metrics">
					<span>
						<small>odds</small>
						{formatOdds(summary.combinedOdds)}
					</span>
					<span>
						<small>esély</small>
						{formatPercent(summary.probability)}
					</span>
					<span className={summary.ev > 0 ? 'text-accent-text' : undefined}>
						<small>EV</small>
						{formatEv(summary.ev)}
					</span>
				</span>
				<span className="oe-risk-dot" data-level={summary.risk}>
					{riskText(summary.probability, summary.risk)}
				</span>
			</button>
		);
	}

	render() {
		const { tips, store } = this.props;
		const presets = buildSlipPresets(tips, store.stake);
		if (presets.length === 0) return null;
		const total = new Set(tips.filter((t) => t.ev > 0).map((t) => t.fixtureId)).size;
		return (
			<>
				<div className="oe-label">Kész szelvények</div>
				{presets.map((p) => this.renderPreset(p, total))}
			</>
		);
	}
}

export default SlipPresets;
