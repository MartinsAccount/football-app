import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import {
	estimateSettings,
	formatDecimal,
	formatFt,
	missingCoverage,
	numberFieldText,
	parseNumberField,
	RETENTION_OPTIONS,
	sameSettings,
	sanitizeSettings,
	SETTINGS_BOOKMAKERS,
	SETTINGS_LEAGUES,
	SETTINGS_MARKETS,
	settingsDiff,
	settingsWarnings,
	STAKE_UNITS,
	stakeOptions,
	toggleSettingsItem,
	withSettingsNumber,
	type ISettings,
	type NumberField,
	type ThemePreference
} from '@football/core';
import { usePreferences } from '@/lib/preferences';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): szekció-menü (a web `SettingsNav`-ja), „elhagyod mentés nélkül?” figyelmeztetés, liga-katalógus a `/leagues`-ből.

type Theme = ReturnType<typeof useRnTheme>;

const THEMES: { key: ThemePreference; label: string }[] = [
	{ key: 'system', label: 'Rendszer' },
	{ key: 'dark', label: 'Sötét' },
	{ key: 'light', label: 'Világos' }
];

const NUMBER_FIELDS: { field: NumberField; label: string; unit: string }[] = [
	{ field: 'evThreshold', label: 'EV-küszöb', unit: '%' },
	{ field: 'minOdds', label: 'Min. odds', unit: '' },
	{ field: 'maxOdds', label: 'Max. odds', unit: '' }
];

const MB = 1024 * 1024;

const fieldTexts = (s: ISettings): Record<NumberField, string> => ({
	evThreshold: numberFieldText('evThreshold', s.evThreshold),
	minOdds: numberFieldText('minOdds', s.minOdds),
	maxOdds: numberFieldText('maxOdds', s.maxOdds),
	backfillReserve: numberFieldText('backfillReserve', s.backfillReserve)
});

