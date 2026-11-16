import { describe, expect, it } from 'vitest';
import type { RecommendationItem } from '../recommend/snapshot';
import { buildSavedSlip, canSaveDraft, draftLegs, draftRows, draftTipFromItem, SlipDraftTip } from './draft';

const tip = (id: number, over: Partial<SlipDraftTip> = {}): SlipDraftTip => ({
	id: String(id),
	fixtureId: id,
	kickoff: '2026-11-14T15:00:00.000Z',
	homeName: `H${id}`,
	awayName: `A${id}`,
	tippmixLabel: 'Végeredmény · 1',
	pModel: 0.5,
	bestOdds: 2.2,
	minOdds: 2.1,
	ev: 0.1,
	modelVersion: 'm1',
	...over
});

describe('draftTipFromItem', () => {
	it('maps a snapshot item with the Tippmix label and team names', () => {
		const item = {
			fixtureId: 7,
			kickoff: '2026-11-14T15:00:00.000Z',
			outcome: 'Under',
			pModel: 0.55,
			bestOdds: 2,
			minOdds: 1.91,
			ev: 0.1,
			modelVersion: 'm2',
			home: { name: 'Arsenal', last5: [] },
			away: { name: 'Chelsea', last5: [] }
		} as unknown as RecommendationItem;
		expect(draftTipFromItem(item)).toMatchObject({
			id: '7',
			fixtureId: 7,
			homeName: 'Arsenal',
			awayName: 'Chelsea',
			tippmixLabel: 'Gólok száma 2,5 · Alatt',
			modelVersion: 'm2'
		});
	});
});

describe('draft rows and legs', () => {
	it('uses the typed odds when valid and falls back to the best odds otherwise', () => {
		const tips = [tip(1), tip(2)];
		const inputs = { '1': '2,30', '2': 'x' };
		expect(draftRows(tips, inputs).map((r) => r.status)).toEqual(['valid', 'missing']);
		expect(draftLegs(tips, inputs)).toEqual([
			{ fixtureId: 1, pModel: 0.5, bestOdds: 2.2, tippmixOdds: 2.3 },
			{ fixtureId: 2, pModel: 0.5, bestOdds: 2.2, tippmixOdds: undefined }
		]);
		expect(draftRows([tip(3)], { '3': '2.0' })[0].status).toBe('below');
	});

	it('is savable only when every leg has a typed odds', () => {
		expect(canSaveDraft([], {})).toBe(false);
		expect(canSaveDraft([tip(1)], {})).toBe(false);
		expect(canSaveDraft([tip(1)], { '1': '1,95' })).toBe(true);
	});
});

describe('buildSavedSlip', () => {
	it('returns null for a draft that cannot be saved', () => {
		expect(buildSavedSlip([tip(1)], {}, 1000)).toBeNull();
	});

	it('builds the oe_saved_slips record from the typed odds and stake', () => {
		const now = new Date('2026-11-14T10:00:00.000Z');
		const slip = buildSavedSlip([tip(1), tip(2)], { '1': '2', '2': '2,5' }, 1000, now)!;
		expect(slip.id).toBe(`slip-${now.getTime()}`);
		expect(slip.savedAt).toBe('2026-11-14T10:00:00.000Z');
		expect(slip.stake).toBe(1000);
		expect(slip.combinedOdds).toBeCloseTo(5);
		expect(slip.probability).toBeCloseTo(0.25);
		expect(slip.ev).toBeCloseTo(0.25);
		expect(slip.legs[1]).toEqual({
			tipId: '2',
			fixtureId: 2,
			pairing: 'H2 – A2',
			tippmixLabel: 'Végeredmény · 1',
			kickoff: '2026-11-14T15:00:00.000Z',
			pModel: 0.5,
			minOdds: 2.1,
			tippmixOdds: 2.5,
			modelVersion: 'm1'
		});
	});
});
