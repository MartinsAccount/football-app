import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { ArbitrageResponse } from '@football/contract';
import {
	ARB_BAND_OPTIONS,
	arbitrageHeadChips,
	arbitrageRows,
	arbitrageTiles,
	DEFAULT_TOTAL_STAKE,
	defaultArbitrageFilter,
	formatDecimal,
	formatKickoff,
	historicalNotice,
	loadWithCache,
	MIN_TOTAL_STAKE,
	parseTotalStake,
	reviveArbitrageSnapshot,
	type CachedResult,
	type IArbFilter,
	type IArbRow
} from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { ARBITRAGE_CACHE_KEY, asyncKeyValueStorage } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): iroda-szűrő (a web `IArbFilter.bookmaker`-e) – most mindig 'all'.
// TODO(polish): tab-navigáció; most a Beállítások képernyőről nyílik (a fejlécbe nem fért 4. link).

type State = { loading: boolean; result?: CachedResult<ArbitrageResponse>; missingUrl?: boolean };
type Theme = ReturnType<typeof useRnTheme>;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

export default function ArbitrageScreen() {
	const t = useRnTheme();
	const [state, setState] = useState<State>({ loading: true });
	// `undefined` = a pillanatkép alapszűrője (van arbitrázs → „Arbitrázs”, különben „Közeli”).
	const [band, setBand] = useState<IArbFilter['band']>();
	const [market, setMarket] = useState('all');
	const [stakeText, setStakeText] = useState(String(DEFAULT_TOTAL_STAKE));

	const load = useCallback(async () => {
		setState((s) => ({ ...s, loading: true }));
		const connection = await loadConnection();
		if (!connection.baseUrl) {
			setState({ loading: false, missingUrl: true });
			return;
		}
		const client = apiClientFor(connection);
		const result = await loadWithCache(asyncKeyValueStorage, ARBITRAGE_CACHE_KEY, () => client.getArbitrage());
		setState({ loading: false, result });
	}, []);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	const { result } = state;
	const snap = useMemo(() => (result && result.source !== 'none' ? reviveArbitrageSnapshot(result.data) : null), [result]);
	const parsedStake = parseTotalStake(stakeText);
	const totalStake = parsedStake ?? DEFAULT_TOTAL_STAKE;
	const filter: IArbFilter | null = snap
		? { band: band ?? defaultArbitrageFilter(snap, totalStake).band, market, bookmaker: 'all' }
		: null;
	const rows = snap && filter ? arbitrageRows(snap, filter, totalStake) : [];

	const s = styles(t);

	if (state.missingUrl) {
		return (
			<View style={s.center}>
				<Text style={s.body}>Nincs beállítva API-cím.</Text>
				<Link href="/settings" style={s.link}>
					Kapcsolat beállítása
				</Link>
			</View>
		);
	}
	if (!result) {
		return (
			<View style={s.center}>
				<ActivityIndicator color={t.color.accent.default} />
			</View>
		);
	}
	if (result.source === 'none' || !snap || !filter) {
		return (
			<View style={s.center}>
				<Text style={s.body}>Nem sikerült betölteni: {result.source === 'none' ? errorText(result.error) : ''}</Text>
				<Text style={s.muted}>Húzd le az újratöltéshez, vagy ellenőrizd a kapcsolatot.</Text>
			</View>
		);
	}

	return (
		<ScrollView
			contentContainerStyle={s.page}
			keyboardShouldPersistTaps="handled"
			refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={t.color.accent.default} />}
		>
			{result.source === 'cache' ? (
				<Text style={s.offline}>offline – utolsó frissítés: {formatKickoff(new Date(result.savedAt))}</Text>
			) : null}
			<Text style={s.notice}>{historicalNotice(snap.source)}</Text>

			<View style={s.wrap}>
				{arbitrageHeadChips(snap).map((c) => (
					<Text key={c} style={s.chip}>
						{c}
					</Text>
				))}
			</View>

			<View style={s.kpis}>
				{arbitrageTiles(snap, totalStake).map((k) => (
					<View key={k.label} style={[s.card, s.kpi]}>
						<Text style={s.muted}>{k.label}</Text>
						<Text style={[s.kpiValue, k.positive ? { color: t.color.accent.text } : null]}>{k.value}</Text>
						<Text style={s.muted}>{k.foot}</Text>
					</View>
				))}
			</View>

			<View style={s.wrap}>
				{ARB_BAND_OPTIONS.map((o) => (
					<Choice key={o.key} label={o.label} active={o.key === filter.band} onPress={() => setBand(o.key)} />
				))}
			</View>
			<Text style={s.muted}>{ARB_BAND_OPTIONS.find((o) => o.key === filter.band)?.hint}</Text>
			<View style={s.wrap}>
				<Choice label="Minden piac" active={market === 'all'} onPress={() => setMarket('all')} />
				{snap.markets.map((m) => (
					<Choice key={m.key} label={m.label} active={m.key === market} onPress={() => setMarket(m.key)} />
				))}
			</View>
			<View style={s.stakeRow}>
				<Text style={s.body2}>Összes tét (Ft)</Text>
				<TextInput
					value={stakeText}
					onChangeText={setStakeText}
					keyboardType="number-pad"
					accessibilityLabel="Összes tét forintban"
					placeholderTextColor={t.color.text.muted}
					style={[s.input, parsedStake === null && s.inputInvalid]}
				/>
			</View>
			{parsedStake === null ? (
				<Text style={s.negative}>
					Legalább {formatDecimal(MIN_TOTAL_STAKE, 0)} Ft; addig {formatDecimal(DEFAULT_TOTAL_STAKE, 0)} Ft-tal számol.
				</Text>
			) : null}

			<Text style={s.section}>{rows.length} piac</Text>
			{rows.length === 0 ? <Text style={s.muted}>Nincs a szűrőnek megfelelő piac.</Text> : null}
			{rows.map((row) => (
				<ArbCard key={row.key} row={row} />
			))}
		</ScrollView>
	);
}

