// Motor kész szelvényei (DESIGN.md §7.8, D2): a tippekből szingli / dupla / hármas kötés javaslat.
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
	/** A javasolt szelvény: a legnagyobb EV-jű nem magas kockázatú (ha ilyen nincs: a szingli). */
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
 * Kész szelvények a tippekből: Szingli (a legjobb tipp), Dupla és Hármas kötés (a 2 / 3 legjobb), ha van elég meccs.
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
	const pool = presets.filter((p) => p.summary.risk !== 'high');
	const pick = (pool.length ? pool : presets.slice(0, 1)).reduce<SlipPreset | undefined>(
		(best, p) => (!best || p.summary.ev > best.summary.ev ? p : best),
		undefined
	);
	if (pick) pick.recommended = true;
	return presets;
};
