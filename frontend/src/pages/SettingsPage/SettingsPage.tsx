import React, { Component, CSSProperties, ReactNode } from 'react';
import { IReactionDisposer, reaction } from 'mobx';
import { inject, observer } from 'mobx-react';
import { formatDecimal, formatFt, formatPercent } from '@football/core';
import PageHead from '../../components/PageIntro/PageHead';
import { v } from '../../design/tokens/tokens';
import { MainStore } from '../../stores/MainStore';
import type { SettingsSyncStatus } from '../../stores/SettingsStore';
import {
	DAILY_CALL_LIMIT,
	missingCoverage,
	NumberField,
	numberFieldText,
	parseNumberField,
	RETENTION_OPTIONS,
	SETTINGS_BOOKMAKERS,
	SETTINGS_MARKETS,
	SETTINGS_SECTIONS,
	SettingsSectionId,
	STAKE_UNITS,
	THEME_OPTIONS
} from './settingsView';
import { cx, dangerBox, input, warningBox } from '../../components/ui/oeClasses';
import SettingsNav from './components/SettingsNav';
import SaveBar from './components/SaveBar';
import TeamFilter from './components/TeamFilter';
import LeagueMarkets from './components/LeagueMarkets';

interface ISettingsPageProps {
	MainStore?: MainStore;
}

interface ISettingsPageState {
	texts: Record<NumberField, string>;
	invalid: Partial<Record<NumberField, string>>;
	active: SettingsSectionId;
}

const NUMBER_FIELDS: { field: NumberField; label: string; hint: string }[] = [
	{ field: 'evThreshold', label: 'EV-küszöb (%)', hint: 'Ennél kisebb várható értékű tippet nem ajánlunk.' },
	{ field: 'minOdds', label: 'Minimum odds', hint: 'Ennél kisebb oddsú tipp nem kerül a listára.' },
	{ field: 'maxOdds', label: 'Maximum odds', hint: 'Ennél nagyobb oddsú tipp nem kerül a listára.' },
	{ field: 'backfillReserve', label: 'Backfill-tartalék (hívás/nap)', hint: 'Ennyi hívást hagyunk a régi adatok pótlására.' }
];

const MB = 1024 * 1024;

/** Szinkron-jelző a fejben (I18a): a szerver az igazság, a localStorage csak gyorsítótár. */
const SYNC_LABEL: Record<SettingsSyncStatus, string | null> = {
	off: null,
	loading: 'Szerver: betöltés…',
	synced: 'Szerverrel szinkronban',
	offline: 'Szerver nem érhető el – csak helyi mentés'
};

const tilesStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} / 2)), 1fr))`,
	gap: v('space.6')
};
/** Tömör sorok rácsban (1440-en a liga-lista két oszlopban, egy képernyőn). */
const listStyle = (basis: string): CSSProperties => ({
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${basis}), 1fr))`,
	gap: v('space.3'),
	margin: 0,
	padding: 0,
	listStyle: 'none'
});
const rowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	gap: v('space.6'),
	minHeight: v('size.touch'),
	padding: `${v('space.3')} ${v('space.7')}`,
	background: v('color.bg.surface'),
	border: `1px solid ${v('color.border.default')}`,
	borderRadius: v('radius.l'),
	cursor: 'pointer'
};
const checkStyle: CSSProperties = {
	width: v('space.9'),
	height: v('space.9'),
	// Kiválasztás = semleges (DESIGN §1.3).
	accentColor: v('color.on.bg'),
	flex: 'none'
};
const rowMainStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	alignItems: 'center',
	gap: `${v('space.1')} ${v('space.4')}`,
	minWidth: 0,
	flex: 1
};
const rowNameStyle: CSSProperties = { fontWeight: v('font.weight.bold') };
const rowMetaStyle: CSSProperties = { fontSize: v('font.size.caption'), color: v('color.text.muted') };
const rowNumStyle: CSSProperties = {
	fontVariantNumeric: 'tabular-nums',
	fontSize: v('font.size.caption'),
	color: v('color.text.secondary'),
	whiteSpace: 'nowrap',
	textAlign: 'right'
};
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
	missing
}: {
	checked: boolean;
	onChange: () => void;
	label: string;
	meta?: string;
	right?: string;
	missing?: string[];
}) => (
	<li>
		<label style={rowStyle}>
			<input type="checkbox" checked={checked} onChange={onChange} style={checkStyle} />
			<span style={rowMainStyle}>
				<span style={rowNameStyle}>{label}</span>
				{meta && <span style={rowMetaStyle}>{meta}</span>}
				{missing?.map((m) => (
					<span key={m} className="oe-pill oe-pill--warning">
						{m}
					</span>
				))}
			</span>
			{right && <span style={rowNumStyle}>{right}</span>}
		</label>
	</li>
);

