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

	it('szingli, dupla, hármas a legjobb lábakból; a javasolt a legnagyobb EV-jű nem magas kockázatú', () => {
		const presets = buildSlipPresets(
			[tip('a', 1, 0.6, 1.9), tip('b', 2, 0.55, 2), tip('c', 3, 0.4, 2.8), tip('d', 4, 0.4, 2.6)],
			1000
		);
		expect(presets.map((p) => p.kind)).toEqual(['single', 'double', 'treble']);
		expect(presets[0].legIds).toEqual(['a']);
		expect(presets[1].legIds).toEqual(['a', 'c']);
		expect(presets[2].summary.legCount).toBe(3);
		// hármas: 0,6·0,4·0,55 = 0,132 → magas kockázat, nem javasolt; dupla EV 0,24·5,32−1 ≈ 0,277 > szingli 0,14
		expect(presets[2].summary.risk).toBe('high');
		expect(presets.filter((p) => p.recommended).map((p) => p.kind)).toEqual(['double']);
	});

	it('kevés tippnél kevesebb javaslat; ha mind magas kockázatú, a szingli a javasolt', () => {
		expect(buildSlipPresets([], 1000)).toEqual([]);
		const one = buildSlipPresets([tip('a', 1, 0.1, 12)], 1000);
		expect(one).toHaveLength(1);
		expect(one[0].recommended).toBe(true);
	});
});
