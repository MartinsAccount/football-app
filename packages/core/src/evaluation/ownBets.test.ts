import type { EvaluationRecord } from './dbSummary';
import { placedBetOutcome, settlePlacedBet, stakeProfit, summarizeOwnBets, type PlacedBetRecord } from './ownBets';

const bet = (over: Partial<PlacedBetRecord> = {}): PlacedBetRecord => ({
	id: 1,
	fixtureId: 100,
	marketId: 1,
	selection: 'Home',
	line: null,
	bookmakerLabel: 'Tippmix',
	oddTaken: 2,
	stake: 1000,
	placedAt: '2024-05-01T10:00:00.000Z',
	note: null,
	predictionId: null,
	modelVersion: null,
	modelOdd: null,
	evaluationOutcome: null,
	closingOdd: null,
	status: 'FT',
	homeGoals: 2,
	awayGoals: 1,
	...over
});

const evalRecord = (over: Partial<EvaluationRecord> = {}): EvaluationRecord => ({
	runId: 1,
	fixtureId: 100,
	marketId: 1,
	selection: 'Home',
	line: null,
	modelVersion: 'm@1',
	isRecommendation: true,
	pModel: 0.5,
	odd: 2.2,
	outcome: 'win',
	brier: 0.3,
	logLoss: 0.6,
	closingOdd: null,
	...over
});

describe('placedBetOutcome', () => {
	it('1X2 és O/U a meccs eredményéből', () => {
		expect(placedBetOutcome(bet())).toBe('win');
		expect(placedBetOutcome(bet({ selection: 'Draw' }))).toBe('loss');
		expect(placedBetOutcome(bet({ marketId: 5, selection: 'Over', line: 2.5 }))).toBe('win');
		expect(placedBetOutcome(bet({ marketId: 5, selection: 'Under', line: 3 }))).toBe('void'); // push
	});

	it('a kapcsolt kiértékelés kimenete elsőbbséget kap', () => {
		expect(placedBetOutcome(bet({ evaluationOutcome: 'loss' }))).toBe('loss');
	});

	it('void meccs, függő meccs, nem elszámolható piac/kimenet', () => {
		expect(placedBetOutcome(bet({ status: 'PST', homeGoals: null, awayGoals: null }))).toBe('void');
		expect(placedBetOutcome(bet({ status: 'NS', homeGoals: null, awayGoals: null }))).toBeNull();
		expect(placedBetOutcome(bet({ marketId: 8, selection: 'Yes' }))).toBeNull();
		expect(placedBetOutcome(bet({ selection: 'X' }))).toBeNull();
		expect(placedBetOutcome(bet({ marketId: 5, selection: 'Over', line: null }))).toBeNull();
	});
});

describe('stakeProfit / settlePlacedBet', () => {
	it('tétsúlyos profit', () => {
		expect(stakeProfit('win', 2.5, 1000)).toBe(1500);
		expect(stakeProfit('loss', 2.5, 1000)).toBe(-1000);
		expect(stakeProfit('void', 2.5, 1000)).toBe(0);
		expect(settlePlacedBet(bet({ status: 'NS' }))).toMatchObject({ outcome: null, profit: null });
	});
});

describe('summarizeOwnBets', () => {
	it('saját tétsúlyos és flat ROI, a modell ugyanezeken a tippeken és összesen', () => {
		const placed = [
			bet({ id: 1, oddTaken: 2, stake: 1000, predictionId: 10, modelOdd: 2.2 }), // win +1000
			bet({ id: 2, selection: 'Away', oddTaken: 3, stake: 500, predictionId: 11, modelOdd: 3.2 }), // loss −500
			bet({ id: 3, status: 'CANC', homeGoals: null, awayGoals: null }), // void
			bet({ id: 4, status: 'NS', homeGoals: null, awayGoals: null }) // függő
		];
		const s = summarizeOwnBets(placed, [
			evalRecord(),
			evalRecord({ outcome: 'loss', odd: 3 }),
			evalRecord({ isRecommendation: false, outcome: 'loss' })
		]);
		expect(s.own).toEqual({
			n: 4,
			pending: 1,
			wins: 1,
			losses: 1,
			voids: 1,
			staked: 1500,
			profit: 500,
			roi: 500 / 1500,
			hitRate: 0.5
		});
		expect(s.ownFlat).toMatchObject({ n: 3, wins: 1, losses: 1, voids: 1, profit: 0, roi: 0 });
		expect(s.modelSameBets.n).toBe(2);
		expect(s.modelSameBets.profit).toBeCloseTo(0.2);
		expect(s.model).toMatchObject({ n: 2, wins: 1, losses: 1 });
		expect(s.model.profit).toBeCloseTo(0.2);
	});

	it('üres bemenet', () => {
		const s = summarizeOwnBets([], []);
		expect(s.own).toMatchObject({ n: 0, pending: 0, staked: 0, roi: null, hitRate: null });
		expect(s.model.roi).toBeNull();
	});
});
