import { buildSlipPresets, presetCandidates, type PresetCandidate } from './presets';

const tip = (id: string, fixtureId: number, pModel: number, bestOdds: number): PresetCandidate => ({
	id,
	fixtureId,
	pModel,
	bestOdds,
	ev: pModel * bestOdds - 1
});

describe('kész szelvények (SlipPresets)', () => {
	it('meccsenként egy tipp, csak pozitív EV, EV szerint csökkenőben', () => {
		const list = presetCandidates([tip('a', 1, 0.6, 1.9), tip('b', 1, 0.5, 2.3), tip('c', 2, 0.5, 1.8), tip('d', 3, 0.7, 1.6)]);
		expect(list.map((t) => t.id)).toEqual(['b', 'd']);
	});

	it('szingli, dupla, hármas a legjobb lábakból (max. 3); „Ajánlott” csak a nem magas kockázatú szingli', () => {
		const presets = buildSlipPresets(
			[tip('a', 1, 0.6, 1.9), tip('b', 2, 0.55, 2), tip('c', 3, 0.4, 2.8), tip('d', 4, 0.4, 2.6)],
			1000
		);
		expect(presets.map((p) => p.kind)).toEqual(['single', 'double', 'treble']);
		expect(presets[0].legIds).toEqual(['a']);
		expect(presets[1].legIds).toEqual(['a', 'c']);
		expect(presets[2].summary.legCount).toBe(3);
		expect(presets).toHaveLength(3);
		// a dupla EV-je nagyobb (≈ 0,277 > 0,14), de §8.2: csak a szingli lehet „Ajánlott” (kockázata low: 60%)
		expect(presets.filter((p) => p.recommended).map((p) => p.kind)).toEqual(['single']);
	});

	it('egy tippnél csak a szingli; magas kockázatú szingli nem „Ajánlott”', () => {
		expect(buildSlipPresets([], 1000)).toEqual([]);
		const one = buildSlipPresets([tip('a', 1, 0.1, 12)], 1000);
		expect(one.map((p) => p.kind)).toEqual(['single']);
		expect(one[0].recommended).toBe(false);
		const medium = buildSlipPresets([tip('a', 1, 0.3, 4), tip('b', 1, 0.5, 2.2)], 1000);
		expect(medium.map((p) => p.kind)).toEqual(['single']);
		expect(medium[0].recommended).toBe(true);
	});

	it('a dupla két különböző meccsről jön (ugyanarról a meccsről két tipp nem kerül egy kötésbe)', () => {
		const presets = buildSlipPresets([tip('a', 1, 0.5, 2.4), tip('b', 1, 0.45, 2.5), tip('c', 2, 0.4, 2.7)], 1000);
		expect(presets.find((p) => p.kind === 'double')?.legIds).toEqual(['a', 'c']);
	});
});
