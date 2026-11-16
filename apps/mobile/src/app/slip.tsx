import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { RecommendationsResponse } from '@football/contract';
import {
	buildSavedSlip,
	buildSlipPresets,
	draftLegs,
	draftRows,
	draftTipFromItem,
	formatEv,
	formatFt,
	formatKickoff,
	formatOdds,
	formatPairing,
	formatPercent,
	loadStored,
	loadWithCache,
	oneInText,
	presetCandidates,
	savedSlipsCodec,
	saveStored,
	slipTypeName,
	summarizeSlip,
	type CachedResult,
	type ISavedSlip,
	type SlipDraftTip,
	type SlipPresetKind,
	type TransferStatus
} from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, RECOMMENDATIONS_CACHE_KEY } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): tét-lépcső a beállításokból (M9); mentett szelvény törlése / kiértékelése; kockázat-pill színezése.

type State = { loading: boolean; result?: CachedResult<RecommendationsResponse>; missingUrl?: boolean };
type Theme = ReturnType<typeof useRnTheme>;

const STAKES = [500, 1000, 2000, 5000];
const PRESET_NAME: Record<SlipPresetKind, string> = { single: 'Szingli', double: 'Dupla', treble: 'Hármas' };
const STATUS_TEXT: Record<TransferStatus, string> = {
	valid: 'megéri',
	below: 'min. odds alatt',
	missing: 'odds kell'
};

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

