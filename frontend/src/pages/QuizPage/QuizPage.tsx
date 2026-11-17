import React, { Component } from 'react';
import type { QuizQuestion, QuizTeam } from '@football/core';
import type { ProfileResponse, QuizAnswerResponse } from '@football/contract';
import PageHead from '../../components/PageIntro/PageHead';
import EmptyState from '../../components/PageIntro/EmptyState';
import { loadErrorText } from '../../components/PageIntro/RemoteData';
import { RESULT_CHIP_CLASS, RESULT_LETTER } from '../../components/TipCard/tipView';
import { card, cx, dangerBox } from '../../components/ui/oeClasses';
import { readApi } from '../../services/readApi';
import ProfileCard from './ProfileCard';
import {
	answerRows,
	answerVerdict,
	CONFIDENCE_OPTIONS,
	IAnswerButton,
	QuizChoice,
	questionMeta,
	questionTitle,
	quizFormAria,
	SKIP_BUTTON,
	tablePositionText
} from './quizView';

type Loadable<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

interface IQuizPageState {
	question: Loadable<QuizQuestion | null>;
	profile: Loadable<ProfileResponse>;
	confidence?: 1 | 2 | 3;
	/** A beküldött (vagy beküldés alatti) tipp. */
	chosen?: QuizChoice;
	answer?: QuizAnswerResponse;
	submitError?: string;
}

/**
 * `/quiz` – Saját stílus (ROADMAP 12.3, terv: docs/plans/owner-style-and-draws.md): lejátszott meccs nyitó adatai, a tulajdonos
 * tippel (vagy kihagyja), utána a valós eredmény; mellette a profilkártya. Adat: `GET /api/quiz/next`, `POST /api/quiz/answer`,
 * `GET /api/profile` (DB, 0 külső hívás). Az oldal-állapot komponens-state (mint az `OwnBets`), nincs MobX-store.
 * TODO(polish): billentyű-gyorsgombok (1/X/2/O/U/S), „vissza az előzőre”, válasz-előzmények listája.
 */
class QuizPage extends Component<{}, IQuizPageState> {
	state: IQuizPageState = { question: { status: 'loading' }, profile: { status: 'loading' } };
	private alive = false;

	componentDidMount() {
		this.alive = true;
		this.loadQuestion();
		this.loadProfile();
	}

	componentWillUnmount() {
		this.alive = false;
	}

	loadQuestion = () => {
		this.setState({ question: { status: 'loading' }, chosen: undefined, answer: undefined, submitError: undefined });
		readApi.getQuizQuestion().then(
			(r) => this.alive && this.setState({ question: { status: 'ready', data: r.question } }),
			(e) => this.alive && this.setState({ question: { status: 'error', message: loadErrorText(e) } })
		);
	};

	loadProfile = () => {
		readApi.getProfile().then(
			(data) => this.alive && this.setState({ profile: { status: 'ready', data } }),
			(e) => this.alive && this.setState({ profile: { status: 'error', message: loadErrorText(e) } })
		);
	};

	submit = (q: QuizQuestion, pick: QuizChoice) => {
		const { confidence } = this.state;
		this.setState({ chosen: pick, submitError: undefined });
		readApi.answerQuiz({ fixtureId: q.fixtureId, pick, ...(confidence && pick !== 'skip' ? { confidence } : {}) }).then(
			(answer) => {
				if (!this.alive) return;
				this.setState({ answer });
				this.loadProfile();
			},
			(e) => this.alive && this.setState({ chosen: undefined, submitError: loadErrorText(e) })
		);
	};

	renderTeam(team: QuizTeam, side: string) {
		return (
			<div className="min-w-0">
				<div className="oe-team__name" title={team.name}>
					{side} · tabella: <strong>{tablePositionText(team)}</strong>
				</div>
				<div className="truncate font-bold text-text-primary">{team.name}</div>
				<ol className="oe-form mt-sp-3" aria-label={quizFormAria(team)}>
					{team.form.map((r, i) => (
						<li key={i} className={`oe-chip ${RESULT_CHIP_CLASS[r]}`}>
							{RESULT_LETTER[r]}
						</li>
					))}
				</ol>
			</div>
		);
	}