/** Beállítások (PRD 5.3): a web `/settings` mentett formátuma (`oe_settings`); a téma azonnal hat, a többi Mentéssel. */
export default function PreferencesScreen() {
	const t = useRnTheme();
	const s = styles(t);
	const { loaded, settings, saveSettings, themePreference, setThemePreference } = usePreferences();
	const [draft, setDraft] = useState(settings);
	const [texts, setTexts] = useState(() => fieldTexts(settings));
	const [invalid, setInvalid] = useState<NumberField[]>([]);

	const reset = (next: ISettings) => {
		setDraft(next);
		setTexts(fieldTexts(next));
		setInvalid([]);
	};

	// A mentett érték aszinkron töltődik: betöltéskor (és mentés után) a piszkozat ahhoz igazodik.
	useEffect(() => reset(settings), [loaded, settings]);

	const estimate = useMemo(() => estimateSettings(draft), [draft]);
	const savedEstimate = useMemo(() => estimateSettings(settings), [settings]);
	const warnings = settingsWarnings(draft, estimate);
	const dirty = !sameSettings(settings, draft);

	const editNumber = (field: NumberField, text: string) => {
		setTexts((prev) => ({ ...prev, [field]: text }));
		const value = parseNumberField(field, text);
		const next = value === null ? null : withSettingsNumber(draft, field, value);
		setInvalid((xs) => (next ? xs.filter((x) => x !== field) : xs.includes(field) ? xs : [...xs, field]));
		if (next) setDraft(next);
	};

	return (
		<ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
			<Text style={s.section}>Megjelenés</Text>
			<Choices options={THEMES} value={themePreference} onChange={(key) => void setThemePreference(key)} s={s} />

			<Text style={s.section}>Tét alapegység</Text>
			<Choices
				options={STAKE_UNITS.map((u) => ({ key: u as number, label: formatFt(u) }))}
				value={draft.stakeUnit}
				onChange={(stakeUnit) => setDraft(sanitizeSettings({ ...draft, stakeUnit }))}
				s={s}
			/>
			<Text style={s.muted}>Szelvény tét-lépcső: {stakeOptions(draft.stakeUnit).map(formatFt).join(' · ')}</Text>

			<Text style={s.section}>Value-szűrő</Text>
			<View style={s.card}>
				{NUMBER_FIELDS.map(({ field, label, unit }) => (
					<NumberRow
						key={field}
						label={label}
						unit={unit}
						text={texts[field]}
						invalid={invalid.includes(field)}
						onChange={(text) => editNumber(field, text)}
						s={s}
						t={t}
					/>
				))}
			</View>

			<Text style={s.section}>Ligák</Text>
			<View style={s.card}>
				{SETTINGS_LEAGUES.map((l) => (
					<CheckRow
						key={l.id}
						label={l.name}
						hint={[l.country, ...missingCoverage(l)].join(' · ')}
						warn={missingCoverage(l).length > 0}
						checked={draft.leagues.includes(l.id)}
						onPress={() => setDraft(toggleSettingsItem(draft, 'leagues', l.id))}
						s={s}
					/>
				))}
			</View>

			<Text style={s.section}>Piacok</Text>
			<View style={s.card}>
				{SETTINGS_MARKETS.map((m) => (
					<CheckRow
						key={m.key}
						label={m.label}
						hint={m.hint}
						checked={draft.markets.includes(m.key)}
						onPress={() => setDraft(toggleSettingsItem(draft, 'markets', m.key))}
						s={s}
					/>
				))}
			</View>

			<Text style={s.section}>Irodák</Text>
			<View style={s.card}>
				{SETTINGS_BOOKMAKERS.map((b) => (
					<CheckRow
						key={b.id}
						label={b.name}
						checked={draft.bookmakers.includes(b.id)}
						onPress={() => setDraft(toggleSettingsItem(draft, 'bookmakers', b.id))}
						s={s}
					/>
				))}
			</View>

			<Text style={s.section}>Odds-tárolás</Text>
			<Choices
				options={RETENTION_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
				value={draft.retention}
				onChange={(retention) => setDraft(sanitizeSettings({ ...draft, retention }))}
				s={s}
			/>
			<View style={s.card}>
				<NumberRow
					label="Backfill-tartalék"
					unit="hívás/nap"
					text={texts.backfillReserve}
					invalid={invalid.includes('backfillReserve')}
					onChange={(text) => editNumber('backfillReserve', text)}
					s={s}
					t={t}
				/>
			</View>

			<Text style={s.section}>Becslés</Text>
			<View style={s.card}>
				<Line label="Napi hívás (tartalékkal)" value={formatDecimal(estimate.dailyWithReserve, 0)} s={s} />
				<Line label="Csúcsnap (tartalékkal)" value={formatDecimal(estimate.peakWithReserve, 0)} s={s} />
				<Line label="Tárhely / szezon" value={`${formatDecimal(estimate.storageBytes / MB, 1)} MB`} s={s} />
				{warnings.map((w) => (
					<Text key={w.text} style={[s.warning, w.danger && s.danger]}>
						{w.text}
					</Text>
				))}
			</View>

			{dirty ? <Text style={s.muted}>{settingsDiff(savedEstimate, estimate)}</Text> : null}
			<View style={s.actions}>
				<Pressable
					onPress={() => void saveSettings(draft)}
					disabled={!dirty || invalid.length > 0}
					accessibilityRole="button"
					accessibilityState={{ disabled: !dirty || invalid.length > 0 }}
					style={[s.primary, (!dirty || invalid.length > 0) && s.disabled]}
				>
					<Text style={s.primaryText}>Mentés</Text>
				</Pressable>
				<Pressable
					onPress={() => reset(settings)}
					disabled={!dirty}
					accessibilityRole="button"
					style={[s.secondary, !dirty && s.disabled]}
				>
					<Text style={s.secondaryText}>Elvetés</Text>
				</Pressable>
			</View>
			<Pressable onPress={() => reset(sanitizeSettings(null))} accessibilityRole="button" style={s.secondary}>
				<Text style={s.secondaryText}>Alapértékek (mentés kell hozzá)</Text>
			</Pressable>

			<Link href="/settings" style={s.link}>
				Kapcsolat (API-cím, token)
			</Link>
		</ScrollView>
	);
}

type Styles = ReturnType<typeof styles>;

function Choices<K extends string | number>({
	options,
	value,
	onChange,
	s
}: {
	options: { key: K; label: string }[];
	value: K;
	onChange: (key: K) => void;
	s: Styles;
}) {
	return (
		<View style={s.wrap}>
			{options.map((o) => (
				<Pressable
					key={o.key}
					onPress={() => onChange(o.key)}
					accessibilityRole="button"
					accessibilityState={{ selected: o.key === value }}
					style={[s.choice, o.key === value && s.choiceActive]}
				>
					<Text style={[s.choiceText, o.key === value && s.choiceTextActive]}>{o.label}</Text>
				</Pressable>
			))}
		</View>
	);
}

function CheckRow({
	label,
	hint,
	warn,
	checked,
	onPress,
	s
}: {
	label: string;
	hint?: string;
	warn?: boolean;
	checked: boolean;
	onPress: () => void;
	s: Styles;
}) {
	return (
		<Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }} style={s.row}>
			<View style={[s.box, checked && s.boxChecked]}>{checked ? <Text style={s.tick}>✓</Text> : null}</View>
			<View style={s.grow}>
				<Text style={s.rowTitle}>{label}</Text>
				{hint ? <Text style={[s.muted, warn && s.warning]}>{hint}</Text> : null}
			</View>
		</Pressable>
	);
}