export default function SlipScreen() {
	const t = useRnTheme();
	const s = styles(t);
	const [state, setState] = useState<State>({ loading: true });
	const [selected, setSelected] = useState<string[]>([]);
	const [inputs, setInputs] = useState<Record<string, string>>({});
	const [stake, setStake] = useState(STAKES[1]);
	const [saved, setSaved] = useState<ISavedSlip[]>([]);

	const load = useCallback(async () => {
		setState((st) => ({ ...st, loading: true }));
		setSaved(await loadStored(asyncKeyValueStorage, savedSlipsCodec));
		const connection = await loadConnection();
		if (!connection.baseUrl) {
			setState({ loading: false, missingUrl: true });
			return;
		}
		const client = apiClientFor(connection);
		const result = await loadWithCache(asyncKeyValueStorage, RECOMMENDATIONS_CACHE_KEY, () => client.getRecommendations());
		setState({ loading: false, result });
	}, []);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	const { result } = state;
	// Meccsenként egy (a legnagyobb EV-jű) value tipp — a web szelvényével azonos szabály.
	const tips = useMemo<SlipDraftTip[]>(
		() => (result && result.source !== 'none' ? presetCandidates(result.data.items.map(draftTipFromItem)) : []),
		[result]
	);
	const presets = useMemo(() => buildSlipPresets(tips, stake), [tips, stake]);
	const chosen = tips.filter((tip) => selected.includes(tip.id));
	const rows = draftRows(chosen, inputs);
	const summary = chosen.length ? summarizeSlip(draftLegs(chosen, inputs), stake) : null;
	const toSave = buildSavedSlip(chosen, inputs, stake);

	const toggle = (id: string) => setSelected((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
	const save = async () => {
		const slip = buildSavedSlip(chosen, inputs, stake);
		if (!slip) return;
		const next = [slip, ...(await loadStored(asyncKeyValueStorage, savedSlipsCodec))];
		await saveStored(asyncKeyValueStorage, savedSlipsCodec, next);
		setSaved(next);
		setSelected([]);
		setInputs({});
	};

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
	if (result.source === 'none') {
		return (
			<View style={s.center}>
				<Text style={s.body}>Nem sikerült betölteni: {errorText(result.error)}</Text>
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

			{presets.length ? (
				<>
					<Text style={s.section}>Kész szelvények</Text>
					<View style={s.wrap}>
						{presets.map((p) => (
							<Pressable
								key={p.id}
								accessibilityRole="button"
								onPress={() => setSelected(p.legIds)}
								style={[s.card, s.preset, p.recommended && s.presetRecommended]}
							>
								<Text style={s.rowTitle}>
									{PRESET_NAME[p.kind]}
									{p.recommended ? ' · ajánlott' : ''}
								</Text>
								<Text style={s.muted}>
									{formatOdds(p.summary.combinedOdds)} · {formatPercent(p.summary.probability)} · EV {formatEv(p.summary.ev)}
								</Text>
							</Pressable>
						))}
					</View>
				</>
			) : null}

			<Text style={s.section}>Tippek</Text>
			{tips.length === 0 ? <Text style={s.muted}>Nincs value tipp a pillanatképben.</Text> : null}
			{tips.map((tip) => {
				const active = selected.includes(tip.id);
				return (
					<Pressable
						key={tip.id}
						accessibilityRole="checkbox"
						accessibilityState={{ checked: active }}
						onPress={() => toggle(tip.id)}
						style={[s.card, s.tip, active && s.tipActive]}
					>
						<View style={s.grow}>
							<Text style={s.rowTitle}>{formatPairing(tip.homeName, tip.awayName)}</Text>
							<Text style={s.muted}>
								{formatKickoff(new Date(tip.kickoff))} · {tip.tippmixLabel}
							</Text>
						</View>
						<View style={s.right}>
							<Text style={s.num}>{formatOdds(tip.bestOdds)}</Text>
							<Text style={s.muted}>min. {formatOdds(tip.minOdds)}</Text>
						</View>
					</Pressable>
				);
			})}

			{rows.length ? (
				<>
					<Text style={s.section}>Szelvény · {slipTypeName(rows.length)}</Text>
					<View style={s.card}>
						{rows.map((r) => (
							<View key={r.tip.id} style={s.leg}>
								<View style={s.grow}>
									<Text style={s.rowTitle}>{formatPairing(r.tip.homeName, r.tip.awayName)}</Text>
									<Text style={s.muted}>
										{r.tip.tippmixLabel} · min. {formatOdds(r.tip.minOdds)}
									</Text>
									<Text style={[s.status, { color: statusColor(t, r.status) }]}>{STATUS_TEXT[r.status]}</Text>
								</View>
								<TextInput
									value={r.input}
									onChangeText={(text) => setInputs((prev) => ({ ...prev, [r.tip.id]: text }))}
									placeholder="Tippmix-odds"
									placeholderTextColor={t.color.text.muted}
									keyboardType="decimal-pad"
									accessibilityLabel={`Tippmix-odds: ${formatPairing(r.tip.homeName, r.tip.awayName)}`}
									style={s.input}
								/>
							</View>
						))}
					</View>

					<View style={s.wrap}>
						{STAKES.map((v) => (
							<Pressable
								key={v}
								onPress={() => setStake(v)}
								accessibilityRole="button"
								accessibilityState={{ selected: v === stake }}
								style={[s.choice, v === stake && s.choiceActive]}
							>
								<Text style={[s.choiceText, v === stake && s.choiceTextActive]}>{formatFt(v)}</Text>
							</Pressable>
						))}
					</View>

					{summary ? (
						<View style={s.card}>
							<Line label="Eredő odds" value={formatOdds(summary.combinedOdds)} s={s} />
							<Line label="Találati esély" value={formatPercent(summary.probability)} s={s} />
							<Line label="EV" value={formatEv(summary.ev)} s={s} />
							<Line label="Lehetséges nyeremény" value={formatFt(summary.payout)} s={s} />
							<Line label="Várható nyereség" value={formatFt(summary.expectedProfit)} s={s} />
							<Text style={s.muted}>
								{oneInText(summary.probability)}
								{summary.estimated ? ' · becslés a legjobb oddsból, amíg nincs beírt Tippmix-odds' : ''}
							</Text>
						</View>
					) : null}

					<Pressable
						onPress={save}
						disabled={!toSave}
						accessibilityRole="button"
						accessibilityState={{ disabled: !toSave }}
						style={[s.primary, !toSave && s.primaryDisabled]}
					>
						<Text style={s.primaryText}>Megtettem – szelvény mentése</Text>
					</Pressable>
				</>
			) : null}

			<Text style={s.section}>Mentett szelvények</Text>
			{saved.length === 0 ? <Text style={s.muted}>Még nincs mentett szelvény.</Text> : null}
			{saved.map((slip) => (
				<View key={slip.id} style={s.card}>
					<Text style={s.rowTitle}>
						{slipTypeName(slip.legs.length)} · {formatFt(slip.stake)} · {formatOdds(slip.combinedOdds)}
					</Text>
					<Text style={s.muted}>
						{formatKickoff(new Date(slip.savedAt))} · {formatPercent(slip.probability)} · EV {formatEv(slip.ev)}
					</Text>
					{slip.legs.map((l) => (
						<Text key={l.tipId} style={s.body2}>
							{l.pairing} · {l.tippmixLabel} · {formatOdds(l.tippmixOdds)}
						</Text>
					))}
				</View>
			))}
		</ScrollView>
	);
}

function Line({ label, value, s }: { label: string; value: string; s: ReturnType<typeof styles> }) {
	return (
		<View style={s.line}>
			<Text style={s.body2}>{label}</Text>
			<Text style={s.num}>{value}</Text>
		</View>
	);
}

const statusColor = (t: Theme, status: TransferStatus): string =>
	status === 'valid' ? t.color.signal.positive : status === 'below' ? t.color.signal.negative : t.color.text.muted;

const styles = (t: Theme) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		page: { padding: t.space[8], gap: t.space[6] },
		wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[3]
		},
		preset: { flexBasis: '47%', flexGrow: 1 },
		presetRecommended: { borderColor: t.color.accent.default },
		tip: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
		tipActive: { borderColor: t.color.accent.default, backgroundColor: t.color.bg.raised },
		leg: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
		grow: { flex: 1, gap: t.space[1] },
		right: { alignItems: 'flex-end', gap: t.space[1] },
		line: { flexDirection: 'row', justifyContent: 'space-between' },
		section: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700', marginTop: t.space[4] },
		rowTitle: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '600' },
		num: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
		status: { fontSize: t.font.size.small, fontWeight: '600' },
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
			fontVariant: ['tabular-nums']
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
		primary: {
			minHeight: t.size.touch,
			justifyContent: 'center',
			alignItems: 'center',
			borderRadius: t.radius.m,
			backgroundColor: t.color.accent.default
		},
		primaryDisabled: { opacity: 0.5 },
		primaryText: { color: t.color.accent.on, fontSize: t.font.size.body, fontWeight: '700' },
		body: { color: t.color.text.primary, fontSize: t.font.size.body, textAlign: 'center' },
		body2: { color: t.color.text.secondary, fontSize: t.font.size.body },
		muted: { color: t.color.text.muted, fontSize: t.font.size.small },
		link: { color: t.color.accent.text, fontSize: t.font.size.body },
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
