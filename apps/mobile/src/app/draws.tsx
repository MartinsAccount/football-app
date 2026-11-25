import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { DrawsResponse } from '@football/contract';
import {
	DRAW_FACTOR_LEGEND,
	DRAW_NOTE,
	DRAW_REPORT_PATH,
	drawRows,
	drawSubtitle,
	formatKickoff,
	loadWithCache,
	type CachedResult
} from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, DRAWS_CACHE_KEY } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

type Theme = ReturnType<typeof useRnTheme>;
type State = { loading: boolean; result?: CachedResult<DrawsResponse>; missingUrl?: boolean };

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

/**
 * Döntetlen-esélyek (D3, ROADMAP 12.8): a `GET /api/draws` (szerver-alap: most → +3 nap) top 10 p(X)-rangsora a core
 * `drawRows` nézet-modelljével, tényező-csipekkel (emeli / csökkenti a döntetlen-esélyt) és a „nem értéktipp” megjegyzéssel.
 * Hálózati hibánál az utolsó mentett válasz. TODO(polish): érintésre lenyíló tényező-indok helyett most a csip alatti sor.
 */
export default function DrawsScreen() {
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
		const result = await loadWithCache(asyncKeyValueStorage, DRAWS_CACHE_KEY, () => client.getDraws({ limit: 10 }));
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

	const res = result.data;
	const rows = drawRows(res, new Date());
	return (
		<ScrollView contentContainerStyle={s.page} refreshControl={refresh}>
			{result.source === 'cache' ? (
				<Text style={s.offline}>offline – utolsó frissítés: {formatKickoff(new Date(result.savedAt))}</Text>
			) : null}
			<Text style={s.muted}>{drawSubtitle(res)}</Text>

			{rows.length ? (
				rows.map((r) => (
					<View key={r.id} style={s.card}>
						<View style={s.row}>
							<View style={s.grow1}>
								<Text style={s.meta}>{r.meta}</Text>
								<Text style={s.title}>{r.title}</Text>
							</View>
							<View style={s.right}>
								<Text style={s.caption}>p(X)</Text>
								<Text style={s.prob}>{r.pDraw}</Text>
								<Text style={s.meta}>{r.market}</Text>
							</View>
						</View>
						{r.factors.length ? (
							<View style={s.chips}>
								{r.factors.map((f) => (
									<View key={f.key} style={s.chip} accessible accessibilityLabel={f.aria}>
										<Text style={[s.chipText, f.direction === 'up' ? s.up : s.down]}>{f.label}</Text>
										<Text style={s.caption}>{f.detail}</Text>
									</View>
								))}
							</View>
						) : null}
					</View>
				))
			) : (
				<Text style={s.body2}>A következő 3 napban nincs rangsorolható meccs (odds + gólmodell kell hozzá).</Text>
			)}

			<Text style={s.caption}>
				{DRAW_FACTOR_LEGEND} {DRAW_NOTE} A modell ({res.modelVersion}) a backtestben nem verte kimutathatóan a piaci rangsort;
				riport: {DRAW_REPORT_PATH}
			</Text>
		</ScrollView>
	);
}

const styles = (t: Theme) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		page: { padding: t.space[8], gap: t.space[6] },
		grow: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
		grow1: { flex: 1, gap: t.space[1] },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[4]
		},
		row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: t.space[4] },
		right: { alignItems: 'flex-end', gap: t.space[1] },
		title: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '700' },
		meta: { color: t.color.text.muted, fontSize: t.font.size.small, fontVariant: ['tabular-nums'] },
		prob: { color: t.color.text.primary, fontSize: t.font.size['num-l'], fontWeight: '700', fontVariant: ['tabular-nums'] },
		chips: { flexDirection: 'row', flexWrap: 'wrap', gap: t.space[3] },
		chip: {
			backgroundColor: t.color.bg.inset,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.m,
			paddingVertical: t.space[2],
			paddingHorizontal: t.space[4],
			gap: t.space[1],
			maxWidth: '100%'
		},
		chipText: { fontSize: t.font.size.small, fontWeight: '700' },
		up: { color: t.color.signal.positive },
		down: { color: t.color.text.secondary },
		body: { color: t.color.text.primary, fontSize: t.font.size.body, textAlign: 'center' },
		body2: { color: t.color.text.secondary, fontSize: t.font.size.body },
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
