import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { BacktestResponse } from '@football/contract';
import {
	calibrationFlags,
	EN_DASH,
	EVAL_MARKETS,
	evaluationHeadChips,
	evaluationVerdict,
	formatClv,
	formatDecimal,
	formatEv,
	formatKickoff,
	formatPercent,
	formatPp,
	goalRows,
	loadWithCache,
	roiInterval,
	segmentOptions,
	selectSegment,
	type BacktestMarket,
	type BetSummary,
	type CachedResult,
	type GoalStatus,
	type VerdictTone
} from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, BACKTEST_CACHE_KEY } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): kalibrációs diagram (pontok az átló körül) a táblázat helyett; pontossági (Brier/log-loss) és bontás-táblák.
// TODO(polish): ROI-intervallum sáv grafikusan (a web `ciScale`-je alapján).

type State = { loading: boolean; result?: CachedResult<BacktestResponse>; missingUrl?: boolean };
type Theme = ReturnType<typeof useRnTheme>;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');
const count = (n: number): string => formatDecimal(n, 0);

export default function EvaluationScreen() {
	const t = useRnTheme();
	const [state, setState] = useState<State>({ loading: true });
	const [market, setMarket] = useState<BacktestMarket>('h2h');
	const [segment, setSegment] = useState('all');

	const load = useCallback(async () => {
		setState((s) => ({ ...s, loading: true }));
		const connection = await loadConnection();
		if (!connection.baseUrl) {
			setState({ loading: false, missingUrl: true });
			return;
		}
		const client = apiClientFor(connection);
		const result = await loadWithCache(asyncKeyValueStorage, BACKTEST_CACHE_KEY, () => client.getBacktest());
		setState({ loading: false, result });
	}, []);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	const s = styles(t);
	const { result } = state;

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

	const report = result.data;
	const marketMeta = EVAL_MARKETS.find((m) => m.key === market)!;
	const cmp = selectSegment(report, segment)[market];
	// A kalibráció csak piaconként, összesítve létezik (STATE „Nyitott hiányzó adat” 4.).
	const calibration = report.calibration[market];
	const verdict = evaluationVerdict(cmp, calibration);

	return (
		<ScrollView
			contentContainerStyle={s.page}
			refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={t.color.accent.default} />}
		>
			{result.source === 'cache' ? (
				<Text style={s.offline}>offline – utolsó frissítés: {formatKickoff(new Date(result.savedAt))}</Text>
			) : null}

			<View style={s.wrap}>
				{evaluationHeadChips(report).map((c) => (
					<Text key={c} style={s.chip}>
						{c}
					</Text>
				))}
			</View>

			<View style={s.segmented}>
				{EVAL_MARKETS.map((m) => (
					<Choice key={m.key} label={`${m.label} · ${m.hint}`} active={m.key === market} onPress={() => setMarket(m.key)} />
				))}
			</View>
			<View style={s.wrap}>
				{segmentOptions(report).map((o) => (
					<Choice
						key={o.key}
						label={o.key === 'all' ? 'Összes' : o.label}
						active={o.key === segment}
						onPress={() => setSegment(o.key)}
					/>
				))}
			</View>

			<View style={[s.card, s.verdict, { borderLeftColor: toneColor(t, verdict.tone) }]}>
				<Text style={s.title}>{verdict.title}</Text>
				<Text style={s.body2}>{verdict.text}</Text>
				<Text style={s.muted}>
					{verdict.met} / {verdict.total} PRD-cél teljesül
				</Text>
			</View>

			<Kpis bets={cmp.bets} />

			<Text style={s.section}>Sikermutatók</Text>
			<View style={s.card}>
				{goalRows(verdict.goals, marketMeta.label).map((g) => (
					<View key={g.key} style={s.goal}>
						<View style={s.grow}>
							<Text style={s.rowTitle}>{g.label}</Text>
							<Text style={s.muted}>
								{g.now} · cél: {g.target}
							</Text>
						</View>
						<Text style={[s.pill, pillStyle(t, g.status)]}>{g.pillText}</Text>
					</View>
				))}
			</View>

			<Text style={s.section}>Kalibráció ({marketMeta.label})</Text>
			<Text style={s.muted}>Becsült vs. tényleges gyakoriság sávonként · összesített adat (minden szezon és liga)</Text>
			<View style={s.card}>
				<View style={s.calRow}>
					{['Sáv', 'Becsült', 'Tényleges', 'Eltérés', 'n'].map((h) => (
						<Text key={h} style={[s.calCell, s.muted]}>
							{h}
						</Text>
					))}
				</View>
				{calibration
					.filter((b) => b.count > 0)
					.map((b) => {
						const f = calibrationFlags(b);
						const devColor = f.lowN ? t.color.data['low-n'] : f.flag ? t.color.signal.negative : t.color.text.primary;
						return (
							<View key={b.lower} style={s.calRow}>
								<Text style={[s.calCell, s.muted]}>
									{formatDecimal(b.lower * 100, 0)}
									{EN_DASH}
									{formatDecimal(b.upper * 100, 0)}%
								</Text>
								<Text style={s.calCell}>{formatPercent(b.meanP)}</Text>
								<Text style={s.calCell}>{formatPercent(b.hitRate)}</Text>
								<Text style={[s.calCell, { color: devColor }]}>{formatPp(f.deviationPp)}</Text>
								<Text style={[s.calCell, s.muted]}>{count(b.count)}</Text>
							</View>
						);
					})}
			</View>
		</ScrollView>
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

function Kpis({ bets: b }: { bets: BetSummary }) {
	const t = useRnTheme();
	const s = styles(t);
	const ci = b.roi !== null && b.roiStdError !== null ? roiInterval(b.roi, b.roiStdError) : null;
	const tiles: { label: string; value: string; foot: string; color?: string }[] = [
		{
			label: 'Value tippek',
			value: count(b.n),
			foot: `${count(b.wins)} talált · ${count(b.losses)} nem${b.voids ? ` · ${count(b.voids)} void` : ''}`
		},
		{
			label: 'Találati arány',
			value: b.hitRate === null ? '–' : formatPercent(b.hitRate),
			foot:
				b.expectedHitRate === null ? `${count(b.wins + b.losses)} elszámolt tipp` : `várt: ${formatPercent(b.expectedHitRate)}`,
			color: b.hitRate !== null && b.expectedHitRate !== null ? signColor(t, b.hitRate - b.expectedHitRate) : undefined
		},
		{
			label: 'ROI flat téttel',
			value: b.roi === null ? '–' : formatEv(b.roi),
			foot: ci ? `95%: ${formatEv(ci.lower)} … ${formatEv(ci.upper)}` : 'kevés tipp a sávhoz',
			color: b.roi === null ? undefined : signColor(t, b.roi)
		},
		{
			label: 'CLV',
			value: b.meanClv === null ? '–' : formatClv(b.meanClv),
			foot: 'ajánláskori / záró odds − 1',
			color: b.meanClv === null ? undefined : signColor(t, b.meanClv)
		}
	];
	return (
		<View style={s.kpis}>
			{tiles.map((k) => (
				<View key={k.label} style={[s.card, s.kpi]}>
					<Text style={s.muted}>{k.label}</Text>
					<Text style={[s.kpiValue, k.color ? { color: k.color } : null]}>{k.value}</Text>
					<Text style={s.muted}>{k.foot}</Text>
				</View>
			))}
		</View>
	);
}

const signColor = (t: Theme, x: number): string =>
	Math.abs(x) < 0.005 ? t.color.signal.neutral : x > 0 ? t.color.signal.positive : t.color.signal.negative;

const toneColor = (t: Theme, tone: VerdictTone): string =>
	tone === 'positive' ? t.color.signal.positive : tone === 'negative' ? t.color.signal.negative : t.color.signal.neutral;

const pillStyle = (t: Theme, status: GoalStatus) =>
	status === 'ok'
		? { backgroundColor: t.color.status['ok-bg'], color: t.color.status['ok-fg'] }
		: status === 'fail'
		? { backgroundColor: t.color.status['fail-bg'], color: t.color.status['fail-fg'] }
		: { backgroundColor: t.color.bg.inset, color: t.color.text.muted };

const styles = (t: Theme) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		page: { padding: t.space[8], gap: t.space[6] },
		wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] },
		chip: {
			color: t.color.text.secondary,
			backgroundColor: t.color.bg.raised,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[5],
			paddingVertical: t.space[2],
			fontSize: t.font.size.caption
		},
		segmented: { flexDirection: 'row', gap: t.space[3] },
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
		verdict: { borderLeftWidth: t.space[2] },
		kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[4] },
		kpi: { flexBasis: '47%', flexGrow: 1, gap: t.space[2] },
		kpiValue: { color: t.color.text.primary, fontSize: t.font.size['num-m'], fontWeight: '700' },
		section: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700', marginTop: t.space[4] },
		goal: { flexDirection: 'row', alignItems: 'center', gap: t.space[4] },
		grow: { flex: 1, gap: t.space[1] },
		rowTitle: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '600' },
		pill: {
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[4],
			paddingVertical: t.space[1],
			fontSize: t.font.size.caption,
			overflow: 'hidden'
		},
		calRow: { flexDirection: 'row', gap: t.space[2] },
		calCell: { flex: 1, color: t.color.text.primary, fontSize: t.font.size.small, fontVariant: ['tabular-nums'] },
		title: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '700' },
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