const Section = ({ id, title, sub, children }: { id: SettingsSectionId; title: string; sub?: string; children: ReactNode }) => (
	<section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-sp-16 flex-col gap-sp-6">
		<div>
			<h2 className="oe-h2" id={`${id}-title`}>
				{title}
			</h2>
			{sub && <p className="oe-muted m-0 mt-sp-2 text-small">{sub}</p>}
		</div>
		{children}
	</section>
);

/**
 * `/settings` – Beállítások (PRD 5.3, 5.8, 7.5; CHANGES 5.): szekció-menü, ligák (csak a hiányzó coverage), piacok és irodák,
 * tárolás, stratégia, megjelenés. A beállítások piszkozatként szerkeszthetők; a mentés-sáv mutatja a becslés változását.
 * A Megjelenés (téma) azonnal hat, nem része a piszkozatnak.
 * TODO(polish): a beállítás még nem hat az ajánlásokra (a `/` pillanatképe előre számolt).
 */
@inject('MainStore')
@observer
class SettingsPage extends Component<ISettingsPageProps, ISettingsPageState> {
	get store() {
		return this.props.MainStore!.SettingsStore;
	}

	state: ISettingsPageState = { texts: this.initialTexts(), invalid: {}, active: SETTINGS_SECTIONS[0].id };

	private disposeSync?: IReactionDisposer;

	componentDidMount() {
		window.addEventListener('scroll', this.onScroll, { passive: true });
		// A szerver-betöltés és az (aszinkron) mentés után a szövegmezők a piszkozatot kövessék (I18a).
		// mobx-react 7+: a `this.props` reakcióban nem olvasható (ROADMAP 9.2a), ezért a store-t előre kivesszük.
		const store = this.store;
		this.disposeSync = reaction(
			() => store.saved,
			() => !store.dirty && this.resync()
		);
	}

	componentWillUnmount() {
		window.removeEventListener('scroll', this.onScroll);
		this.disposeSync?.();
	}

