import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, useFocusEffect } from 'expo-router';
import type { ApiClient, ProfileResponse, QuizAnswerResponse } from '@football/contract';
import {
	answerRows,
	answerVerdict,
	CONFIDENCE_OPTIONS,
	crossValidationTiles,
	profileProgress,
	profileStatus,
	questionMeta,
	questionTitle,
	quizFormAria,
	RESULT_LETTER,
	SKIP_BUTTON,
	sourcesText,
	tablePositionText,
	type IAnswerButton,
	type MatchResult,
	type QuizChoice,
	type QuizQuestion,
	type QuizTeam,
	type QuizTone
} from '@football/core';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { useRnTheme } from '@/lib/theme';

// TODO(polish): válasz-előzmények, „vissza az előzőre”; profil-súlyok lenyitóban (mint a web TODO-ja).

type Theme = ReturnType<typeof useRnTheme>;
type Styles = ReturnType<typeof styles>;
type Loadable<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

const errorText = (error: unknown): string => (error instanceof Error ? error.message : 'Ismeretlen hiba');

/**
 * Saját stílus (ROADMAP 12.4): a web `/quiz` mobil párja – lejátszott meccs nyitó adatai, tipp (vagy kihagyás) bizalommal,
 * utána a valós eredmény és „Következő”; alatta a profilblokk. Szövegek/formázók: core `profile/quizView`. Adat: DB (0 külső hívás).
 */
export default function QuizScreen() {
	const t = useRnTheme();
	const s = styles(t);
	const client = useRef<ApiClient | null>(null);
	const [missingUrl, setMissingUrl] = useState(false);
	const [question, setQuestion] = useState<Loadable<QuizQuestion | null>>({ status: 'loading' });
	const [profile, setProfile] = useState<Loadable<ProfileResponse>>({ status: 'loading' });
	const [confidence, setConfidence] = useState<1 | 2 | 3 | undefined>();
	const [chosen, setChosen] = useState<QuizChoice | undefined>();
	const [answer, setAnswer] = useState<QuizAnswerResponse | undefined>();
	const [submitError, setSubmitError] = useState<string | undefined>();

	const loadProfile = useCallback(async () => {
		if (!client.current) return;
		try {
			setProfile({ status: 'ready', data: await client.current.getProfile() });
		} catch (e) {
			setProfile({ status: 'error', message: errorText(e) });
		}
	}, []);

	const loadQuestion = useCallback(async () => {
		setChosen(undefined);
		setAnswer(undefined);
		setSubmitError(undefined);
		setQuestion({ status: 'loading' });
		if (!client.current) {
			const connection = await loadConnection();
			if (!connection.baseUrl) {
				setMissingUrl(true);
				return;
			}
			setMissingUrl(false);
			client.current = apiClientFor(connection);
			void loadProfile();
		}
		try {
			setQuestion({ status: 'ready', data: (await client.current.getQuizQuestion()).question });
		} catch (e) {
			setQuestion({ status: 'error', message: errorText(e) });
		}
	}, [loadProfile]);

	// Fókuszkor csak akkor tölt, ha még nincs kliens (a Kapcsolat képernyőről visszatérve) – egy félbehagyott kérdést nem cserél.
	useFocusEffect(
		useCallback(() => {
			if (!client.current) void loadQuestion();
		}, [loadQuestion])
	);

	const submit = async (q: QuizQuestion, pick: QuizChoice) => {
		if (!client.current) return;
		setChosen(pick);
		setSubmitError(undefined);
		try {
			const res = await client.current.answerQuiz({
				fixtureId: q.fixtureId,
				pick,
				...(confidence && pick !== 'skip' ? { confidence } : {})
			});
			setAnswer(res);
			void loadProfile();
		} catch (e) {
			setChosen(undefined);
			setSubmitError(errorText(e));
		}
	};

	if (missingUrl)
		return (
			<View style={s.center}>
				<Text style={s.body}>Nincs beállítva API-cím.</Text>
				<Link href="/settings" style={s.link}>
					Kapcsolat beállítása
				</Link>
			</View>
		);

	return (
		<ScrollView contentContainerStyle={s.page}>
			{question.status === 'loading' ? (
				<ActivityIndicator color={t.color.accent.default} />
			) : question.status === 'error' ? (
				<View style={s.card}>
					<Text style={s.danger}>{question.message}</Text>
					<Button label="Újra" onPress={() => void loadQuestion()} s={s} />
				</View>
			) : !question.data ? (
				<View style={s.card}>
					<Text style={s.h2}>Elfogytak a kérdések</Text>
					<Text style={s.body}>
						Minden lejátszott, nyitó oddsszal mentett meccsre válaszoltál. Új meccsek a betöltés után jönnek.
					</Text>
				</View>
			) : (
				<QuestionCard
					q={question.data}
					confidence={confidence}
					setConfidence={setConfidence}
					chosen={chosen}
					answer={answer}
					submitError={submitError}
					onPick={(pick) => void submit(question.data as QuizQuestion, pick)}
					onNext={() => void loadQuestion()}
					s={s}
					t={t}
				/>
			)}
			{profile.status === 'ready' ? (
				<ProfileBlock data={profile.data} s={s} />
			) : profile.status === 'error' ? (
				<View style={s.card}>
					<Text style={s.danger}>{profile.message}</Text>
				</View>
			) : null}
		</ScrollView>
	);
}

