import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { FixtureDto, FixturesResponse, ProfilePickDto } from '@football/contract';
import { formatKickoff, formatPairing, formatScore, loadWithCache, ownerPickChip, type CachedResult } from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage, FIXTURES_CACHE_KEY } from '@/lib/storage';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): ajánlás-nézet (tipp, EV, indoklás) a `/api/recommendations`-ből; addig a meccslista + „Te ezt raknád” csip (Q5).
const QUERY = { limit: 50 };

type State = {
	loading: boolean;
	result?: CachedResult<FixturesResponse>;
	missingUrl?: boolean;
	/** „Te ezt raknád” (Q5) a még le nem játszott meccsekre; „kevés adat” / hiba esetén üres. */
	picks?: Map<number, ProfilePickDto>;
};

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
		if (result.source === 'none') return;
		const open = result.data.fixtures.filter((f) => f.goalsHome == null).map((f) => f.id);
		if (!open.length) return;
		// A csip kiegészítő: hiba esetén nem jelenik meg. TODO(polish): az ajánlás-kimenettel való egyezés jelzése, ha a mobilon lesz ajánlás-lista.
		try {
			const res = await client.getProfilePicks(open);
			setState((st) => ({ ...st, picks: new Map(res.picks.map((p) => [p.fixtureId, p])) }));
		} catch {
			// offline / régi szerver
		}
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
			renderItem={({ item }) => <FixtureRow fixture={item} pick={state.picks?.get(item.id)} />}
		/>
	);
}

function FixtureRow({ fixture: f, pick }: { fixture: FixtureDto; pick?: ProfilePickDto }) {
	const s = styles(useRnTheme());
	const played = f.goalsHome != null && f.goalsAway != null;
	// Csapatnév, ha a szerver adja (M11a); különben `#id`.
	const pairing = formatPairing(f.homeTeamName ?? `#${f.homeTeamId}`, f.awayTeamName ?? `#${f.awayTeamId}`);
	const chip = pick ? ownerPickChip(pick) : null;
	return (
		<Link href={`/match/${f.id}`} asChild>
			<Pressable accessibilityRole="link" accessibilityLabel={`${pairing} részletei`} style={s.card}>
				<Text style={s.meta}>
					{formatKickoff(new Date(f.kickoffAt))} · {f.status}
					{f.round ? ` · ${f.round}` : ''}
				</Text>
				<View style={s.row}>
					<Text style={s.title}>{pairing}</Text>
					{played ? <Text style={s.score}>{formatScore(f.goalsHome!, f.goalsAway!)}</Text> : null}
				</View>
				{chip ? (
					<Text style={s.pick} accessibilityLabel={chip.aria}>
						{chip.label}
					</Text>
				) : null}
			</Pressable>
		</Link>
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
		row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space[4] },
		title: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '600', flexShrink: 1 },
		score: { color: t.color.text.primary, fontSize: t.font.size['num-s'], fontWeight: '700' },
		meta: { color: t.color.text.muted, fontSize: t.font.size.small },
		pick: {
			alignSelf: 'flex-start',
			color: t.color.text.secondary,
			fontSize: t.font.size.small,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[6],
			paddingVertical: t.space[2]
		},
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
