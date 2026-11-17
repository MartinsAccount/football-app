import {
	formatDateTime,
	formatOdds,
	formatPairing,
	formatPercent,
	formatScore,
	MIN_PROFILE_SAMPLES,
	type MatchResult,
	type OwnerProfile,
	type ProfileCrossValidation,
	type QuizPick,
	type QuizQuestion,
	type QuizTeam
} from '@football/core';
import type { ProfileResponse, QuizAnswerResponse, QuizResultDto } from '@football/contract';
import { RESULT_LETTER } from '../../components/TipCard/tipView';

/** A kvíz-válasz gombjai: tipp vagy kihagyás. */
export type QuizChoice = QuizPick | 'skip';

export interface IAnswerButton {
	pick: QuizChoice;
	label: string;
	/** Nyitó odds (formázva); kihagyásnál nincs. */
	odds?: string;
}

const PICK_LABEL: Record<QuizChoice, string> = {
	'1': '1',
	X: 'X',
	'2': '2',
	over: 'Több mint 2,5',
	under: 'Kevesebb',
	skip: 'Kihagynám'
};

/** Hosszabb címke a visszajelzéshez („a tipped: …”). */
const PICK_TEXT: Record<QuizChoice, string> = {
	'1': 'hazai győzelem (1)',
	X: 'döntetlen (X)',
	'2': 'vendéggyőzelem (2)',
	over: 'több mint 2,5 gól',
	under: 'legfeljebb 2 gól',
	skip: 'kihagytad'
};

/** Az 1X2 sor (mindig) és az O/U 2,5 sor (ha van rá nyitó odds); a kihagyás külön gomb. */
export const answerRows = (q: QuizQuestion): IAnswerButton[][] => {
	const rows: IAnswerButton[][] = [
		[
			{ pick: '1', label: PICK_LABEL['1'], odds: formatOdds(q.odds1x2.home) },
			{ pick: 'X', label: PICK_LABEL.X, odds: formatOdds(q.odds1x2.draw) },
			{ pick: '2', label: PICK_LABEL['2'], odds: formatOdds(q.odds1x2.away) }
		]
	];
	if (q.oddsOu25)
		rows.push([
			{ pick: 'over', label: PICK_LABEL.over, odds: formatOdds(q.oddsOu25.over) },
			{ pick: 'under', label: PICK_LABEL.under, odds: formatOdds(q.oddsOu25.under) }
		]);
	return rows;
};

export const SKIP_BUTTON: IAnswerButton = { pick: 'skip', label: PICK_LABEL.skip };

export const CONFIDENCE_OPTIONS: { value: 1 | 2 | 3; label: string }[] = [
	{ value: 1, label: 'Kicsit' },
	{ value: 2, label: 'Közepesen' },
	{ value: 3, label: 'Nagyon' }
];

/** „Premier League · 2024. jan. 20. 16:00” */
export const questionMeta = (q: QuizQuestion): string => `${q.league.name} · ${formatDateTime(new Date(q.kickoff))}`;

export const questionTitle = (q: QuizQuestion): string => formatPairing(q.home.name, q.away.name);

/** Tabellahely: „3.” vagy „–” (szezon eleje). */
export const tablePositionText = (team: QuizTeam): string => (team.tablePosition === null ? '–' : `${team.tablePosition}.`);

export const formLetters = (form: readonly MatchResult[]): string[] => form.map((r) => RESULT_LETTER[r]);

/** Forma-sor felolvasása (DESIGN §10): „Arsenal utolsó 5: Gy D V Gy Gy”; forma nélkül „nincs adat”. */
export const quizFormAria = (team: QuizTeam): string =>
	team.form.length
		? `${team.name} utolsó ${team.form.length}: ${formLetters(team.form).join(' ')}`
		: `${team.name}: nincs forma-adat`;

/** „Valós eredmény: Arsenal – Chelsea 2–0 (1, több mint 2,5 gól)” */
export const resultText = (q: QuizQuestion, r: QuizResultDto): string =>
	`${questionTitle(q)} ${formatScore(r.homeGoals, r.awayGoals)} (${r.outcome}, ${
		r.over25 ? 'több mint 2,5 gól' : 'legfeljebb 2 gól'
	})`;

export type QuizTone = 'positive' | 'negative' | 'neutral';

/** Visszajelzés a válasz után: cím, szöveg, hangulat (`.oe-verdict[data-tone]`). */
export const answerVerdict = (
	q: QuizQuestion,
	res: QuizAnswerResponse
): { title: string; text: string; tone: QuizTone; icon: string } => {
	const text = `Valós eredmény: ${resultText(q, res.result)}. A tipped: ${PICK_TEXT[res.answer.pick]}.`;
	if (res.correct === null) return { title: 'Kihagytad', text, tone: 'neutral', icon: '–' };
	return res.correct
		? { title: 'Talált', text, tone: 'positive', icon: '✓' }
		: { title: 'Nem talált', text, tone: 'negative', icon: '✗' };
};

/** Profil-haladás a megbízható profilig (20 nem-skip válasz). */
export const profileProgress = (profile: OwnerProfile): { text: string; width: string; aria: string } => {
	const done = Math.min(profile.answered, MIN_PROFILE_SAMPLES);
	const width = `${Math.round((done / MIN_PROFILE_SAMPLES) * 100)}%`;
	return {
		text: `${profile.answered} / ${MIN_PROFILE_SAMPLES} válasz`,
		width,
		aria: `${profile.answered} tippes válasz a profilhoz szükséges ${MIN_PROFILE_SAMPLES}-ból`
	};
};

/** Állapot-pill: `ok` → „Profil kész”, különben „Kevés adat” (`data-state="stale"` → figyelmeztető pötty). */
export const profileStatus = (profile: OwnerProfile): { label: string; state?: 'stale' } =>
	profile.status === 'ok' ? { label: 'Profil kész' } : { label: 'Kevés adat', state: 'stale' };

/** Keresztvalidált egyezés vs. „mindig a favorit”; „kevés adat” esetén `null`. */
export const crossValidationTiles = (
	cv: ProfileCrossValidation
): { agreement: string; baseline: string; foot: string; better: boolean } | null =>
	cv.status === 'ok' && cv.evaluated > 0
		? {
				agreement: formatPercent(cv.agreement),
				better: cv.agreement > cv.baselineAgreement,
				baseline: formatPercent(cv.baselineAgreement),
				foot: `${cv.folds}-szörös keresztvalidáció, ${cv.evaluated} válasz`
		  }
		: null;

/** Forrás-sor: „12 kvízválasz · 3 saját fogadás · 1 kihagyott minta” (a 0-s tagok nélkül, a kvíz mindig). */
export const sourcesText = (s: ProfileResponse['sources']): string =>
	[
		`${s.quiz} kvízválasz`,
		s.placedBets ? `${s.placedBets} saját fogadás` : null,
		s.ignored ? `${s.ignored} kihagyott minta` : null
	]
		.filter(Boolean)
		.join(' · ');