function QuestionCard({
	q,
	confidence,
	setConfidence,
	chosen,
	answer,
	submitError,
	onPick,
	onNext,
	s,
	t
}: {
	q: QuizQuestion;
	confidence?: 1 | 2 | 3;
	setConfidence: (c: 1 | 2 | 3 | undefined) => void;
	chosen?: QuizChoice;
	answer?: QuizAnswerResponse;
	submitError?: string;
	onPick: (pick: QuizChoice) => void;
	onNext: () => void;
	s: Styles;
	t: Theme;
}) {
	const verdict = answer && answerVerdict(q, answer);
	const pickButton = (b: IAnswerButton) => {
		const pressed = chosen === b.pick;
		return (
			<Pressable
				key={b.pick}
				onPress={() => onPick(b.pick)}
				disabled={chosen !== undefined}
				accessibilityRole="button"
				accessibilityState={{ selected: pressed, disabled: chosen !== undefined }}
				accessibilityLabel={b.odds ? `${b.label}, odds ${b.odds}` : b.label}
				style={[s.pick, pressed && s.pickPressed, chosen !== undefined && !pressed && s.disabled]}
			>
				<Text style={[s.pickLabel, pressed && s.pickLabelPressed]}>{b.label}</Text>
				{b.odds ? <Text style={[s.num, pressed && s.pickLabelPressed]}>{b.odds}</Text> : null}
			</Pressable>
		);
	};
	return (
		<View style={s.card}>
			<Text style={s.label}>{questionMeta(q)}</Text>
			<Text style={s.h2}>{questionTitle(q)}</Text>
			<View style={s.teams}>
				<Team team={q.home} side="Hazai" s={s} t={t} />
				<Team team={q.away} side="Vendég" s={s} t={t} />
			</View>
			<Text style={s.label}>Mit raknál meg? (nyitó odds)</Text>
			{answerRows(q).map((row, i) => (
				<View key={i} style={s.row}>
					{row.map(pickButton)}
				</View>
			))}
			<View style={s.row}>{pickButton(SKIP_BUTTON)}</View>
			<Text style={s.muted}>Mennyire vagy biztos? (nem kötelező)</Text>
			<View style={s.row}>
				{CONFIDENCE_OPTIONS.map((o) => (
					<Pressable
						key={o.value}
						onPress={() => setConfidence(confidence === o.value ? undefined : o.value)}
						disabled={chosen !== undefined}
						accessibilityRole="button"
						accessibilityState={{ selected: confidence === o.value, disabled: chosen !== undefined }}
						style={[s.choice, confidence === o.value && s.choiceActive, chosen !== undefined && s.disabled]}
					>
						<Text style={[s.choiceText, confidence === o.value && s.choiceTextActive]}>{o.label}</Text>
					</Pressable>
				))}
			</View>
			{submitError ? <Text style={s.danger}>{submitError}</Text> : null}
			{verdict ? (
				<View style={[s.verdict, s[TONE_STYLE[verdict.tone]]]} accessibilityRole="summary">
					<Text style={s.h3}>
						{verdict.icon} {verdict.title}
					</Text>
					<Text style={s.body}>{verdict.text}</Text>
				</View>
			) : null}
			{answer ? <Button label="Következő" onPress={onNext} s={s} /> : null}
		</View>
	);
}

