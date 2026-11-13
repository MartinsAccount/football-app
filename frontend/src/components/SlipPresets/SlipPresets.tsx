import React, { Component } from 'react';
import { observer } from 'mobx-react';
import {
	buildSlipPresets,
	formatEv,
	formatFt,
	formatOdds,
	formatPairing,
	formatPercent,
	SlipPreset,
	slipTypeName
} from '@football/core';
import { ITip } from '../TipCard/tipView';
import { SlipStore } from '../../stores/SlipStore';
import { PRESET_REASON, riskText } from '../SlipPanel/slipView';
import { cx, presetGrid, statLabel, statusDot, statValue, statValueEv } from '../ui/oeClasses';

interface ISlipPresetsProps {
	tips: ITip[];
	store: SlipStore;
}

/**
 * DESIGN §7.8 (D2) – a motor kész szelvényei: típus, indoklás, lábak, eredő odds, esély, EV, tét → nyeremény, kockázat,
 * „Ajánlott” jelölés. Kiválasztásra a SlipPanel ezzel töltődik fel, utána szabadon szerkeszthető. A képletek a magból jönnek.
 */
@observer
class SlipPresets extends Component<ISlipPresetsProps> {
	apply = (preset: SlipPreset) => {
		const { tips, store } = this.props;
		store.applyPreset(preset.legIds.map((id) => tips.find((t) => t.id === id)).filter((t): t is ITip => !!t));
		// Mobilon a betöltött szelvényt rögtön meg is mutatjuk (asztalon a lap rejtett, az oldalsáv látszik).
		if (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 639.98px)').matches) store.openSheet();
	};

	renderPreset(preset: SlipPreset) {
		const { tips, store } = this.props;
		const { summary } = preset;
		const legs = preset.legIds.map((id) => tips.find((t) => t.id === id)).filter((t): t is ITip => !!t);
		const active = store.hasExactly(preset.legIds);
		return (
			<button
				key={preset.id}
				type="button"
				className="oe-preset"
				data-recommended={preset.recommended || undefined}
				aria-pressed={active}
				onClick={() => this.apply(preset)}
			>
				<span className="oe-preset__top">
					<span className="oe-badge">{slipTypeName(summary.legCount)}</span>
					{preset.recommended && <span className="oe-tag oe-tag--accent">Ajánlott</span>}
				</span>
				<span className="text-small">{PRESET_REASON[preset.kind]}</span>
				<span className="flex flex-col oe-muted text-caption">
					{legs.map((tip) => (
						<span key={tip.id} className="truncate">
							{formatPairing(tip.home.name, tip.away.name)} · {tip.tippmixLabel}
						</span>
					))}
				</span>
				<span className="oe-preset__metrics">
					<span>
						<span className={cx(statLabel, 'block')}>Eredő odds</span>
						<span className={statValue}>{formatOdds(summary.combinedOdds)}</span>
					</span>
					<span>
						<span className={cx(statLabel, 'block')}>Esély</span>
						<span className={statValue}>{formatPercent(summary.probability)}</span>
					</span>
					<span>
						<span className={cx(statLabel, 'block')}>EV</span>
						<span className={cx(statValue, summary.ev > 0 && statValueEv)}>{formatEv(summary.ev)}</span>
					</span>
				</span>
				<span className="text-small">
					{formatFt(store.stake)} tét → {formatFt(summary.payout)}
				</span>
				<span className="oe-muted text-caption">{riskText(summary.probability, summary.risk)}</span>
				{active && <span className={statusDot}>A szelvényeden</span>}
			</button>
		);
	}

	render() {
		const presets = buildSlipPresets(this.props.tips, this.props.store.stake);
		if (presets.length === 0) return null;
		return (
			<section aria-labelledby="slip-presets-title">
				<div className="oe-section-head">
					<h2 className="oe-h2" id="slip-presets-title">
						Kész szelvények
					</h2>
					<span className="oe-muted text-small">a motor javaslata, utána szerkeszthető</span>
				</div>
				<div className={presetGrid}>{presets.map((p) => this.renderPreset(p))}</div>
			</section>
		);
	}
}

export default SlipPresets;
