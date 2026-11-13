import { summarizeSlip } from '@football/core';
import { sampleTips } from '../components/TipCard/sampleTips';
import { memorySlipStorage, SlipStore } from './SlipStore';

const now = new Date('2026-11-12T08:00:00Z');
const [a, b, c] = sampleTips(now);

describe('SlipStore', () => {
	it('toggles tips and summarizes with the core slip math', () => {
		const store = new SlipStore(memorySlipStorage());
		expect(store.summary).toBeNull();
		store.toggle(a);
		store.toggle(b);
		expect(store.isSelected(a.id)).toBe(true);
		expect(store.summary).toEqual(
			summarizeSlip(
				[a, b].map((t) => ({ fixtureId: t.fixtureId, pModel: t.pModel, bestOdds: t.bestOdds })),
				1000
			)
		);
		store.toggle(a);
		expect(store.tips.map((t) => t.id)).toEqual([b.id]);
	});

	it('blocks a second tip on the same fixture', () => {
		const store = new SlipStore(memorySlipStorage());
		const sameMatch = { ...c, id: 'other', fixtureId: a.fixtureId };
		store.toggle(a);
		expect(store.blockedReason(sameMatch)).toMatch(/már van tipp/);
		expect(store.blockedReason(a)).toBeUndefined();
		store.toggle(sameMatch);
		expect(store.tips).toHaveLength(1);
	});

	it('recomputes with typed Tippmix odds and saves only when every leg has odds', () => {
		const storage = memorySlipStorage();
		const store = new SlipStore(storage);
		store.toggle(a);
		store.toggle(b);
		store.setStake(2000);
		store.openTransfer();
		store.setTippmixInput(a.id, '1,90');
		expect(store.transferRows.map((r) => r.status)).toEqual(['valid', 'missing']);
		expect(store.canSave).toBe(false);
		expect(store.save(now)).toBeNull();
		store.setTippmixInput(b.id, '1.01');
		expect(store.transferRows[1].status).toBe('below');
		expect(store.summary!.estimated).toBe(false);
		expect(store.summary!.combinedOdds).toBeCloseTo(1.9 * 1.01);

		const saved = store.save(now)!;
		expect(saved.stake).toBe(2000);
		expect(saved.legs.map((l) => l.tippmixOdds)).toEqual([1.9, 1.01]);
		expect(storage.load()).toHaveLength(1);
		expect(store.tips).toHaveLength(0);
		expect(store.transferOpen).toBe(false);
		expect(new SlipStore(storage).saved).toHaveLength(1);
	});

	it('closes the transfer when the last leg is removed', () => {
		const store = new SlipStore(memorySlipStorage());
		store.toggle(a);
		store.openTransfer();
		store.setTippmixInput(a.id, '2');
		store.remove(a.id);
		expect(store.transferOpen).toBe(false);
		expect(store.inputs.size).toBe(0);
	});

	it('applies a preset (one tip per fixture), clears inputs, and empties the slip', () => {
		const store = new SlipStore(memorySlipStorage());
		store.toggle(c);
		store.setTippmixInput(c.id, '1,9');
		store.applyPreset([a, b, { ...b, id: 'dup' }]);
		expect(store.tips.map((t) => t.id)).toEqual([a.id, b.id]);
		expect(store.inputs.size).toBe(0);
		expect(store.hasExactly([b.id, a.id])).toBe(true);
		expect(store.hasExactly([a.id])).toBe(false);
		expect(store.isSelected(a.id)).toBe(true);
		store.openTransfer();
		store.setTippmixInput(a.id, '2');
		store.clear();
		expect(store.tips).toEqual([]);
		expect(store.inputs.size).toBe(0);
		expect(store.transferOpen).toBe(false);
		expect(store.summary).toBeNull();
	});
});