const TONE_STYLE: Record<QuizTone, 'tonePositive' | 'toneNegative' | 'toneNeutral'> = {
	positive: 'tonePositive',
	negative: 'toneNegative',
	neutral: 'toneNeutral'
};

function Team({ team, side, s, t }: { team: QuizTeam; side: string; s: Styles; t: Theme }) {
	const chipColor: Record<MatchResult, string> = { W: t.color.result.win, D: t.color.result.draw, L: t.color.result.loss };
	return (
		<View style={s.team}>
			<Text style={s.muted}>
				{side} · tabella: {tablePositionText(team)}
			</Text>
			<Text style={s.rowTitle} numberOfLines={1}>
				{team.name}
			</Text>
			<View style={s.form} accessible accessibilityLabel={quizFormAria(team)}>
				{team.form.map((r, i) => (
					<View key={i} style={[s.chip, { backgroundColor: chipColor[r] }]}>
						<Text style={s.chipText}>{RESULT_LETTER[r]}</Text>
					</View>
				))}
			</View>
		</View>
	);
}

function ProfileBlock({ data, s }: { data: ProfileResponse; s: Styles }) {
	const { profile, crossValidation, sources } = data;
	const status = profileStatus(profile);
	const progress = profileProgress(profile);
	const cv = crossValidationTiles(crossValidation);
	return (
		<View style={s.card}>
			<View style={s.between}>
				<Text style={s.h2}>Saját profil</Text>
				<Text style={[s.pill, status.state === 'stale' && s.warning]}>{status.label}</Text>
			</View>
			<View style={s.between}>
				<Text style={s.body}>{progress.text}</Text>
				{profile.skipped > 0 ? <Text style={s.muted}>{profile.skipped} kihagyva</Text> : null}
			</View>
			<View style={s.track} accessible accessibilityLabel={progress.aria}>
				<View style={[s.fill, { width: progress.width as `${number}%` }]} />
			</View>
			{profile.traits.length > 0 ? (
				<>
					<Text style={s.label}>Ilyen tippelő vagy</Text>
					{profile.traits.map((trait) => (
						<Text key={trait} style={s.body}>
							• {trait}
						</Text>
					))}
				</>
			) : (
				<Text style={s.muted}>A profil 20 tippes válasz után áll össze; addig a kihagyás is tanít.</Text>
			)}
			{cv ? (
				<>
					<View style={s.row}>
						<View style={s.tile}>
							<Text style={s.muted}>Egyezés veled</Text>
							{/* Accent csak, ha a profil többször egyezik, mint a favorit-baseline (DESIGN §1.3). */}
							<Text style={[s.tileValue, cv.better && s.accent]}>{cv.agreement}</Text>
						</View>
						<View style={s.tile}>
							<Text style={s.muted}>Mindig a favorit</Text>
							<Text style={s.tileValue}>{cv.baseline}</Text>
						</View>
					</View>
					<Text style={s.muted}>{cv.foot}</Text>
				</>
			) : null}
			<Text style={s.muted}>Forrás: {sourcesText(sources)}</Text>
		</View>
	);
}

function Button({ label, onPress, s }: { label: string; onPress: () => void; s: Styles }) {
	return (
		<Pressable onPress={onPress} accessibilityRole="button" style={s.secondary}>
			<Text style={s.secondaryText}>{label}</Text>
		</Pressable>
	);
}

