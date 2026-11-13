import { describe, expect, it } from 'vitest';
import { loadStored, memoryKeyValueStorage, saveStored } from '../storage/keyValue';
import { ISavedSlip, SAVED_SLIPS_STORAGE_KEY, savedSlipsCodec } from './savedSlip';

const slip: ISavedSlip = {
	id: 'slip-1',
	savedAt: '2026-11-13T10:00:00.000Z',
	stake: 1000,
	combinedOdds: 2.1,
	probability: 0.5,
	ev: 0.05,
	legs: [
		{
			tipId: 't1',
			fixtureId: 1,
			pairing: 'A – B',
			tippmixLabel: '1',
			kickoff: '2026-11-14T15:00:00.000Z',
			pModel: 0.5,
			minOdds: 2,
			tippmixOdds: 2.1,
			modelVersion: 'm1'
		}
	]
};

describe('savedSlipsCodec', () => {
	it('keeps the oe_saved_slips key and the plain JSON array format', async () => {
		expect(SAVED_SLIPS_STORAGE_KEY).toBe('oe_saved_slips');
		const s = memoryKeyValueStorage();
		await saveStored(s, savedSlipsCodec, [slip]);
		expect(JSON.parse(s.snapshot().oe_saved_slips)).toEqual([slip]);
		expect(await loadStored(s, savedSlipsCodec)).toEqual([slip]);
	});

	it('returns an empty list for missing or corrupt data and drops unrecognizable entries', () => {
		expect(savedSlipsCodec.decode(null)).toEqual([]);
		expect(savedSlipsCodec.decode('{oops')).toEqual([]);
		expect(savedSlipsCodec.decode('{"id":"x"}')).toEqual([]);
		expect(savedSlipsCodec.decode(JSON.stringify([slip, 3, { id: 'no-legs' }]))).toEqual([slip]);
	});
});