function NumberRow({
	label,
	unit,
	text,
	invalid,
	onChange,
	s,
	t
}: {
	label: string;
	unit: string;
	text: string;
	invalid: boolean;
	onChange: (text: string) => void;
	s: Styles;
	t: Theme;
}) {
	return (
		<View style={s.row}>
			<View style={s.grow}>
				<Text style={s.rowTitle}>{label}</Text>
				{invalid ? <Text style={s.danger}>Érvénytelen érték</Text> : null}
			</View>
			<TextInput
				value={text}
				onChangeText={onChange}
				keyboardType="decimal-pad"
				accessibilityLabel={label}
				placeholderTextColor={t.color.text.muted}
				style={[s.input, invalid && s.inputInvalid]}
			/>
			{unit ? <Text style={s.muted}>{unit}</Text> : null}
		</View>
	);
}

function Line({ label, value, s }: { label: string; value: string; s: Styles }) {
	return (
		<View style={s.line}>
			<Text style={s.body2}>{label}</Text>
			<Text style={s.num}>{value}</Text>
		</View>
	);
}

const styles = (t: Theme) =>
	StyleSheet.create({
		page: { padding: t.space[8], gap: t.space[6] },
		section: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700', marginTop: t.space[4] },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[3]
		},
		wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] },
		row: { flexDirection: 'row', alignItems: 'center', gap: t.space[4], minHeight: t.size.touch },
		grow: { flex: 1, gap: t.space[1] },
		line: { flexDirection: 'row', justifyContent: 'space-between', gap: t.space[4] },
		actions: { flexDirection: 'row', gap: t.space[4] },
		box: {
			width: t.space[10],
			height: t.space[10],
			borderWidth: 1,
			borderColor: t.color.border.strong,
			borderRadius: t.radius.s,
			alignItems: 'center',
			justifyContent: 'center'
		},
		boxChecked: { backgroundColor: t.color.accent.default, borderColor: t.color.accent.default },
		tick: { color: t.color.accent.on, fontSize: t.font.size.small, fontWeight: '700' },
		rowTitle: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '600' },
		num: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
		body2: { color: t.color.text.secondary, fontSize: t.font.size.body },
		muted: { color: t.color.text.muted, fontSize: t.font.size.small },
		warning: { color: t.color.signal['warning-text'], fontSize: t.font.size.small },
		danger: { color: t.color.signal['negative-text'], fontSize: t.font.size.small },
		input: {
			minHeight: t.size.touch,
			minWidth: t.size.touch * 2,
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.s,
			paddingHorizontal: t.space[4],
			color: t.color.text.primary,
			backgroundColor: t.color.bg.inset,
			fontSize: t.font.size.body,
			fontVariant: ['tabular-nums'],
			textAlign: 'right'
		},
		inputInvalid: { borderColor: t.color.signal.negative },
		choice: {
			minHeight: t.size.touch,
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[6]
		},
		choiceActive: { backgroundColor: t.color.accent.default, borderColor: t.color.accent.default },
		choiceText: { color: t.color.text.secondary, fontSize: t.font.size.small },
		choiceTextActive: { color: t.color.accent.on, fontWeight: '600' },
		primary: {
			flex: 1,
			minHeight: t.size.touch,
			justifyContent: 'center',
			alignItems: 'center',
			borderRadius: t.radius.m,
			backgroundColor: t.color.accent.default
		},
		primaryText: { color: t.color.accent.on, fontSize: t.font.size.body, fontWeight: '700' },
		secondary: {
			flex: 1,
			minHeight: t.size.touch,
			justifyContent: 'center',
			alignItems: 'center',
			borderRadius: t.radius.m,
			borderWidth: 1,
			borderColor: t.color.border.strong
		},
		secondaryText: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '600' },
		disabled: { opacity: 0.5 },
		link: { color: t.color.accent.text, fontSize: t.font.size.body, marginTop: t.space[4] }
	});
