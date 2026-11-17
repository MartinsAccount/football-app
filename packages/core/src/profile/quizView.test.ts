import { describe, expect, it } from 'vitest';
import type { OwnerProfile, ProfileCrossValidation } from './profile';
import type { QuizQuestion } from './types';
import {
	ownerPickChip,
	answerRows,
	type QuizAnswerView,
	answerVerdict,
	crossValidationTiles,
	profileProgress,
	profileStatus,
	questionTitle,
	quizFormAria,
	sourcesText,
	tablePositionText
} from './quizView';

const q: QuizQuestion = {
	fixtureId: 100,
	league: { id: 39, name: 'Premier League' },
	kickoff: '2024-01-20T15:00:00Z',
	home: { id: 1, name: 'Arsenal', form: ['W', 'D', 'L'], tablePosition: 3 },
	away: { id: 2, name: 'Chelsea', form: [], tablePosition: null },
	odds1x2: { home: 1.8, draw: 3.6, away: 4.5 },
	oddsOu25: { over: 1.9, under: 1.95 }
};

const profile = (answered: number, status: OwnerProfile['status'] = 'kevés adat'): OwnerProfile => ({
	version: 'owner-logreg@1.0.0',
	status,
	answered,
	skipped: 0,
	weights: [],
	traits: []
});

describe('quizView', () => {
	it('answerRows: 1X2 + O/U magyar odds-formátummal; O/U nélkül csak egy sor', () => {
		const rows = answerRows(q);
		expect(rows.map((r) => r.map((b) => `${b.label} ${b.odds}`))).toEqual([
			['1 1,80', 'X 3,60', '2 4,50'],
			['Több mint 2,5 1,90', 'Kevesebb 1,95']
		]);
		expect(answerRows({ ...q, oddsOu25: null })).toHaveLength(1);
	});

	it('csapat-adatok: tabellahely, forma-felolvasás, párosítás', () => {
		expect(tablePositionText(q.home)).toBe('3.');
		expect(tablePositionText(q.away)).toBe('–');
		expect(quizFormAria(q.home)).toBe('Arsenal utolsó 3: Gy D V');
		expect(quizFormAria(q.away)).toBe('Chelsea: nincs forma-adat');
		expect(questionTitle(q)).toBe('Arsenal – Chelsea');
	});

	it('answerVerdict: talált / nem talált / kihagyás', () => {
		const res = (pick: QuizAnswerView['answer']['pick'], correct: boolean | null): QuizAnswerView => ({
			answer: { pick },
			result: { homeGoals: 2, awayGoals: 1, outcome: '1', over25: true },
			correct
		});
		const hit = answerVerdict(q, res('1', true));
		expect(hit).toMatchObject({ title: 'Talált', tone: 'positive' });
		expect(hit.text).toBe('Valós eredmény: Arsenal – Chelsea 2–1 (1, több mint 2,5 gól). A tipped: hazai győzelem (1).');
		expect(answerVerdict(q, res('under', false))).toMatchObject({ title: 'Nem talált', tone: 'negative' });
		expect(answerVerdict(q, res('skip', null))).toMatchObject({ title: 'Kihagytad', tone: 'neutral' });
	});

	it('profil: haladás 20-ig, állapot, CV-csempék, források', () => {
		expect(profileProgress(profile(5))).toMatchObject({ text: '5 / 20 válasz', width: '25%' });
		expect(profileProgress(profile(31, 'ok')).width).toBe('100%');
		expect(profileStatus(profile(5))).toEqual({ label: 'Kevés adat', state: 'stale' });
		expect(profileStatus(profile(25, 'ok'))).toEqual({ label: 'Profil kész' });
		const cv: ProfileCrossValidation = { status: 'ok', folds: 5, evaluated: 25, agreement: 0.52, baselineAgreement: 0.4 };
		expect(crossValidationTiles(cv)).toEqual({
			agreement: '52%',
			baseline: '40%',
			better: true,
			foot: '5-szörös keresztvalidáció, 25 válasz'
		});
		expect(crossValidationTiles({ ...cv, status: 'kevés adat' })).toBeNull();
		expect(sourcesText({ quiz: 12, placedBets: 0, ignored: 1 })).toBe('12 kvízválasz · 1 kihagyott minta');
	});
});

describe('ownerPickChip (Q5)', () => {
	const p = {
		pick: '1' as const,
		probability: 0.623,
		factors: [
			{ label: 'Favorit', contribution: 0.8 },
			{ label: 'Formaelőny', contribution: -0.2 }
		]
	};

	it('címke, indok, egyezés az ajánlással', () => {
		const c = ownerPickChip(p, 'Home');
		expect(c.label).toBe('Te ezt raknád: 1 (62%)');
		expect(c.detail).toBe('Fő tényezők: Favorit ↑, Formaelőny ↓');
		expect(c.matches).toBe(true);
		expect(c.aria).toContain('egyezik a stílusoddal');
	});

	it('eltérő ajánlás / ajánlás nélkül nincs egyezés; gólpiac és üres tényezőlista', () => {
		expect(ownerPickChip(p, 'Over').matches).toBe(false);
		expect(ownerPickChip(p).matches).toBe(false);
		const c = ownerPickChip({ pick: 'under', probability: 0.4, factors: [] }, 'Under');
		expect(c.label).toBe('Te ezt raknád: kevesebb mint 2,5 gól (40%)');
		expect(c.detail).toBe('A profilod alapján');
		expect(c.matches).toBe(true);
	});
});
