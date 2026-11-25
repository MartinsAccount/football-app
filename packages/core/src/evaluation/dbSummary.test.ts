import { describe, expect, it } from 'vitest';
import { evaluationGroupKey, scoreProbabilities, summarizeEvaluations, type EvaluationRecord } from './dbSummary';

const rec = (o: Partial<EvaluationRecord>): EvaluationRecord => ({
	runId: 1,
	fixtureId: 10,
	marketId: 1,
	selection: 'Home',
	line: null,
	modelVersion: 'v1',
	isRecommendation: false,
	pModel: 0.5,
	odd: 2,
	outcome: 'loss',
	brier: null,
	logLoss: null,
	closingOdd: null,
	...o
});

// Egy 1X2-csoport (3 sor, mind Brier 0.38) és egy O/U-csoport (2 sor, Brier 0.405).
const fx = [
	rec({
		selection: 'Home',
		pModel: 0.5,
		outcome: 'win',
		brier: 0.38,
		logLoss: 0.69,
		odd: 2.2,
		isRecommendation: true,
		closingOdd: 2
	}),
	rec({ selection: 'Draw', pModel: 0.3, brier: 0.38, logLoss: 0.69 }),
	rec({ selection: 'Away', pModel: 0.2, brier: 0.38, logLoss: 0.69 }),
	rec({ marketId: 5, line: 2.5, selection: 'Over', pModel: 0.55, outcome: 'win', brier: 0.405, logLoss: 0.6 }),
	rec({ marketId: 5, line: 2.5, selection: 'Under', pModel: 0.45, brier: 0.405, logLoss: 0.6, odd: 1.9, isRecommendation: true })
];

describe('scoreProbabilities', () => {
	it('csoportonként EGY sort vesz (nem sorsúlyozott átlag)', () => {
		const s = scoreProbabilities(fx);
		expect(s.groups).toBe(2);
		expect(s.meanBrier).toBeCloseTo((0.38 + 0.405) / 2); // sorsúlyozva 0.39 lenne
		expect(s.meanLogLoss).toBeCloseTo((0.69 + 0.6) / 2);
	});

	it('külön futás vagy vonal külön csoport; null-Brier csoport nem számít', () => {
		const s = scoreProbabilities([
			rec({ brier: 0.2 }),
			rec({ runId: 2, brier: 0.4 }),
			rec({ marketId: 5, line: 3.5, brier: 0.6 }),
			rec({ fixtureId: 11, brier: null, outcome: 'void' })
		]);
		expect(s.groups).toBe(3);
		expect(s.meanBrier).toBeCloseTo(0.4);
		expect(scoreProbabilities([]).meanBrier).toBeNull();
		expect(evaluationGroupKey(rec({ line: 2.5 }))).toBe('1:10:1:2.5');
	});
});

describe('summarizeEvaluations', () => {
	it('ajánlásokra flat ROI + CLV, minden nem-void predikcióra kalibráció, piaconkénti bontás', () => {
		const s = summarizeEvaluations(fx);
		expect(s.records).toBe(5);
		expect(s.bets.n).toBe(2);
		expect(s.bets.wins).toBe(1);
		expect(s.bets.profit).toBeCloseTo(1.2 - 1);
		expect(s.bets.expectedHitRate).toBeCloseTo((0.5 + 0.45) / 2);
		expect(s.bets.meanClv).toBeCloseTo(2.2 / 2 - 1);
		expect(s.calibration.reduce((n, b) => n + b.count, 0)).toBe(5);
		expect(s.markets.map((m) => [m.marketId, m.groups, m.bets.n])).toEqual([
			[1, 1, 1],
			[5, 1, 1]
		]);
		expect(s.markets[0].meanBrier).toBeCloseTo(0.38);
	});

	it('modellverzió-szűrés; a verziólista a szűrés előtti', () => {
		const s = summarizeEvaluations([...fx, rec({ modelVersion: 'v2', runId: 9, brier: 0.1, outcome: 'void' })], {
			modelVersion: 'v2'
		});
		expect(s.modelVersions).toEqual(['v1', 'v2']);
		expect(s.modelVersion).toBe('v2');
		expect(s.records).toBe(1);
		expect(s.calibration).toEqual([]);
		expect(summarizeEvaluations(fx, { modelVersion: '' }).modelVersion).toBeNull();
	});
});
