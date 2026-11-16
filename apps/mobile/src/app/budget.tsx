import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { BudgetResponse } from '@football/contract';
import { budgetView, formatKickoff, loadWithCache, type BudgetTone, type CachedResult } from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, BUDGET_CACHE_KEY } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): a fejléc-pill (`12/100 hívás`) a Meccsek képernyőn is, ha lesz tab-navigáció / hely a fejlécben.

type Theme = ReturnType<typeof useRnTheme>;
type State = { loading: boolean; result?: CachedResult<BudgetResponse>; missingUrl?: boolean };

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

/**
 * API-keret (I21, ROADMAP 2.4 mobil): a `GET /api/budget` válaszából a core `budgetView` nézet-modellje – mai felhasznált /
 * maradék hívás, jobonkénti bontás, `/status`-egyeztetés, ütemező-összesítő. Hálózati hibánál az utolsó mentett válasz.
 */
export default function BudgetScreen() {
	const t = useRnTheme();
	const s = styles(t);
	const [state, setState] = useState<State>({ loading: true });

	const load = useCallback(async () => {
		setState((st) => ({ ...st, loading: true }));
		const connection = await loadConnection();
		if (!connection.baseUrl) {
			setState({ loading: false, missingUrl: true });
			return;
		}
		const client = apiClientFor(connection);
		const result = await loadWithCache(asyncKeyValueStorage, BUDGET_CACHE_KEY, () => client.getBudget());
		setState({ loading: false, result });
	}, []);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

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

	const refresh = <RefreshControl refreshing={state.loading} onRefresh={load} tintColor={t.color.accent.default} />;
	if (result.source === 'none') {
		return (
			<ScrollView contentContainerStyle={[s.page, s.grow]} refreshControl={refresh}>
				<Text style={s.body}>Nem sikerült betölteni: {errorText(result.error)}</Text>
				<Text style={s.muted}>Húzd le az újratöltéshez, vagy ellenőrizd a kapcsolatot.</Text>
			</ScrollView>
		);
	}

	const v = budgetView(result.data);
	const tone = toneColor(t, v.tone);
	return (
		<ScrollView contentContainerStyle={s.page} refreshControl={refresh}>
			{result.source === 'cache' ? (
				<Text style={s.offline}>offline – utolsó frissítés: {formatKickoff(new Date(result.savedAt))}</Text>
			) : null}

			<View style={s.card}>
				<View style={s.row}>
					<Text style={s.title}>Mai API-keret</Text>
					<Text style={[s.pill, { color: tone }]}>{v.pill}</Text>
				</View>
				<View
					style={s.track}
					accessibilityRole="progressbar"
					accessibilityValue={{ min: 0, max: 100, now: v.usedPct }}
					accessibilityLabel="A napi keret felhasznált része"
				>
					<View style={[s.fill, { width: `${v.usedPct}%`, backgroundColor: tone }]} />
				</View>
				<View style={s.stats}>
					{v.stats.map((st) => (
						<View key={st.label} style={s.stat}>
							<Text style={s.muted}>{st.label}</Text>
							<Text style={s.statValue}>{st.value}</Text>
						</View>
					))}
				</View>
				<Text style={s.caption}>{result.data.day} (UTC)</Text>
			</View>

			<View style={s.card}>
				<Text style={s.section}>Jobonként</Text>
				{v.jobs.length ? (
					v.jobs.map((j) => (
						<View key={j.key} style={s.row}>
							<Text style={s.body2}>{j.label}</Text>
							<Text style={s.num}>
								{j.live}
								{j.mock ? <Text style={s.muted}> (+{j.mock} mock)</Text> : null}
							</Text>
						</View>
					))
				) : (
					<Text style={s.muted}>Ma még nem volt hívás.</Text>
				)}
			</View>

			<View style={s.card}>
				<Text style={s.section}>Egyeztetés és ütemező</Text>
				<Text style={v.reconciliation.state === 'drift' ? s.warning : s.body2}>{v.reconciliation.text}</Text>
				<Text style={s.body2}>{v.cron}</Text>
			</View>
		</ScrollView>
	);
}

const toneColor = (t: Theme, tone: BudgetTone): string =>
	tone === 'danger' ? t.color.signal.negative : tone === 'warning' ? t.color.signal.warning : t.color.signal.positive;

const styles = (t: Theme) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		page: { padding: t.space[8], gap: t.space[6] },
		grow: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[4]
		},
		row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space[4] },
		title: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '700' },
		section: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700' },
		pill: { fontSize: t.font.size.body, fontWeight: '700', fontVariant: ['tabular-nums'] },
		track: { height: t.space[3], backgroundColor: t.color.bg.inset, borderRadius: t.radius.pill, overflow: 'hidden' },
		fill: { height: '100%', borderRadius: t.radius.pill },
		stats: { flexDirection: 'row', gap: t.space[4] },
		stat: { flex: 1, gap: t.space[1] },
		statValue: { color: t.color.text.primary, fontSize: t.font.size['num-m'], fontWeight: '700', fontVariant: ['tabular-nums'] },
		num: { color: t.color.text.primary, fontSize: t.font.size.body, fontVariant: ['tabular-nums'] },
		body: { color: t.color.text.primary, fontSize: t.font.size.body, textAlign: 'center' },
		body2: { color: t.color.text.secondary, fontSize: t.font.size.body },
		warning: { color: t.color.signal['warning-text'], fontSize: t.font.size.body },
		muted: { color: t.color.text.muted, fontSize: t.font.size.small },
		caption: { color: t.color.text.muted, fontSize: t.font.size.caption },
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