function ArbCard({ row }: { row: IArbRow }) {
	const t = useRnTheme();
	const s = styles(t);
	// Accent csak a kerekítve is nyereséges arbitrázsnak (a web `ArbitrageCard` szabálya).
	const tone =
		row.band === 'arb' ? t.color.accent.text : row.band === 'near' ? t.color.signal['warning-text'] : t.color.text.muted;
	return (
		<View style={[s.card, row.band === 'arb' && s.cardSelected]}>
			<View style={s.between}>
				<Text style={s.muted}>{row.league}</Text>
				<Text style={s.muted}>{row.kickoff}</Text>
			</View>
			<View>
				<Text style={s.title}>{row.pairing}</Text>
				<Text style={s.muted}>
					{row.market} · {row.bookmakerCount} iroda
				</Text>
			</View>
			<View style={s.stats}>
				<Text style={[s.pill, row.band === 'arb' ? s.pillAccent : null]}>{row.bandLabel}</Text>
				<Text style={s.num}>Σ 1/odds {row.sum}</Text>
				<Text style={[s.num, { color: tone, fontWeight: '700' }]}>{row.margin}</Text>
			</View>
			<View style={s.legRow}>
				{['Kimenet', 'Iroda', 'Odds', 'Tét'].map((h) => (
					<Text key={h} style={[s.legCell, s.muted]}>
						{h}
					</Text>
				))}
			</View>
			{row.legs.map((l) => (
				<View key={l.outcome} style={s.legRow}>
					<Text style={s.legCell}>{l.outcome}</Text>
					<Text style={s.legCell}>{l.bookmaker}</Text>
					<Text style={[s.legCell, { fontWeight: '700' }]}>{l.odds}</Text>
					<Text style={s.legCell}>{l.stake}</Text>
				</View>
			))}
			<View style={s.between}>
				<Text style={s.muted}>Kifizetés (legrosszabb): {row.payout}</Text>
				<Text
					style={[
						s.num,
						{ fontWeight: '700', color: row.profitPositive ? t.color.accent.text : t.color.signal['negative-text'] }
					]}
				>
					{row.profit}
				</Text>
			</View>
		</View>
	);
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
	const s = styles(useRnTheme());
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			style={[s.choice, active && s.choiceActive]}
		>
			<Text style={[s.choiceText, active && s.choiceTextActive]}>{label}</Text>
		</Pressable>
	);
}

const styles = (t: Theme) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		page: { padding: t.space[8], gap: t.space[6] },
		wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] },
		between: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: t.space[4] },
		chip: {
			color: t.color.text.secondary,
			backgroundColor: t.color.bg.raised,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[5],
			paddingVertical: t.space[2],
			fontSize: t.font.size.caption
		},
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
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[4]
		},
		cardSelected: { backgroundColor: t.color.bg.selected, borderColor: t.color.accent.default },
		kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[4] },
		kpi: { flexBasis: '47%', flexGrow: 1, gap: t.space[2] },
		kpiValue: { color: t.color.text.primary, fontSize: t.font.size['num-m'], fontWeight: '700' },
		section: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700', marginTop: t.space[4] },
		stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.space[5] },
		num: { color: t.color.text.primary, fontSize: t.font.size.small, fontVariant: ['tabular-nums'] },
		pill: {
			color: t.color.text.secondary,
			backgroundColor: t.color.bg.inset,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[4],
			paddingVertical: t.space[1],
			fontSize: t.font.size.caption,
			overflow: 'hidden'
		},
		pillAccent: { backgroundColor: t.color.accent.default, color: t.color.accent.on },
		legRow: { flexDirection: 'row', gap: t.space[2] },
		legCell: { flex: 1, color: t.color.text.primary, fontSize: t.font.size.small, fontVariant: ['tabular-nums'] },
		stakeRow: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
		input: {
			minHeight: t.size.touch,
			minWidth: t.size.touch * 2,
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.s,
			paddingHorizontal: t.space[4],
			color: t.color.text.primary,
			fontSize: t.font.size.body
		},
		inputInvalid: { borderColor: t.color.signal.negative },
		title: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '700' },
		body: { color: t.color.text.primary, fontSize: t.font.size.body, textAlign: 'center' },
		body2: { color: t.color.text.secondary, fontSize: t.font.size.body },
		muted: { color: t.color.text.muted, fontSize: t.font.size.small },
		negative: { color: t.color.signal['negative-text'], fontSize: t.font.size.small },
		link: { color: t.color.accent.text, fontSize: t.font.size.body },
		notice: {
			color: t.color.text.secondary,
			backgroundColor: t.color.bg.inset,
			borderRadius: t.radius.s,
			padding: t.space[4],
			fontSize: t.font.size.small
		},
		offline: {
			color: t.color.signal['warning-text'],
			backgroundColor: t.color.tint['warning-bg'],
			borderColor: t.color.tint['warning-border'],
			borderWidth: 1,
			borderRadius: t.radius.s,
			padding: t.space[4],
			fontSize: t.font.size.small
		}
	});