const styles = (t: Theme) =>
	StyleSheet.create({
		page: { padding: t.space[8], gap: t.space[6] },
		center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.space[4], padding: t.space[8] },
		card: {
			backgroundColor: t.color.bg.surface,
			borderColor: t.color.border.default,
			borderWidth: 1,
			borderRadius: t.radius.l,
			padding: t.space[6],
			gap: t.space[4]
		},
		h2: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700' },
		h3: { color: t.color.text.primary, fontSize: t.font.size.lead, fontWeight: '700' },
		label: { color: t.color.text.muted, fontSize: t.font.size.small, fontWeight: '600' },
		body: { color: t.color.text.secondary, fontSize: t.font.size.body },
		muted: { color: t.color.text.muted, fontSize: t.font.size.small },
		danger: { color: t.color.signal['negative-text'], fontSize: t.font.size.small },
		warning: { color: t.color.signal['warning-text'] },
		accent: { color: t.color.accent.text },
		link: { color: t.color.accent.text, fontSize: t.font.size.body },
		rowTitle: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '700' },
		num: { color: t.color.text.secondary, fontSize: t.font.size.small, fontVariant: ['tabular-nums'] },
		teams: { flexDirection: 'row', gap: t.space[6] },
		team: { flex: 1, minWidth: 0, gap: t.space[2] },
		form: { flexDirection: 'row', gap: t.space[2] },
		chip: {
			minWidth: t.space[10],
			height: t.space[10],
			borderRadius: t.radius.s,
			alignItems: 'center',
			justifyContent: 'center',
			paddingHorizontal: t.space[1]
		},
		chipText: { color: t.color.result.on, fontSize: t.font.size.small, fontWeight: '700' },
		row: { flexDirection: 'row', gap: t.space[4] },
		between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: t.space[4] },
		pick: {
			flex: 1,
			minHeight: t.size.touch,
			alignItems: 'center',
			justifyContent: 'center',
			paddingVertical: t.space[3],
			borderRadius: t.radius.m,
			borderWidth: 1,
			borderColor: t.color.border.strong,
			backgroundColor: t.color.bg.raised
		},
		pickPressed: { backgroundColor: t.color.accent.default, borderColor: t.color.accent.default },
		pickLabel: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '600' },
		pickLabelPressed: { color: t.color.accent.on },
		choice: {
			flex: 1,
			minHeight: t.size.touch,
			justifyContent: 'center',
			alignItems: 'center',
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.pill
		},
		choiceActive: { backgroundColor: t.color.accent.default, borderColor: t.color.accent.default },
		choiceText: { color: t.color.text.secondary, fontSize: t.font.size.small },
		choiceTextActive: { color: t.color.accent.on, fontWeight: '600' },
		verdict: { borderWidth: 1, borderRadius: t.radius.m, padding: t.space[6], gap: t.space[2] },
		tonePositive: { backgroundColor: t.color.tint['positive-bg'], borderColor: t.color.tint['positive-border'] },
		toneNegative: { backgroundColor: t.color.tint['negative-bg'], borderColor: t.color.tint['negative-border'] },
		toneNeutral: { backgroundColor: t.color.bg.inset, borderColor: t.color.border.default },
		pill: {
			color: t.color.text.secondary,
			fontSize: t.font.size.small,
			borderWidth: 1,
			borderColor: t.color.border.default,
			borderRadius: t.radius.pill,
			paddingHorizontal: t.space[4],
			paddingVertical: t.space[1]
		},
		track: { height: t.space[3], borderRadius: t.radius.pill, backgroundColor: t.color.data.track, overflow: 'hidden' },
		fill: { height: '100%', backgroundColor: t.color.accent.default },
		tile: { flex: 1, gap: t.space[1], padding: t.space[4], borderRadius: t.radius.m, backgroundColor: t.color.bg.inset },
		tileValue: { color: t.color.text.primary, fontSize: t.font.size.h3, fontWeight: '700', fontVariant: ['tabular-nums'] },
		secondary: {
			minHeight: t.size.touch,
			justifyContent: 'center',
			alignItems: 'center',
			borderRadius: t.radius.m,
			borderWidth: 1,
			borderColor: t.color.border.strong
		},
		secondaryText: { color: t.color.text.primary, fontSize: t.font.size.body, fontWeight: '600' },
		disabled: { opacity: 0.5 }
	});
