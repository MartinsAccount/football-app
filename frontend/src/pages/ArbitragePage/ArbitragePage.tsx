import React, { Component, CSSProperties } from 'react';
import { formatFt, reviveArbitrageSnapshot } from '@football/core';
import PageHead from '../../components/PageIntro/PageHead';
import EmptyState from '../../components/PageIntro/EmptyState';
import { v } from '../../design/tokens/tokens';
import snapshotJson from '../../../../data/arbitrage/arbitrage-v0.json';
import ArbitrageCard from './ArbitrageCard';
import {
	arbitrageHeadChips,
	arbitrageRows,
	arbitrageTiles,
	BAND_OPTIONS,
	DEFAULT_TOTAL_STAKE,
	defaultFilter,
	IArbFilter,
	MIN_TOTAL_STAKE,
	parseTotalStake,
	STAKE_ROUNDING
} from './arbitrageView';
import { cardGrid, input } from '../../components/ui/oeClasses';

interface IArbitragePageState {
	filter: IArbFilter;
	stakeText: string;
	totalStake: number;
	limit: number;
}

const PAGE_SIZE = 12;

const filterStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: v('space.6'), alignItems: 'flex-end' };
const fieldStyle: CSSProperties = { minWidth: `min(100%, calc(${v('size.aside-basis')} * 2 / 3))` };
const tilesStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} * 3 / 4)), 1fr))`,
	gap: v('space.6'),
	marginBottom: v('space.10')
};
const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: v('space.7'), marginBlock: v('space.14') };

/**
 * `/arbitrage` – Arbitrázs (PRD 5.8, ROADMAP 8.1/S23): irodák közti arbitrázs a mentett odds-pillanatképből
 * (`data/arbitrage/arbitrage-v0.json`, `npm run arbitrage -w @football/db`; 0 külső hívás). A régi oldal (élő API-pásztázás,
 * localStorage-cache, oldalsáv + modál) route nélkül, `LegacyArbitragePage.tsx`-ként marad, amíg a 8.3 ki nem vezeti.
 * TODO(polish): a beállított ligák/irodák szűrése (SettingsStore), odds-kor figyelmeztetés, élő DB-snapshot (8.3).
 */
class ArbitragePage extends Component<{}, IArbitragePageState> {
	snapshot = reviveArbitrageSnapshot(snapshotJson);
	state: IArbitragePageState = {
		filter: defaultFilter(this.snapshot),
		stakeText: String(DEFAULT_TOTAL_STAKE),
		totalStake: DEFAULT_TOTAL_STAKE,
		limit: PAGE_SIZE
	};

	private setFilter(patch: Partial<IArbFilter>) {
		this.setState((s) => ({ filter: { ...s.filter, ...patch }, limit: PAGE_SIZE }));
	}

	private changeStake(text: string) {
		const parsed = parseTotalStake(text);
		this.setState((s) => ({ stakeText: text, totalStake: parsed ?? s.totalStake }));
	}

	render() {
		const { snapshot } = this;
		const { filter, stakeText, totalStake, limit } = this.state;
		const rows = arbitrageRows(snapshot, filter, totalStake);
		const shown = rows.slice(0, limit);
		const stakeInvalid = parseTotalStake(stakeText) === null;

		return (
			<>
				<PageHead title="Arbitrázs" chips={arbitrageHeadChips(snapshot)} />

				<div style={tilesStyle}>
					{arbitrageTiles(snapshot).map((t) => (
						<div key={t.label} className="oe-tile">
							<div className="oe-tile__label">{t.label}</div>
							<div className="oe-tile__value" style={{ color: t.positive ? v('color.accent.text') : undefined }}>
								{t.value}
							</div>
							<div className="oe-tile__foot">{t.foot}</div>
						</div>
					))}
				</div>

				<div style={filterStyle}>
					<div className="oe-segmented" role="group" aria-label="Sáv">
						{BAND_OPTIONS.map((b) => (
							<button
								key={b.key}
								type="button"
								className="oe-segmented__btn"
								aria-pressed={b.key === filter.band}
								onClick={() => this.setFilter({ band: b.key })}
							>
								{b.label}
								<small>{b.hint}</small>
							</button>
						))}
					</div>
					<label className="oe-field" style={fieldStyle}>
						Piac
						<select
							className="oe-select w-full min-w-0"
							value={filter.market}
							onChange={(e) => this.setFilter({ market: e.target.value })}
						>
							<option value="all">Minden piac</option>
							{snapshot.markets.map((m) => (
								<option key={m.key} value={m.key}>
									{m.label}
								</option>
							))}
						</select>
					</label>
					<label className="oe-field" style={fieldStyle}>
						Iroda
						<select
							className="oe-select w-full min-w-0"
							value={filter.bookmaker}
							onChange={(e) => this.setFilter({ bookmaker: e.target.value })}
						>
							<option value="all">Minden iroda</option>
							{snapshot.bookmakers.map((b) => (
								<option key={b} value={b}>
									{b}
								</option>
							))}
						</select>
					</label>
					<label className="oe-field" style={fieldStyle}>
						Összes tét (Ft)
						<input
							className={input}
							inputMode="numeric"
							value={stakeText}
							aria-invalid={stakeInvalid ? true : undefined}
							aria-describedby="arb-stake-hint"
							onChange={(e) => this.changeStake(e.target.value)}
						/>
					</label>
				</div>
				<p className="oe-muted text-small" id="arb-stake-hint" style={{ marginBlock: v('space.4') }}>
					Forrás: {snapshot.source}, {snapshot.bookmakers.length} iroda, kimenetelenként a legjobb odds. A tétek{' '}
					{formatFt(STAKE_ROUNDING)}-ra kerekítve, hogy minden kimenet közel ugyanannyit fizessen
					{stakeInvalid ? ` (legalább ${formatFt(MIN_TOTAL_STAKE)}; most ${formatFt(totalStake)}-tal számolunk)` : ''}.
				</p>

				<section style={sectionStyle} aria-labelledby="arb-list">
					<h2 className="oe-h2" id="arb-list">
						{rows.length} találat
					</h2>
					{rows.length === 0 ? (
						<EmptyState
							title="Nincs a szűrőnek megfelelő piac"
							text="Próbáld a „Közeli” vagy a „Mind” sávot, vagy töröld a piac- és irodaszűrőt."
						/>
					) : (
						<div className={cardGrid}>
							{shown.map((r) => (
								<ArbitrageCard key={r.key} row={r} totalStake={formatFt(totalStake)} />
							))}
						</div>
					)}
					{rows.length > shown.length && (
						<button type="button" className="oe-btn" onClick={() => this.setState({ limit: limit + PAGE_SIZE })}>
							További {Math.min(PAGE_SIZE, rows.length - shown.length)} megjelenítése ({rows.length - shown.length} van még)
						</button>
					)}
					<p className="oe-muted text-small m-0">
						Az arbitrázs csak akkor valós, ha minden lábat egyszerre, a megadott oddsszal meg tudod tenni; az odds a pillanatkép
						óta mozoghatott. Az irodai limitek és a fiók-korlátozás kockázata nincs a számításban.
					</p>
				</section>
			</>
		);
	}
}

export default ArbitragePage;
