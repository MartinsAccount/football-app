import React, { Component, CSSProperties } from 'react';
import { inject, observer } from 'mobx-react';
import { formatDecimal, formatFt, formatPercent } from '@football/core';
import PageIntro from '../../components/PageIntro/PageIntro';
import { v } from '../../design/tokens/tokens';
import { MainStore } from '../../stores/MainStore';
import {
	DAILY_CALL_LIMIT,
	NumberField,
	numberFieldText,
	parseNumberField,
	RETENTION_OPTIONS,
	SETTINGS_BOOKMAKERS,
	SETTINGS_LEAGUES,
	SETTINGS_MARKETS,
	STAKE_UNITS
} from './settingsView';
import { cx, dangerBox, input, toggleBtn, warningBox } from '../../components/ui/oeClasses';

interface ISettingsPageProps {
	MainStore?: MainStore;
}

interface ISettingsPageState {
	drafts: Record<NumberField, string>;
	invalid: Partial<Record<NumberField, string>>;
}

const NUMBER_FIELDS: { field: NumberField; label: string; hint: string }[] = [
	{ field: 'evThreshold', label: 'EV-küszöb (%)', hint: 'Ennél kisebb várható értékű tippet nem ajánlunk.' },
	{ field: 'minOdds', label: 'Minimum odds', hint: 'Ennél kisebb oddsú tipp nem kerül a listára.' },
	{ field: 'maxOdds', label: 'Maximum odds', hint: 'Ennél nagyobb oddsú tipp nem kerül a listára.' },
	{ field: 'backfillReserve', label: 'Backfill-tartalék (hívás/nap)', hint: 'Ennyi hívást hagyunk a régi adatok pótlására.' }
];

const MB = 1024 * 1024;

const sectionStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: v('space.7'), marginTop: v('space.14') };
const tilesStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} * 3 / 4)), 1fr))`,
	gap: v('space.6')
};
const listStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${v('size.aside-basis')}), 1fr))`,
	gap: v('space.4'),
	margin: 0,
	padding: 0,
	listStyle: 'none'
};
const rowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: v('space.6'),
	minHeight: v('size.touch'),
	padding: `${v('space.5')} ${v('space.7')}`,
	background: v('color.bg.surface'),
	border: `1px solid ${v('color.border.default')}`,
	borderRadius: v('radius.xl'),
	cursor: 'pointer'
};
const checkStyle: CSSProperties = {
	width: v('space.9'),
	height: v('space.9'),
	accentColor: v('color.accent.default'),
	flex: 'none'
};
const rowMainStyle: CSSProperties = { display: 'flex', flexDirection: 'column', gap: v('space.1'), minWidth: 0, flex: 1 };
const rowNameStyle: CSSProperties = { fontWeight: v('font.weight.bold') };
const rowMetaStyle: CSSProperties = { fontSize: v('font.size.caption'), color: v('color.text.muted') };
const badgesStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: v('space.2') };
const rowNumStyle: CSSProperties = {
	fontVariantNumeric: 'tabular-nums',
	fontSize: v('font.size.small'),
	color: v('color.text.secondary'),
	whiteSpace: 'nowrap',
	textAlign: 'right'
};
const togglesStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: v('space.4') };
const formGridStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} * 3 / 4)), 1fr))`,
	gap: v('space.7')
};
const fieldHintStyle: CSSProperties = { fontSize: v('font.size.micro'), color: v('color.text.muted') };
const errorStyle: CSSProperties = { ...fieldHintStyle, color: v('color.signal.negative-text') };

const Check = ({
	checked,
	onChange,
	label,
	meta,
	right,
	badges
}: {
	checked: boolean;
	onChange: () => void;
	label: string;
	meta?: string;
	right?: string;
	badges?: string[];
}) => (
	<li>
		<label style={rowStyle}>
			<input type="checkbox" checked={checked} onChange={onChange} style={checkStyle} />
			<span style={rowMainStyle}>
				<span style={rowNameStyle}>{label}</span>
				{meta && <span style={rowMetaStyle}>{meta}</span>}
				{badges && badges.length > 0 && (
					<span style={badgesStyle}>
						{badges.map((b) => (
							<span key={b} className="oe-badge">
								{b}
							</span>
						))}
					</span>
				)}
			</span>
			{right && <span style={rowNumStyle}>{right}</span>}
		</label>
	</li>
);

/**
 * `/settings` – Beállítások (PRD 5.3, 5.8, 7.5; ROADMAP S22): ligák, piacok, irodák, snapshot-megőrzés, stratégia-paraméterek;
 * élő becslés a napi hívásra és a tárhelyre (core `budget/`). Minden változás azonnal mentődik (localStorage).
 * TODO(polish): a beállítás még nem hat az ajánlásokra (a `/` pillanatképe előre számolt); csapat-szűrő; ligánkénti piac-felülírás.
 */
@inject('MainStore')
@observer
class SettingsPage extends Component<ISettingsPageProps, ISettingsPageState> {
	get store() {
		return this.props.MainStore!.SettingsStore;
	}

	state: ISettingsPageState = { drafts: this.initialDrafts(), invalid: {} };

	initialDrafts(): Record<NumberField, string> {
		const s = this.props.MainStore!.SettingsStore.settings;
		return {
			evThreshold: numberFieldText('evThreshold', s.evThreshold),
			minOdds: numberFieldText('minOdds', s.minOdds),
			maxOdds: numberFieldText('maxOdds', s.maxOdds),
			backfillReserve: numberFieldText('backfillReserve', s.backfillReserve)
		};
	}

	changeNumber = (field: NumberField, text: string) => {
		const value = parseNumberField(field, text);
		let error: string | undefined;
		if (value === null) error = 'Érvénytelen érték.';
		else if (!this.store.setNumber(field, value)) error = 'A minimum oddsnak kisebbnek kell lennie a maximumnál.';
		this.setState((st) => ({ drafts: { ...st.drafts, [field]: text }, invalid: { ...st.invalid, [field]: error } }));
	};

	reset = () => {
		this.store.reset();
		this.setState({ drafts: this.initialDrafts(), invalid: {} });
	};

	render() {
		const { settings: s, estimate: e, warnings } = this.store;
		const { drafts, invalid } = this.state;
		const tiles = [
			{
				label: 'Napi hívás (átlag)',
				value: formatDecimal(e.dailyWithReserve, 0),
				foot: `ebből ${formatDecimal(s.backfillReserve, 0)} tartalék · keret ${DAILY_CALL_LIMIT}`,
				danger: e.dailyWithReserve > DAILY_CALL_LIMIT
			},
			{
				label: 'Csúcsnap',
				value: formatDecimal(e.peakWithReserve, 0),
				foot: 'péntek–szombat, tartalékkal',
				danger: e.peakWithReserve > DAILY_CALL_LIMIT
			},
			{
				label: 'Tárhely / szezon',
				value: `${formatDecimal(e.storageBytes / MB, 1)} MB`,
				foot: `${formatPercent(e.storageShare)} az 500 MB-ból`,
				danger: e.storageShare > 1
			},
			{
				label: 'Szezon fér el',
				value: Number.isFinite(e.seasonsInLimit) ? formatDecimal(e.seasonsInLimit, 0) : '∞',
				foot: `${formatDecimal(e.rowsPerSeason, 0)} odds-sor / szezon`,
				danger: e.seasonsInLimit < 1
			}
		];

		return (
			<>
				<PageIntro date={null} title="Beállítások." subtitle="Ligák, piacok, irodák és a napi keret." />

				<section style={{ display: 'flex', flexDirection: 'column', gap: v('space.6') }} aria-label="Becslés">
					<div style={tilesStyle}>
						{tiles.map((t) => (
							<div key={t.label} className="oe-tile">
								<div className="oe-tile__label">{t.label}</div>
								<div className="oe-tile__value" style={t.danger ? { color: v('color.signal.negative-text') } : undefined}>
									{t.value}
								</div>
								<div className="oe-tile__foot">{t.foot}</div>
							</div>
						))}
					</div>
					{warnings.map((w) => (
						<div key={w.text} role="status" className={cx('oe-warning', w.danger ? dangerBox : warningBox)}>
							{w.text}
						</div>
					))}
				</section>

				<section style={sectionStyle} aria-labelledby="settings-leagues">
					<h2 className="oe-h2" id="settings-leagues">
						Ligák
					</h2>
					<p className="oe-muted m-0">Csak a követett ligák meccsei, tabellája és oddsa kerül tárolásra.</p>
					<ul style={listStyle}>
						{SETTINGS_LEAGUES.map((l) => (
							<Check
								key={l.id}
								checked={s.leagues.includes(l.id)}
								onChange={() => this.store.toggleLeague(l.id)}
								label={l.name}
								meta={`${l.country} · ${l.teams} csapat`}
								badges={[
									l.coverage.odds ? 'Odds' : 'Odds nincs',
									l.coverage.injuries ? 'Sérültek' : 'Sérültek nincs',
									l.coverage.statistics ? 'Statisztika' : 'Statisztika nincs'
								]}
								right={`≈ ${formatDecimal(e.leagueDaily.get(l.id) ?? 0, 1)} hívás/nap`}
							/>
						))}
					</ul>
				</section>

				<section style={sectionStyle} aria-labelledby="settings-markets">
					<h2 className="oe-h2" id="settings-markets">
						Piacok
					</h2>
					<div style={togglesStyle}>
						{SETTINGS_MARKETS.map((m) => (
							<button
								key={m.key}
								type="button"
								className={cx('oe-btn', toggleBtn)}
								aria-pressed={s.markets.includes(m.key)}
								onClick={() => this.store.toggleMarket(m.key)}
							>
								{m.label} · {m.hint}
							</button>
						))}
					</div>
				</section>

				<section style={sectionStyle} aria-labelledby="settings-bookmakers">
					<h2 className="oe-h2" id="settings-bookmakers">
						Fogadóirodák
					</h2>
					<p className="oe-muted m-0">
						A kiválasztott irodák oddsát tároljuk; a legjobb és az átlag odds a teljes válaszból számolódik.
					</p>
					<div style={togglesStyle}>
						{SETTINGS_BOOKMAKERS.map((b) => (
							<button
								key={b.id}
								type="button"
								className={cx('oe-btn', toggleBtn)}
								aria-pressed={s.bookmakers.includes(b.id)}
								onClick={() => this.store.toggleBookmaker(b.id)}
							>
								{b.name}
							</button>
						))}
					</div>
				</section>

				<section style={sectionStyle} aria-labelledby="settings-retention">
					<h2 className="oe-h2" id="settings-retention">
						Snapshot-megőrzés
					</h2>
					<div className="oe-segmented" role="group" aria-labelledby="settings-retention">
						{RETENTION_OPTIONS.map((o) => (
							<button
								key={o.key}
								type="button"
								className="oe-segmented__btn"
								aria-pressed={s.retention === o.key}
								onClick={() => this.store.setRetention(o.key)}
							>
								{o.label}
								<small>{o.hint}</small>
							</button>
						))}
					</div>
				</section>

				<section style={sectionStyle} aria-labelledby="settings-strategy">
					<h2 className="oe-h2" id="settings-strategy">
						Stratégia
					</h2>
					<div style={formGridStyle}>
						{NUMBER_FIELDS.map(({ field, label, hint }) => (
							<label key={field} className="oe-field">
								{label}
								<input
									className={input}
									inputMode="decimal"
									value={drafts[field]}
									aria-invalid={invalid[field] ? true : undefined}
									onChange={(ev) => this.changeNumber(field, ev.target.value)}
								/>
								<span style={invalid[field] ? errorStyle : fieldHintStyle}>{invalid[field] ?? hint}</span>
							</label>
						))}
					</div>
					<div className="oe-field">
						<span id="settings-unit">Alapegység (tét-lépcső a szelvényen: ½ / 1 / 2 / 5 egység)</span>
						<div className="oe-stake" role="group" aria-labelledby="settings-unit">
							{STAKE_UNITS.map((u) => (
								<button
									key={u}
									type="button"
									className="oe-btn"
									aria-pressed={s.stakeUnit === u}
									onClick={() => this.store.setStakeUnit(u)}
								>
									{formatFt(u)}
								</button>
							))}
						</div>
					</div>
					<div>
						<button type="button" className="oe-btn" onClick={this.reset}>
							Alapértékek visszaállítása
						</button>
					</div>
				</section>
			</>
		);
	}
}

export default SettingsPage;
