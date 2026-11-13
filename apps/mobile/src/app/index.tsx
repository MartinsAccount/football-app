import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { FixtureDto, FixturesResponse } from '@football/contract';
import { formatKickoff, formatPairing, formatScore, loadWithCache, type CachedResult } from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, FIXTURES_CACHE_KEY } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): ajánlás-nézet (tipp, EV, indoklás), ha az olvasó API ad ajánlás-végpontot; addig a meccslista.
// TODO(polish): csapatnevek – a FixtureDto csak csapat-id-t ad.
const QUERY = { limit: 50 };

type State = { loading: boolean; result?: CachedResult<FixturesResponse>; missingUrl?: boolean };

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

export default function FixturesScreen() {
	const t = useRnTheme();
	const [state, setState] = useState<State>({ loading: true });

	const load = useCallback(async () => {
		setState((s) => ({ ...s, loading: true }));
		const connection = await loadConnection();
		if (!connection.baseUrl) {
			setState({ loading: false, missingUrl: true });
			return;
		}
		const client = apiClientFor(connection);
		const result = await loadWithCache(asyncKeyValueStorage, FIXTURES_CACHE_KEY, () => client.listFixtures(QUERY));
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

	const fixtures = result.data.fixtures;
	const savedAt = new Date(result.savedAt);
	return (
		<FlatList
			data={fixtures}
			keyExtractor={(f) => String(f.id)}
			contentContainerStyle={s.list}
			refreshControl={<RefreshControl refreshing={state.loading} onRefresh={load} tintColor={t.color.accent.default} />}
			ListHeaderComponent={
				<View style={s.header}>
					{result.source === 'cache' ? <Text style={s.offline}>offline – utolsó frissítés: {formatKickoff(savedAt)}</Text> : null}
					<Text style={s.muted}>
						{fixtures.length} / {result.data.total} meccs
					</Text>
				</View>
			}
			ListEmptyComponent={<Text style={s.muted}>Nincs meccs.</Text>}
			renderItem={({ item }) => <FixtureRow fixture={item} />}
		/>
	);
}

function FixtureRow({ fixture: f }: { fixture: FixtureDto }) {
	const s = styles(useRnTheme());
	const played = f.goalsHome != null && f.goalsAway != null;
	return (
		<View style={s.card}>
			<Text style={s.meta}>
				{formatKickoff(new Date(f.kickoffAt))} · {f.status}
				{f.round ? ` · ${f.round}` : ''}
			</Text>
			<View style={s.row}>
				<Text style={s.title}>{formatPairing(`#${f.homeTeamId}`, `#${f.awayTeamId}`)}</Text>
				{played ? <Text style={s.score}>{formatScore(f.goalsHome!, f.goalsAway!)}</Text> : null}
			</View>
		</View>
	);
}

const styles = (t: ReturnType<typeof useRnTheme>) =>
	StyleSheet.create({
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		list: { padding: t.space[8], gap: t.space[4] },
		header: { gap: t.space[2], marginBottom: t.space[4] },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[2]
		},
		row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
		title: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '600' },
		score: { color: t.color.text.primary, fontSize: t.font.size['num-s'], fontWeight: '700' },
		meta: { color: t.color.text.muted, fontSize: t.font.size.small },
		body: { color: t.color.text.primary, fontSize: t.font.size.body, textAlign: 'center' },
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
