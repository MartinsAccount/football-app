import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { teamFilterMode, withTeamFilter, type ISettings, type ISettingsLeague, type TeamFilterMode } from '@football/core';
import type { LeagueTeamsResponse } from '@football/contract';
import { useRnTheme } from '@/lib/theme';

// Csapatszűrő (I18c a weben, I18d mobilon): a követett ligák csapatai, csapatonként Mind / Csak / Kizár; a piszkozatba ír.
// TODO(polish): keresőmező hosszú csapatlistához, csapatlogó.

type Theme = ReturnType<typeof useRnTheme>;
type TeamsState = 'loading' | 'error' | LeagueTeamsResponse;

const MODES: readonly { mode: TeamFilterMode | null; label: string }[] = [
	{ mode: null, label: 'Mind' },
	{ mode: 'include', label: 'Csak' },
	{ mode: 'exclude', label: 'Kizár' }
];

export function TeamFilterSection({
	draft,
	leagues,
	loadTeams,
	onChange
}: {
	draft: ISettings;
	leagues: readonly ISettingsLeague[];
	loadTeams: (leagueId: number) => Promise<LeagueTeamsResponse>;
	onChange: (next: ISettings) => void;
}) {
	const t = useRnTheme();
	const s = styles(t);
	const [picked, setPicked] = useState<number | null>(null);
	const [byLeague, setByLeague] = useState<ReadonlyMap<number, TeamsState>>(new Map());
	const leagueId = picked !== null && draft.leagues.includes(picked) ? picked : draft.leagues[0] ?? null;
	const state = leagueId === null ? null : byLeague.get(leagueId) ?? null;

	const needsLoad = leagueId !== null && state === null;

	// Ligánként egyszer tölt; hiba után a liga chipjére koppintás újrapróbálja (törli a hibás bejegyzést).
	useEffect(() => {
		if (!needsLoad || leagueId === null) return;
		const set = (next: TeamsState) => setByLeague((m) => new Map(m).set(leagueId, next));
		set('loading');
		loadTeams(leagueId).then(set, () => set('error'));
	}, [needsLoad, leagueId, loadTeams]);

	if (leagueId === null) return <Text style={s.muted}>Előbb jelölj ki legalább egy követett ligát.</Text>;
	const name = (id: number) => leagues.find((l) => l.id === id)?.name ?? `#${id}`;

	return (
		<View style={s.card}>
			<View style={s.wrap}>
				{draft.leagues.map((id) => (
					<Pressable
						key={id}
						onPress={() => {
							setPicked(id);
							if (byLeague.get(id) === 'error')
								setByLeague((m) => {
									const next = new Map(m);
									next.delete(id);
									return next;
								});
						}}
						accessibilityRole="button"
						accessibilityState={{ selected: id === leagueId }}
						style={[s.chip, id === leagueId && s.chipActive]}
					>
						<Text style={[s.chipText, id === leagueId && s.chipTextActive]}>{name(id)}</Text>
					</Pressable>
				))}
			</View>
			{state === 'loading' || state === null ? <Text style={s.muted}>Csapatok betöltése…</Text> : null}
			{state === 'error' ? <Text style={s.muted}>A csapatlista nem érhető el (nincs szerver-kapcsolat).</Text> : null}
			{state && typeof state === 'object' && state.teams.length === 0 ? (
				<Text style={s.muted}>Ehhez a ligához még nincs tárolt csapat.</Text>
			) : null}
			{state && typeof state === 'object'
				? state.teams.map((team) => {
						const mode = teamFilterMode(draft.teamFilters, team.id);
						return (
							<View key={team.id} style={s.row}>
								<Text style={s.team} numberOfLines={1}>
									{team.name}
								</Text>
								<View style={s.segmented} accessibilityLabel={`${team.name} szűrése`}>
									{MODES.map((m) => (
										<Pressable
											key={m.label}
											onPress={() => onChange({ ...draft, teamFilters: withTeamFilter(draft.teamFilters, team.id, m.mode) })}
											accessibilityRole="button"
											accessibilityState={{ selected: m.mode === mode }}
											style={[s.segment, m.mode === mode && s.chipActive]}
										>
											<Text style={[s.chipText, m.mode === mode && s.chipTextActive]}>{m.label}</Text>
										</Pressable>
									))}
								</View>
							</View>
						);
				  })
				: null}
		</View>
	);
}

const styles = (t: Theme) =>
	StyleSheet.create({
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
		team: { flex: 1, color: t.color.text.primary, fontSize: t.font.size.body },
		segmented: {
			flexDirection: 'row',
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.pill,
			overflow: 'hidden'
		},
		segment: { minHeight: t.size.touch, justifyContent: 'center', paddingHorizontal: t.space[4] },
		chip: {
			minHeight: t.size.touch,
			justifyContent: 'center',
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[6]
		},
		chipActive: { backgroundColor: t.color.accent.default, borderColor: t.color.accent.default },
		chipText: { color: t.color.text.secondary, fontSize: t.font.size.small },
		chipTextActive: { color: t.color.accent.on, fontWeight: '600' },
		muted: { color: t.color.text.muted, fontSize: t.font.size.small }
	});
