import { describe, expect, it } from 'vitest';
import type { BetSummary } from '../evaluation/evaluation';
import type { OwnBetsSummary } from '../evaluation/ownBets';
import { ownBetsChip, ownBetsRows, slipSyncText, slipToPlacedBet } from './placedBetSync';
import type { ISavedSlip } from './savedSlip';

const leg = (fixtureId: number, outcome?: string, tippmixOdds = 2.1) => ({
	tipId: String(fixtureId),
	fixtureId,
	pairing: 'A – B',
	tippmixLabel: 'x',
	kickoff: '2026-11-14T15:00:00.000Z',
	pModel: 0.5,
	minOdds: 2,
	tippmixOdds,
	modelVersion: 'm1',
	...(outcome ? { outcome } : {})
});
const slip = (legs: ISavedSlip['legs'], stake = 1000): ISavedSlip => ({
	id: 'slip-1',
	savedAt: '2026-11-13T10:00:00.000Z',
	stake,
	combinedOdds: 2.1,
	probability: 0.5,
	ev: 0.05,
	legs
});

describe('slipToPlacedBet', () => {
	it('maps a single 1X2 leg to market 1 without a line', () => {
		expect(slipToPlacedBet(slip([leg(7, 'Draw')]))).toEqual({
			fixtureId: 7,
			marketId: 1,
			selection: 'Draw',
			line: null,
			oddTaken: 2.1,
			stake: 1000,
			placedAt: '2026-11-13T10:00:00.000Z',
			note: 'szelvény slip-1 · m1'
		});
	});

	it('maps a single O/U leg to market 5 with the 2.5 line', () => {
		expect(slipToPlacedBet(slip([leg(7, 'Under')]))).toMatchObject({ marketId: 5, selection: 'Under', line: 2.5 });
		expect(slipToPlacedBet(slip([leg(7, 'Yes')]))).toMatchObject({ marketId: 8, selection: 'Yes', line: null });
		expect(slipToPlacedBet(slip([leg(7, 'Over35')]))).toMatchObject({ marketId: 5, selection: 'Over', line: 3.5 });
		expect(slipToPlacedBet(slip([leg(7, 'Under15')]))).toMatchObject({ marketId: 5, selection: 'Under', line: 1.5 });
		expect(slipToPlacedBet(slip([leg(7, 'Draw/Away')]))).toMatchObject({ marketId: 12, selection: 'Draw/Away', line: null });
	});

	it('keeps combos, legacy legs without outcome, unknown outcomes and invalid odds/stake local', () => {
		expect(slipToPlacedBet(slip([leg(1, 'Home'), leg(2, 'Away')]))).toBeNull();
		expect(slipToPlacedBet(slip([leg(1)]))).toBeNull();
		expect(slipToPlacedBet(slip([leg(1, 'Home+Draw')]))).toBeNull();
		expect(slipToPlacedBet(slip([leg(1, 'Home', 1)]))).toBeNull();
		expect(slipToPlacedBet(slip([leg(1, 'Home')], 0))).toBeNull();
	});

	it('describes the sync state', () => {
		expect(slipSyncText('server')).toBe('rögzítve a szerveren');
		expect(slipSyncText('failed')).toContain('nem sikerült');
		expect(slipSyncText('local')).toContain('kombinált');
		expect(slipSyncText(undefined)).toBe('csak helyben');
	});
});

const bets = (over: Partial<BetSummary> = {}): BetSummary => ({
	n: 0,
	wins: 0,
	losses: 0,
	voids: 0,
	hitRate: null,
	expectedHitRate: null,
	profit: 0,
	roi: null,
	roiStdError: null,
	meanClv: null,
	clvCount: 0,
	...over
});

describe('ownBetsRows', () => {
	const s: OwnBetsSummary = {
		own: { n: 3, pending: 1, wins: 1, losses: 1, voids: 0, staked: 2000, profit: 500, roi: 0.25, hitRate: 0.5 },
		ownFlat: bets({ n: 2, wins: 1, losses: 1, hitRate: 0.5, profit: 0.5, roi: 0.25 }),
		modelSameBets: bets(),
		model: bets({ n: 10, wins: 4, losses: 6, hitRate: 0.4, profit: -1, roi: -0.1 })
	};

	it('formats own (money) and flat rows in Hungarian', () => {
		const rows = ownBetsRows(s);
		expect(rows.map((r) => r.key)).toEqual(['own', 'ownFlat', 'modelSame', 'model']);
		expect(rows[0]).toMatchObject({ bets: '3', hitRate: '50%', roi: '+25%', roiTone: 'positive', profit: '500 Ft' });
		expect(rows[1]).toMatchObject({ roi: '+25%', profit: '+0,5 egység' });
		expect(rows[2]).toMatchObject({ bets: '0', hitRate: '–', roi: '–', roiTone: undefined, profit: '–' });
		expect(rows[3]).toMatchObject({ roi: '−10%', roiTone: 'negative' });
		expect(ownBetsChip(s)).toBe('3 rögzített tipp · 1 függő');
	});
});