	/** Aktív menüpont: az utolsó szekció, amelynek a teteje a képernyő felső harmadába ért (a lap alján az utolsó). */
	onScroll = () => {
		const limit = window.innerHeight / 3;
		let active: SettingsSectionId = SETTINGS_SECTIONS[0].id;
		for (const s of SETTINGS_SECTIONS) {
			const el = document.getElementById(s.id);
			if (el && el.getBoundingClientRect().top <= limit) active = s.id;
		}
		if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2)
			active = SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id;
		if (active !== this.state.active) this.setState({ active });
	};

	select = (id: SettingsSectionId) => {
		document.getElementById(id)?.scrollIntoView({ block: 'start' });
		this.setState({ active: id });
	};

	initialTexts(): Record<NumberField, string> {
		const s = this.props.MainStore!.SettingsStore.draft;
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
		this.setState((st) => ({ texts: { ...st.texts, [field]: text }, invalid: { ...st.invalid, [field]: error } }));
	};

	/** Piszkozat-csere után (Elvetés, Mentés, Alapértékek) a szövegmezők a piszkozatból újraíródnak. */
	resync = () => this.setState({ texts: this.initialTexts(), invalid: {} });

	reset = () => {
		this.store.reset();
		this.resync();
	};

	discard = () => {
		this.store.discard();
		this.resync();
	};

	save = () => this.store.save();

	render() {
		const { draft: s, estimate: e, warnings, dirty, diff, syncStatus, saving, saveError, leagues } = this.store;
		const theme = this.props.MainStore!.ThemeStore;
		const { texts, invalid, active } = this.state;
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
		// ≈ 170 px: mobilon két oszlop, asztalon a leghosszabb irodanév is elfér.
		const halfBasis = `calc(${v('size.aside-basis')} * 0.47)`;

		return (
			<>
				<PageHead
					title="Beállítások"
					chips={[
						`${s.leagues.length} / ${leagues.length} liga`,
						`${s.markets.length} / ${SETTINGS_MARKETS.length} piac`,
						`${s.bookmakers.length} / ${SETTINGS_BOOKMAKERS.length} iroda`,
						`keret: ${DAILY_CALL_LIMIT} hívás/nap`
					]}
					notice={
						<>
							{SYNC_LABEL[syncStatus] && (
								<span className={cx('oe-pill', syncStatus === 'offline' && 'oe-pill--warning')} role="status">
									{SYNC_LABEL[syncStatus]}
								</span>
							)}
							{dirty && <span className="oe-pill oe-pill--warning">Nem mentett változások</span>}
						</>
					}
				/>

				<section className="flex flex-col gap-sp-6" aria-label="Becslés">
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

				<div className="mt-sp-12 grid grid-cols-[minmax(0,1fr)] gap-sp-8 lg:grid-cols-[calc(var(--size-aside-basis)/2)_minmax(0,1fr)] lg:gap-sp-12">
					<SettingsNav active={active} onSelect={this.select} />

					<div className="flex min-w-0 flex-col gap-sp-16">
						<Section id="ligak" title="Ligák" sub="Csak a követett ligák meccsei, tabellája és oddsa kerül tárolásra.">
							<ul style={listStyle(v('size.aside-basis'))}>
								{leagues.map((l) => (
									<Check
										key={l.id}
										checked={s.leagues.includes(l.id)}
										onChange={() => this.store.toggleLeague(l.id)}
										label={l.name}
										meta={[l.country, `${l.teams} csapat`].filter(Boolean).join(' · ')}
										missing={missingCoverage(l)}
										right={`≈ ${formatDecimal(e.leagueDaily.get(l.id) ?? 0, 1)} hívás/nap`}
									/>
								))}
							</ul>
						</Section>

						<Section
							id="csapatok"
							title="Csapatszűrő"
							sub="Követett ligánként csapatok szűkítése vagy kizárása (alapból minden csapat)."
						>
							<TeamFilter store={this.store} />
						</Section>

						<Section
							id="piacok"
							title="Piacok és irodák"
							sub="A kiválasztott irodák oddsát tároljuk; a legjobb és az átlag odds a teljes válaszból számolódik."
						>
							<h3 className="oe-label">Piacok</h3>
							<ul style={listStyle(halfBasis)}>
								{SETTINGS_MARKETS.map((m) => (
									<Check
										key={m.key}
										checked={s.markets.includes(m.key)}
										onChange={() => this.store.toggleMarket(m.key)}
										label={m.label}
										meta={m.hint}
									/>
								))}
							</ul>
							<h3 className="oe-label">Ligánkénti piacok</h3>
							<LeagueMarkets store={this.store} />
							<h3 className="oe-label">Fogadóirodák</h3>
							<ul style={listStyle(halfBasis)}>
								{SETTINGS_BOOKMAKERS.map((b) => (
									<Check
										key={b.id}
										checked={s.bookmakers.includes(b.id)}
										onChange={() => this.store.toggleBookmaker(b.id)}
										label={b.name}
									/>
								))}
							</ul>
						</Section>

						<Section id="tarolas" title="Tárolás" sub="Hány odds-pillanatképet őrzünk meg meccsenként.">
							<div className="oe-segmented" role="group" aria-label="Snapshot-megőrzés">
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
						</Section>

						<Section id="strategia" title="Stratégia">
							<div style={formGridStyle}>
								{NUMBER_FIELDS.map(({ field, label, hint }) => (
									<label key={field} className="oe-field">
										{label}
										<input
											className={input}
											inputMode="decimal"
											value={texts[field]}
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
						</Section>

						<Section
							id="megjelenes"
							title="Megjelenés"
							sub="Azonnal hat, nem kell menteni; ugyanazt állítja, mint a fejléc váltója."
						>
							<div className="oe-segmented" role="group" aria-label="Téma">
								{THEME_OPTIONS.map((o) => (
									<button
										key={o.key}
										type="button"
										className="oe-segmented__btn"
										aria-pressed={theme.preference === o.key}
										onClick={() => theme.setPreference(o.key)}
									>
										{o.label}
									</button>
								))}
							</div>
						</Section>
					</div>
				</div>

				{dirty && <SaveBar diff={diff} saving={saving} error={saveError} onDiscard={this.discard} onSave={this.save} />}
			</>
		);
	}
}

export default SettingsPage;
