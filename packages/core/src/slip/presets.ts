// Motor kész szelvényei (DESIGN.md v0.2 §8.2): a tippekből szingli / dupla (/ hármas) kötés javaslat, legfeljebb 3.
// Egy meccs = egy tipp (meccsenként a legnagyobb EV-jű marad); a lábak EV szerint csökkenő sorrendben.

import { SlipLeg, SlipSummary, summarizeSlip } from './slip';

export interface PresetCandidate extends SlipLeg {
	/** A tipp azonosítója (a nézet ebből tölti fel a szelvényt). */
	id: string;
	/** A tipp EV-je egységnyi tétre. */
	ev: number;
}

export type SlipPresetKind = 'single' | 'double' | 'treble';

export interface SlipPreset {
	id: SlipPresetKind;
	kind: SlipPresetKind;
	legIds: string[];
	summary: SlipSummary;
	/** „Ajánlott” (§8.2): csak a szingli, ha a kockázata low/medium. */
	recommended: boolean;
}

const PRESET_LEGS: [SlipPresetKind, number][] = [
	['single', 1],
	['double', 2],
	['treble', 3]
];

/** Meccsenként a legjobb (legnagyobb EV-jű), pozitív EV-jű tipp, EV szerint csökkenőben. */
export const presetCandidates = <T extends PresetCandidate>(tips: readonly T[]): T[] => {
	const best = new Map<number, T>();
	for (const tip of tips) {
		if (!(tip.ev > 0)) continue;
		const prev = best.get(tip.fixtureId);
		if (!prev || tip.ev > prev.ev) best.set(tip.fixtureId, tip);
	}
	return [...best.values()].sort((a, b) => b.ev - a.ev || a.id.localeCompare(b.id));
};

/**
 * Kész szelvények (§8.2): Szingli = a legnagyobb EV-jű tipp; Dupla = a két legjobb EV-jű, különböző meccsekről; Hármas = a
 * három legjobb (a „max. 3” keretbe fér, DECISIONS 2026-11-13). Egy tippnél csak a szingli. „Ajánlott” csak a szingli lehet,
 * ha a kockázata low/medium.
 * TODO(polish): „Szingli csomag” és „Rendszer 2/3” – ezekhez a szelvény-modellnek több tételt kell tudnia (S20 döntés).
 */
export const buildSlipPresets = (tips: readonly PresetCandidate[], stake: number): SlipPreset[] => {
	const candidates = presetCandidates(tips);
	const presets: SlipPreset[] = [];
	for (const [kind, n] of PRESET_LEGS) {
		if (candidates.length < n) break;
		const legs = candidates.slice(0, n);
		const summary = summarizeSlip(legs, stake);
		if (summary) presets.push({ id: kind, kind, legIds: legs.map((l) => l.id), summary, recommended: false });
	}
	const single = presets[0];
	if (single && single.summary.risk !== 'high') single.recommended = true;
	return presets;
};
