import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { FixtureResponse, OddsHistoryResponse } from '@football/contract';
import {
	formatKickoff,
	formatOdds,
	formatOddsChange,
	formatOddsPath,
	formatPairing,
	formatScore,
	loadWithCache,
	oddsHistoryMarkets,
	snapshotKindLabel,
	type CachedResult,
	type IHistoryRow
} from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, matchCacheKey } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): odds-mozgás grafikon (sparkline) a pontsor helyett.
// TODO(polish): bukméker-nevek – a quote csak `bookmakerId`-t ad.

type MatchData = { fixture: FixtureResponse; history: OddsHistoryResponse };
type State = { loading: boolean; result?: CachedResult<MatchData>; missingUrl?: boolean; badId?: boolean };
type Theme = ReturnType<typeof useRnTheme>;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

export default function MatchScreen() {
	const t = useRnTheme();
	const params = useLocalSearchParams<{ id: string }>();
	const id = Number(params.id);
	const [state, setState] = useState<State>({ loading: true });

	const load = useCallback(async () => {
		if (!Number.isInteger(id) || id <= 0) {
			setState({ loading: false, badId: true });
			return;
		}
		setState((s) => ({ ...s, loading: true }));
		const connection = await loadConnection();
		if (!connection.baseUrl) {
			setState({ loading: false, missingUrl: true });
			return;
		}
		const client = apiClientFor(connection);
		const result = await loadWithCache(asyncKeyValueStorage, matchCacheKey(id), async () => {
			const [fixture, history] = await Promise.all([client.getFixture(id), client.getOddsHistory(id)]);
			return { fixture, history };
		});
		setState({ loading: false, result });
	}, [id]);

	useFocusEffect(
		useCallback(() => {
			void load();
		}, [load])
	);

	const { result } = state;
	const markets = useMemo(
		() => (result && result.source !== 'none' ? oddsHistoryMarkets(result.data.history.snapshots) : []),
		[result]
	);
	const s = styles(t);

	if (state.badId) {
		return (
			<View style={s.center}>
				<Text style={s.body}>Érvénytelen meccs-azonosító.</Text>
			</View>
		);
	}
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

	const { fixture: f, history } = result.data;
	const home = f.homeTeamName ?? `#${f.homeTeamId}`;
	const away = f.awayTeamName ?? `#${f.awayTeamId}`;
	const played = f.goalsHome != null && f.goalsAway != null;
	const snaps = history.snapshots.length;

	return (
		<ScrollView
			contentContainerStyle={s.page}
			refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={t.color.accent.default} />}
		>
			<Stack.Screen options={{ title: formatPairing(home, away) }} />
			{result.source === 'cache' ? (
				<Text style={s.offline}>offline – utolsó frissítés: {formatKickoff(new Date(result.savedAt))}</Text>
			) : null}

			<View style={s.card}>
				<Text style={s.muted}>
					{formatKickoff(new Date(f.kickoffAt))} · {f.status}
					{f.round ? ` · ${f.round}` : ''}
				</Text>
				<View style={s.between}>
					<Text style={s.title}>{formatPairing(home, away)}</Text>
					{played ? <Text style={s.score}>{formatScore(f.goalsHome!, f.goalsAway!)}</Text> : null}
				</View>
				{f.referee ? <Text style={s.muted}>Játékvezető: {f.referee}</Text> : null}
			</View>

			<Text style={s.section}>Odds-mozgás</Text>
			<Text style={s.muted}>{snaps} pillanatkép · kimenetenként a legjobb odds, nyitó → legutóbbi</Text>
			{markets.length === 0 ? <Text style={s.muted}>Ehhez a meccshez nincs mentett odds.</Text> : null}
			{markets.map((m) => (
				<View key={m.key} style={s.card}>
					<Text style={s.cardTitle}>{m.label}</Text>
					{m.rows.map((row) => (
						<HistoryRow key={row.key} row={row} />
					))}
				</View>
			))}
		</ScrollView>
	);
}

function HistoryRow({ row }: { row: IHistoryRow }) {
	const t = useRnTheme();
	const s = styles(t);
	const tone =
		row.move === 'up' ? t.color.accent.text : row.move === 'down' ? t.color.signal['negative-text'] : t.color.text.muted;
	const last = row.points[row.points.length - 1];
	return (
		<View style={s.row}>
			<View style={s.between}>
				<Text style={s.body2}>{row.outcomeLabel}</Text>
				<Text style={s.num}>{formatOddsPath(row)}</Text>
				<Text style={[s.num, { color: tone, fontWeight: '700' }]}>{formatOddsChange(row.change)}</Text>
			</View>
			{row.points.length > 1 ? (
				<Text style={s.muted}>
					{row.points.map((p) => `${formatOdds(p.odd)}${p.kind ? ` (${snapshotKindLabel(p.kind)})` : ''}`).join(' · ')}
				</Text>
			) : null}
			<Text style={s.muted}>{last.bookmakerCount} iroda jegyzi</Text>
		</View>
	);
}

const styles = (t: Theme) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		page: { padding: t.space[8], gap: t.space[6] },
		between: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: t.space[4] },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[4]
		},
		row: { gap: t.space[1], borderTopWidth: 1, borderTopColor: t.color.border.default, paddingTop: t.space[3] },
		title: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '700', flexShrink: 1 },
		cardTitle: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '700' },
		score: { color: t.color.text.primary, fontSize: t.font.size['num-s'], fontWeight: '700' },
		section: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700', marginTop: t.space[4] },
		num: { color: t.color.text.primary, fontSize: t.font.size.small, fontVariant: ['tabular-nums'] },
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