	renderButton(q: QuizQuestion, b: IAnswerButton) {
		const { chosen } = this.state;
		const pressed = chosen === b.pick;
		return (
			<button
				key={b.pick}
				type="button"
				className={cx('oe-btn min-w-0 flex-col gap-sp-1 py-sp-3', pressed && 'oe-btn--neutral')}
				aria-pressed={pressed}
				disabled={chosen !== undefined}
				onClick={() => this.submit(q, b.pick)}
			>
				<span>{b.label}</span>
				{b.odds && <span className="text-small tabular-nums">{b.odds}</span>}
			</button>
		);
	}

	renderQuestion(q: QuizQuestion) {
		const { confidence, chosen, answer, submitError } = this.state;
		const rows = answerRows(q);
		const verdict = answer && answerVerdict(q, answer);
		return (
			<section className={card} aria-labelledby="h-quiz">
				<div>
					<p className="oe-label">{questionMeta(q)}</p>
					<h2 className="oe-h2 mt-sp-3" id="h-quiz">
						{questionTitle(q)}
					</h2>
				</div>
				<div className="oe-teams">
					{this.renderTeam(q.home, 'Hazai')}
					{this.renderTeam(q.away, 'Vendég')}
				</div>
				<div className="flex flex-col gap-sp-4">
					<p className="oe-label">Mit raknál meg? (nyitó odds)</p>
					{rows.map((row, i) => (
						<div key={i} className={cx('grid gap-sp-4', row.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
							{row.map((b) => this.renderButton(q, b))}
						</div>
					))}
					<div className="grid grid-cols-1">{this.renderButton(q, SKIP_BUTTON)}</div>
				</div>
				<div className="flex flex-wrap items-center gap-sp-4">
					<span className="text-small text-text-muted" id="quiz-conf">
						Mennyire vagy biztos? (nem kötelező)
					</span>
					<div className="oe-segmented" role="group" aria-labelledby="quiz-conf">
						{CONFIDENCE_OPTIONS.map((o) => (
							<button
								key={o.value}
								type="button"
								className="oe-segmented__btn"
								aria-pressed={confidence === o.value}
								disabled={chosen !== undefined}
								onClick={() => this.setState({ confidence: confidence === o.value ? undefined : o.value })}
							>
								{o.label}
							</button>
						))}
					</div>
				</div>
				{submitError && (
					<p className={`${dangerBox} m-0`} role="alert">
						{submitError}
					</p>
				)}
				{verdict && (
					<div className="oe-verdict" data-tone={verdict.tone} role="status">
						<span className="oe-verdict__icon" aria-hidden="true">
							{verdict.icon}
						</span>
						<div className="min-w-0 flex-auto">
							<h3 className="oe-h2 m-0">{verdict.title}</h3>
							<p className="oe-verdict__text">{verdict.text}</p>
						</div>
					</div>
				)}
				{answer && (
					<div>
						<button type="button" className="oe-btn oe-btn--neutral" onClick={this.loadQuestion}>
							Következő
						</button>
					</div>
				)}
			</section>
		);
	}

	renderMain() {
		const s = this.state.question;
		if (s.status === 'loading')
			return (
				<div className={card} role="status" aria-busy="true">
					<p className="oe-muted m-0">Betöltés…</p>
				</div>
			);
		if (s.status === 'error')
			return (
				<div className={card} role="alert">
					<p className={`${dangerBox} m-0`}>{s.message}</p>
					<div>
						<button type="button" className="oe-btn oe-btn--neutral" onClick={this.loadQuestion}>
							Újra
						</button>
					</div>
				</div>
			);
		if (!s.data)
			return (
				<EmptyState
					title="Elfogytak a kérdések"
					text="Minden lejátszott, nyitó oddsszal mentett meccsre válaszoltál. Új meccsek a betöltés után jönnek."
				/>
			);
		return this.renderQuestion(s.data);
	}

	renderAside() {
		const p = this.state.profile;
		if (p.status === 'ready') return <ProfileCard data={p.data} />;
		return (
			<div className={card} role={p.status === 'error' ? 'alert' : 'status'}>
				{p.status === 'error' ? (
					<p className={`${dangerBox} m-0`}>{p.message}</p>
				) : (
					<p className="oe-muted m-0">Profil betöltése…</p>
				)}
			</div>
		);
	}

	render() {
		return (
			<div className="oe-stack">
				<PageHead title="Saját stílus" chips={['Lejátszott meccsek, eredmény a tipp után', 'Kvíz']} />
				<div className="oe-split">
					<div className="oe-split__main">{this.renderMain()}</div>
					<aside className="oe-split__aside">{this.renderAside()}</aside>
				</div>
			</div>
		);
	}
}

export default QuizPage;
