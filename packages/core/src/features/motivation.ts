// Motiváció / tét (strategy.md §3.1). R hátralévő fordulóval max. 3R pont szerezhető.
// Zónánként rés a zónahatárhoz (bent: ≥ 0 előny, kint: ≤ 0 hátrány); |rés| > 3R → eldőlt, |rés| ≤ 3 vagy R ≤ 5 → kritikus,
// egyébként élő. A csapat szintje a legerősebb zóna; csak a szezon második felében (R ≤ összes/2), előtte semleges.
import { totalRounds } from './season';
import type { StandingRow } from './standings';
import type { TeamId } from './types';

/** `cim`, `europa`: bejutni akar; `kieses`: elkerülni akar. */
export type ZoneKind = 'cim' | 'europa' | 'kieses';

export interface Zone {
	kind: ZoneKind;
	/** Helyezések, zárt intervallum (1-től). */
	from: number;
	to: number;
}

export type ZoneState = 'eldolt' | 'elo' | 'kritikus';
export type MotivationLevel = 'semleges' | 'elo' | 'kritikus';

export interface ZoneStatus {
	zone: Zone;
	inZone: boolean;
	/** Pontrés a határhoz: bent ≥ 0 (előny), kint ≤ 0 (hátrány). */
	gap: number;
	state: ZoneState;
}

export interface Motivation {
	teamId: TeamId;
	level: MotivationLevel;
	/** A szintet adó zóna; semlegesnél `null`. */
	zone: ZoneKind | null;
	remaining: number;
	/** Igaz, ha a szezon második felében járunk (a motiváció számít). */
	active: boolean;
	zones: ZoneStatus[];
}

/** Alap zónák, ha nincs `standings.description`: cím 1., Európa 1–4., kiesés az utolsó 3 (DECISIONS.md). */
export const defaultZones = (teamCount: number): Zone[] => [
	{ kind: 'cim', from: 1, to: 1 },
	{ kind: 'europa', from: 1, to: Math.min(4, teamCount - 1) },
	{ kind: 'kieses', from: Math.max(2, teamCount - 2), to: teamCount }
];

const zoneGap = (table: readonly StandingRow[], idx: number, zone: Zone): { inZone: boolean; gap: number } | null => {
	const pos = idx + 1;
	const pts = table[idx].points;
	const pointsAt = (position: number) => table[position - 1]?.points;
	if (zone.kind === 'kieses') {
		const inZone = pos >= zone.from;
		const other = inZone ? pointsAt(zone.from - 1) : pointsAt(zone.from);
		return other === undefined ? null : { inZone, gap: pts - other };
	}
	const inZone = pos >= zone.from && pos <= zone.to;
	const other = inZone ? pointsAt(zone.to + 1) : pointsAt(zone.to);
	return other === undefined ? null : { inZone, gap: pts - other };
};

const LEVEL_SCORE: Record<MotivationLevel, number> = { semleges: 0, elo: 1, kritikus: 2 };

export const motivationScore = (level: MotivationLevel): number => LEVEL_SCORE[level];

export interface MotivationOptions {
	zones?: readonly Zone[];
	/** Összes forduló (alap: 2 × (csapatszám − 1)). */
	rounds?: number;
}

/** A csapat motivációja a tabella alapján; `null`, ha a csapat nincs a tabellán. */
export const teamMotivation = (
	table: readonly StandingRow[],
	teamId: TeamId,
	opts: MotivationOptions = {}
): Motivation | null => {
	const idx = table.findIndex((r) => r.teamId === teamId);
	if (idx < 0) return null;
	const rounds = opts.rounds ?? totalRounds(table.length);
	const zones = opts.zones ?? defaultZones(table.length);
	const remaining = Math.max(0, rounds - table[idx].played);
	const maxPoints = 3 * remaining;
	const statuses: ZoneStatus[] = [];
	for (const zone of zones) {
		const g = zoneGap(table, idx, zone);
		if (!g) continue;
		const abs = Math.abs(g.gap);
		// R = 0: a szezon véget ért; holtversenyt itt nem modellezünk.
		const state: ZoneState = remaining === 0 || abs > maxPoints ? 'eldolt' : abs <= 3 || remaining <= 5 ? 'kritikus' : 'elo';
		statuses.push({ zone, inZone: g.inZone, gap: g.gap, state });
	}
	const active = remaining <= rounds / 2;
	let level: MotivationLevel = 'semleges';
	let zone: ZoneKind | null = null;
	if (active) {
		for (const s of statuses) {
			const l: MotivationLevel = s.state === 'eldolt' ? 'semleges' : s.state;
			if (LEVEL_SCORE[l] > LEVEL_SCORE[level]) {
				level = l;
				zone = s.zone.kind;
			}
		}
	}
	return { teamId, level, zone, remaining, active, zones: statuses };
};

/** Hazai − vendég motiváció-pontszám (−2…2). */
export const motivationDiff = (home: Motivation | null, away: Motivation | null): number =>
	motivationScore(home?.level ?? 'semleges') - motivationScore(away?.level ?? 'semleges');
